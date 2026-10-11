"""Confere o GLB real contra a autoria e registra sua identidade para o mapa."""
from collections import Counter
import hashlib
import json
from pathlib import Path
import struct

import numpy as np
from scipy.spatial import cKDTree
from scipy.spatial.transform import Rotation
from scipy.optimize import linear_sum_assignment
from shapely import Polygon, unary_union

OWN = Path(__file__).resolve().parent
ROOT = OWN.parents[2]
DTYPES = {5123: '<u2', 5125: '<u4', 5126: '<f4'}
SIZES = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def surfaces(points, faces):
    planes = {}
    for face in faces:
        tri = points[list(face)]
        normal = np.cross(tri[1] - tri[0], tri[2] - tri[0])
        length = np.linalg.norm(normal)
        if length < 1e-10:
            continue
        normal /= length
        axis = int(np.argmax(np.abs(normal)))
        if normal[axis] < 0:
            normal *= -1
        key = (*np.round(normal, 5), round(float(normal @ tri[0]), 4))
        planes.setdefault(key, []).append(Polygon(np.delete(tri, axis, axis=1)))
    return {key: unary_union(polygons) for key, polygons in planes.items()}


def read_glb(data):
    magic, version, length = struct.unpack_from('<III', data)
    assert (magic, version, length) == (0x46546C67, 2, len(data)), 'GLB inválido'
    size, kind = struct.unpack_from('<II', data, 12)
    assert kind == 0x4E4F534A
    doc = json.loads(data[20:20 + size])
    offset = 20 + size
    binary_size, kind = struct.unpack_from('<II', data, offset)
    assert kind == 0x004E4942 and offset + 8 + binary_size == len(data)
    assert len(doc['buffers']) == 1 and 'uri' not in doc['buffers'][0]
    assert not any(doc.get(k) for k in ['extensionsUsed', 'animations', 'skins', 'images'])
    assert len(doc['scenes']) == 1 and doc.get('scene', 0) == 0
    assert sorted(doc['scenes'][0]['nodes']) == list(range(len(doc['nodes'])))
    binary = data[offset + 8:]

    def accessor(index):
        item = doc['accessors'][index]
        assert not item.get('sparse') and not item.get('normalized')
        view = doc['bufferViews'][item['bufferView']]
        dtype, width = np.dtype(DTYPES[item['componentType']]), SIZES[item['type']]
        stride = view.get('byteStride', dtype.itemsize * width)
        start = view.get('byteOffset', 0) + item.get('byteOffset', 0)
        end = start + (item['count'] - 1) * stride + width * dtype.itemsize
        assert end <= view.get('byteOffset', 0) + view['byteLength'] <= len(binary)
        return np.ndarray((item['count'], width), dtype=dtype, buffer=binary,
                          offset=start, strides=(stride, dtype.itemsize)).copy()

    return doc, accessor


def check(glb, model):
    doc, accessor = read_glb(glb)
    assert {m['name'] for m in doc['meshes']} == set(model['geometries'])
    meshes, errors, triangles = {}, [], 0
    for i, mesh in enumerate(doc['meshes']):
        name = mesh['name']
        assert len(mesh['primitives']) == 1
        primitive = mesh['primitives'][0]
        assert primitive.get('mode', 4) == 4
        geo = model['geometries'][name]
        source = np.column_stack([np.array(geo[key]).reshape(-1, n)
                                  for key, n in [('position', 3), ('normal', 3), ('uv', 2)]])
        unique = np.unique(source, axis=0)
        points, inverse = np.unique(source[:, :3], axis=0, return_inverse=True)
        attributes = primitive['attributes']
        assert {'POSITION', 'NORMAL'} <= set(attributes) <= {'POSITION', 'NORMAL', 'TEXCOORD_0'}
        if 'TEXCOORD_0' in attributes:
            uv = accessor(attributes['TEXCOORD_0'])
            uv[:, 1] = 1 - uv[:, 1]
        else:
            assert np.all(source[:, 6:] == 0), name
            uv = np.zeros((len(accessor(attributes['POSITION'])), 2))
        actual = np.column_stack([accessor(attributes['POSITION']), accessor(attributes['NORMAL']), uv])
        # O exportador glTF inverte V em relação ao UV autoral do Blender.
        assert np.isfinite(actual).all()
        weights = np.array([1, 1, 1, .1, .1, .1, 1, 1])
        _, matched_attributes = cKDTree(unique * weights).query(actual * weights)
        delta = np.abs(actual - unique[matched_attributes])
        assert delta[:, [0, 1, 2, 6, 7]].max() < 3e-5, (name, delta.max(axis=0))
        assert delta[:, 3:6].max() < 1e-4, (name, delta.max(axis=0))
        errors.append(float(delta.max()))
        _, matches = cKDTree(points).query(actual[:, :3])
        expected = Counter(map(tuple, np.sort(inverse[np.array(geo['index']).reshape(-1, 3)], axis=1)))
        actual_tris = matches[accessor(primitive['indices']).reshape(-1, 3)]
        actual_faces = Counter(map(tuple, np.sort(actual_tris, axis=1)))
        material = doc['materials'][primitive['material']]
        if actual_faces != expected:
            # Paredes planas da implantação têm frente/verso duplicados na
            # autoria; o glTF os entrega uma vez com o PBR de duas faces.
            assert material.get('doubleSided'), name
            before, after = surfaces(points, expected), surfaces(points, actual_faces)
            assert set(before) == set(after), name
            assert all(before[k].symmetric_difference(after[k]).area < 1e-8 for k in before), name
        assert material['name'].startswith('MAT-')
        material_name = material['name']
        reference = model['materials'][material_name]
        pbr = material['pbrMetallicRoughness']
        assert np.allclose(pbr.get('baseColorFactor', [1] * 4)[:3], reference['color'], atol=1e-7, rtol=0)
        assert abs(pbr.get('roughnessFactor', 1) - reference['roughness']) < 1e-7
        assert abs(pbr.get('metallicFactor', 1) - reference['metalness']) < 1e-7
        meshes[i] = (name, material_name, len(actual_tris))

    expected_instances = {}
    for group in model['groups']:
        key = (group['geometry'], group['material'])
        assert key not in expected_instances
        expected_instances[key] = [np.array(i['matrix']).reshape(4, 4, order='F') for i in group['instances']]
    actual_instances = {}
    for node in doc['nodes']:
        assert not node.get('children') and set(node) <= {'mesh', 'name', 'matrix', 'translation', 'rotation', 'scale'}
        name, material, count = meshes[node['mesh']]
        if 'matrix' in node:
            matrix = np.array(node['matrix']).reshape(4, 4, order='F')
        else:
            matrix = np.eye(4)
            matrix[:3, :3] = Rotation.from_quat(node.get('rotation', [0, 0, 0, 1])).as_matrix() @ np.diag(node.get('scale', [1] * 3))
            matrix[:3, 3] = node.get('translation', [0] * 3)
        actual_instances.setdefault((name, material), []).append(matrix)
        triangles += count
    assert set(actual_instances) == set(expected_instances)
    for key, expected in expected_instances.items():
        actual = actual_instances[key]
        assert len(actual) == len(expected), key
        distances = np.linalg.norm(np.array(actual)[:, None] - np.array(expected)[None, :], axis=(2, 3))
        rows, columns = linear_sum_assignment(distances)
        assert distances[rows, columns].max() < 4e-5, (key, distances[rows, columns].max())
    return {'status': 'PASS', 'meshes': len(meshes), 'instances': len(doc['nodes']),
            'materials': len(doc['materials']), 'triangles': triangles,
            'maxVertexAttributeError': max(errors), 'topology': 'all geometric triangles matched; duplicate backfaces are doubleSided',
            'transforms': 'all instances matched', 'units': 'meters', 'up': 'Y'}


def build(own=OWN):
    model_bytes = (own / 'variante/modelo.json').read_bytes()
    model = json.loads(model_bytes)
    assert all(sha((ROOT / p).read_bytes()) == h for p, h in model['metadata']['recipeSources'].items())
    glb_path = own / 'variante/liv-contorno.glb'
    glb = glb_path.read_bytes()
    validation = check(glb, model)
    return {'schema': 'liv-map-model-v1', 'edition': 'contorno', 'sourceModelSHA256': sha(model_bytes),
            'asset': {'path': 'modelo/variante/liv-contorno.glb', 'bytes': len(glb), 'sha256': sha(glb)},
            'validation': validation, 'lighting': 'map-lights', 'dimensionsInferred': True,
            'sources': {p.relative_to(ROOT).as_posix(): sha(p.read_bytes()) for p in
                        [Path(__file__), own / 'variante/modelo.json', glb_path]}}


if __name__ == '__main__':
    result = build()
    (OWN / 'variante/mapa.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf8')
    print(json.dumps(result['validation']))

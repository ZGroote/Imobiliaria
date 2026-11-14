"""Atlas UV exclusivo do LIV, com coordenadas independentes por instancia.

Execute com Python que contenha numpy/xatlas. Nunca usa atlas de outro modelo.
"""
from pathlib import Path
import argparse
import base64
import gzip
import hashlib
import json
import time

import numpy as np
import xatlas


HERE = Path(__file__).resolve().parent
EXCLUDED = ('vidro', 'glass', 'folha', 'folhagem', 'vegetacao',
            'vegetação', 'arvore', 'árvore', 'palmeira', 'luz-varanda', 'agua', 'água')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def topology(geo):
    pos = np.asarray(geo['position'], dtype=np.float64).reshape(-1, 3)
    normal = np.asarray(geo['normal'], dtype=np.float64).reshape(-1, 3)
    indices = np.asarray(geo.get('index') or range(len(pos)), dtype=np.uint32).reshape(-1, 3)
    cross = np.cross(pos[indices[:, 1]] - pos[indices[:, 0]],
                     pos[indices[:, 2]] - pos[indices[:, 0]])
    good = np.linalg.norm(cross, axis=1) > 1e-10
    indices = indices[good].copy()
    flip = np.einsum('ij,ij->i', cross[good], normal[indices[:, 0]]) < 0
    indices[flip] = indices[flip][:, [0, 2, 1]]
    return pos, indices, int(flip.sum()), int((~good).sum())


def selected(group, material):
    name = group['material'].lower()
    if any(word in name for word in EXCLUDED):
        return False
    return material.get('metalness', 0) < .75 and material.get('opacity', 1) >= .5


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model', type=Path, default=HERE / 'modelo.json')
    parser.add_argument('--out', type=Path, default=HERE / 'luz')
    parser.add_argument('--size', type=int, default=4096, choices=(512, 1024, 2048, 4096))
    parser.add_argument('--padding', type=int, default=4)
    args = parser.parse_args()
    started = time.perf_counter()
    source = args.model.read_bytes()
    model = json.loads(source)
    args.out.mkdir(parents=True, exist_ok=True)
    atlas = xatlas.Atlas()
    records, batches, excluded = [], {}, []
    flipped = degenerate = triangle_count = 0

    for group_index, group in enumerate(model['groups']):
        if not selected(group, model['materials'][group['material']]):
            excluded.append({'groupIndex': group_index, 'geometry': group['geometry'],
                             'reason': 'dynamic glass/metal/foliage or emissive detail'})
            continue
        geo = model['geometries'][group['geometry']]
        pos, indices, flip_count, degenerate_count = topology(geo)
        if not len(indices):
            continue
        # Shared normals/texture vertices are welded only for xatlas topology.
        _, first, inverse = np.unique(np.round(pos, 6), axis=0,
                                      return_index=True, return_inverse=True)
        batches[group_index] = {'groupIndex': group_index, 'geometry': group['geometry'],
                                'material': group['material'], 'tower': group['tower'],
                                'role': group['role'], 'sourceVertexCount': len(pos),
                                'indices': indices.reshape(-1).tolist(), 'instances': []}
        for instance_index, instance in enumerate(group['instances']):
            matrix = np.asarray(instance['matrix'], dtype=np.float64).reshape(4, 4).T
            world = (np.c_[pos[first], np.ones(len(first))] @ matrix.T)[:, :3]
            atlas.add_mesh(np.asarray(world, dtype=np.float32),
                           np.asarray(inverse[indices], dtype=np.uint32))
            records.append((group_index, instance_index, instance, pos, indices, first))
            triangle_count += len(indices)
        flipped += flip_count * len(group['instances'])
        degenerate += degenerate_count * len(group['instances'])

    if not records:
        raise RuntimeError('Modelo nao possui superficies elegiveis para luz assada')
    print('LIV_UNWRAP_START', len(records), 'instances', triangle_count, 'triangles', flush=True)
    pack = xatlas.PackOptions()
    pack.resolution = args.size
    pack.padding = args.padding
    pack.bilinear = True
    charts = xatlas.ChartOptions()
    charts.max_iterations = 2
    atlas.generate(chart_options=charts, pack_options=pack)
    if atlas.atlas_count != 1:
        raise RuntimeError(f'xatlas gerou {atlas.atlas_count} atlas; aumente --size ou reduza padding')
    mapped = 0
    for slot, (group_index, instance_index, instance, pos, indices, first) in enumerate(records):
        mapping, triangles, uv = atlas[slot]
        if not np.allclose(pos[first][mapping[triangles]], pos[indices], atol=2e-6):
            raise RuntimeError('xatlas mudou a ordem dos cantos de triangulos')
        corners = uv[triangles].reshape(-1, 2)
        if not np.isfinite(corners).all() or corners.min() < 0 or corners.max() > 1:
            raise RuntimeError('Coordenadas UV invalidas')
        # uint16 changes a UV by at most .0313 pixel in a 4096px atlas.
        quantized = np.rint(corners * 65535).astype('<u2')
        batches[group_index]['instances'].append({
            'instanceIndex': instance_index, 'floor': instance['floor'],
            'uv1U16': base64.b64encode(quantized.tobytes()).decode('ascii')})
        mapped += len(corners)

    compact = {'schema': 'liv-lightmap-corners-v1', 'sourceSHA256': digest(source),
               'uvEncoding': 'base64-uint16-le', 'uvScale': 65535,
               'groups': list(batches.values())}
    encoded = json.dumps(compact, separators=(',', ':')).encode('utf8')
    (args.out / 'source-modelo.json').write_bytes(source)
    (args.out / 'geometry-compact.json').write_bytes(encoded)
    (args.out / 'geometry-compact.json.gz').write_bytes(gzip.compress(encoded, compresslevel=9, mtime=0))
    report = {'schema': compact['schema'], 'sourceSHA256': compact['sourceSHA256'],
              'modelPath': str(args.model.resolve()), 'size': args.size,
              'atlasWidth': atlas.width, 'atlasHeight': atlas.height,
              'atlasCount': atlas.atlas_count, 'utilization': atlas.utilization,
              'groups': len(batches), 'instances': len(records), 'triangles': triangle_count,
              'mappedCorners': mapped, 'flippedTriangles': flipped,
              'degenerateTrianglesRemoved': degenerate, 'padding': args.padding,
              'effectivePaddingPixels': args.padding * args.size / max(atlas.width, atlas.height),
              'uvMaxPixelError': args.size / 65535 / 2,
              'geometrySHA256': digest(encoded),
              'geometryBytes': len(encoded),
              'geometryGzipBytes': (args.out / 'geometry-compact.json.gz').stat().st_size,
              'excludedGroups': excluded, 'seconds': time.perf_counter() - started,
              'checks': {'oneAtlas': True, 'cornerOrderPreserved': True,
                         'finiteUV': True, 'UVInUnitSquare': True,
                         'independentInstanceUV': True}}
    (args.out / 'unwrap.json').write_text(json.dumps(report, indent=2), encoding='utf8')
    print('LIV_UNWRAP_COMPLETE', json.dumps(report), flush=True)


if __name__ == '__main__':
    main()

"""Exporta apenas peças existentes e seus metadados; não escreve no catálogo web."""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import struct
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'entrega/LIV_Luz_Natural.blend'
DEST = ROOT.parent / 'liv-experimental-2026-10-14/interiores/melhorias'
LOCAL = ROOT / 'fontes/materiais-web/complementos'
EXPECTED_SHA = '517be435ec7072839a9088f2675c264e7fd297ff7c0f98c2bb2534035017db88'
SPECS = {
    'cortinas-janela': {'names': ['R2 | Cortina linho', 'R2 | Cortina linho.001'], 'anchor': 'janela da sala'},
    'pendente-jantar': {'names': ['R2 | Pendente jantar', 'R2 | Cabo pendente'], 'anchor': 'mesa de jantar'},
    'fruteira-jantar': {'names': ['R2 | Fruteira'], 'anchor': 'mesa de jantar'},
    'painel-tv-ripas': {'prefix': 'R2 | Ripado painel TV', 'count': 28, 'anchor': 'parede do painel TV'},
}


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def bounds(objects):
    points = [obj.matrix_world @ v.co for obj in objects for v in obj.data.vertices]
    return Vector([min(v[i] for v in points) for i in range(3)]), Vector([max(v[i] for v in points) for i in range(3)])


def as_three(low, high):
    return {'min': [low.x, low.z, -high.y], 'max': [high.x, high.z, -low.y]}


def local_signature(obj):
    """Cache conservador: só nós locais, mesma geometria, material e base linear."""
    digest = hashlib.sha256()
    mesh = obj.data
    for mat in mesh.materials:
        if not mat or not mat.use_nodes:
            return None
        for node in mat.node_tree.nodes:
            if node.type in ('GEOMETRY', 'OBJECT_INFO', 'LIGHT_PATH', 'ATTRIBUTE', 'TEX_ENVIRONMENT'):
                return None
            if node.type == 'TEX_COORD':
                used = {socket.name for socket in node.outputs if socket.is_linked}
                if node.object is not None or not used <= {'Object', 'Generated', 'UV'}:
                    return None
        digest.update(mat.get('web_source_material', mat.name).encode('utf-8'))
    for field, count, kind, items in (
            ('co', 3, np.float32, mesh.vertices),
            ('vertex_index', 1, np.int32, mesh.loops),
            ('loop_start', 1, np.int32, mesh.polygons),
            ('loop_total', 1, np.int32, mesh.polygons),
            ('material_index', 1, np.int32, mesh.polygons),
            ('use_smooth', 1, np.bool_, mesh.polygons)):
        values = np.empty(len(items) * count, dtype=kind)
        items.foreach_get(field, values)
        digest.update(values.tobytes())
    normals = np.empty(len(mesh.corner_normals) * 3, dtype=np.float32)
    mesh.corner_normals.foreach_get('vector', normals)
    digest.update(normals.tobytes())
    for layer in mesh.uv_layers:
        digest.update(layer.name.encode('utf-8'))
        values = np.empty(len(layer.data) * 2, dtype=np.float32)
        layer.data.foreach_get('uv', values)
        digest.update(values.tobytes())
    # Posição não muda Object/Generated/UV locais. Escala/giro precisam coincidir.
    digest.update(np.asarray(obj.matrix_world.to_3x3(), dtype=np.float32).tobytes())
    return digest.hexdigest()


def convert_materials(objects, converter, asset_id, max_size):
    cache, conversions, reuse = {}, [], []
    for obj in objects:
        signature = local_signature(obj)
        if signature and signature in cache:
            cached = cache[signature]
            obj.data = cached.data.copy()
            reuse.append({'object': obj['web_source_object'], 'from': cached['web_source_object'], 'localGeometryMaterialBasisSHA256': signature})
            continue
        dimension = max(obj.dimensions)
        resolution = min(max_size, max(64, 2 ** math.ceil(math.log2(max(.1, dimension) * 512))))
        conversions.append(converter.prepare_export_materials([obj], LOCAL / asset_id, max_size=resolution))
        if signature:
            cache[signature] = obj
    result = {'bakeLighting': False, 'method': 'source material-channel bake in CPU; geometry unchanged',
              'bakedImages': sum(len(row['images']) for row in conversions),
              'warnings': [warning for row in conversions for warning in row.get('warnings', [])],
              'materialBakeReuse': reuse,
              'thinTranslucency': {'sourceUsed': False, 'introduced': False,
                'note': 'Source R2 materials use opaque Principled (Alpha=1, Transmission=0); no separate Translucent lobe exists or is approximated.'}}
    (LOCAL / (asset_id + '-materiais.json')).write_text(json.dumps({'summary': result, 'conversions': conversions}, indent=2, ensure_ascii=False), encoding='utf-8')
    return result


def glb_info(path):
    blob = path.read_bytes()
    magic, version, length = struct.unpack_from('<III', blob)
    assert (magic, version, length) == (0x46546C67, 2, len(blob))
    size, chunk_type = struct.unpack_from('<II', blob, 12)
    assert chunk_type == 0x4E4F534A
    model = json.loads(blob[20:20 + size])
    assert not model.get('cameras') and not model.get('animations')
    assert 'KHR_lights_punctual' not in model.get('extensions', {})
    assert all('bufferView' in im for im in model.get('images', []))
    assert all(not item.get('uri') for item in model.get('buffers', []))
    assert all(max(mat.get('emissiveFactor', [0, 0, 0])) == 0 for mat in model.get('materials', []))
    accessors = [model['accessors'][p['attributes']['POSITION']] for mesh in model['meshes'] for p in mesh['primitives']]
    low = [min(a['min'][i] for a in accessors) for i in range(3)]
    high = [max(a['max'][i] for a in accessors) for i in range(3)]
    triangles = sum(model['accessors'][p['indices']]['count'] // 3 for mesh in model['meshes'] for p in mesh['primitives'])
    for mesh in model['meshes']:
        for primitive in mesh['primitives']:
            mat = model['materials'][primitive['material']]
            if mat.get('normalTexture'):
                assert 'TANGENT' in primitive['attributes'], ('Normal tangente sem base exportada', mesh.get('name'))
    return {'bytes': len(blob), 'sha256': hashlib.sha256(blob).hexdigest(),
            'triangles': triangles, 'meshes': len(model['meshes']),
            'textures': len(model.get('textures', [])), 'materials': [m.get('name') for m in model.get('materials', [])],
            'canonicalBounds': {'min': low, 'max': high}}


def export_asset(source_scene, asset_id, exporter, converter, max_size):
    spec = SPECS[asset_id]
    if 'names' in spec:
        originals = [source_scene.objects[name] for name in spec['names']]
    else:
        originals = sorted([o for o in source_scene.objects if o.name.startswith(spec['prefix'])], key=lambda o: o.name)
        assert len(originals) == spec['count']
    assert all(o.type in ('MESH', 'CURVE') and not o.hide_render for o in originals)
    scene = bpy.data.scenes.new('WEB COMPLEMENT | ' + asset_id)
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 1
    objects = exporter.duplicate_for_export(originals, scene, render_density=True)
    for obj, original in zip(objects, originals):
        obj['web_source_object'] = original.name
    low, high = bounds(objects)
    reference = as_three(low, high)
    pivot = Vector(((low.x + high.x) / 2, (low.y + high.y) / 2, low.z))
    position = [pivot.x, pivot.z, -pivot.y]
    triangulated = []
    for obj in objects:
        # glTF precisa triangular n-gons de qualquer forma. Fazê-lo antes do bake
        # permite gerar a mesma base tangente para o normalmap e para a exportação.
        if any(len(face.vertices) > 4 for face in obj.data.polygons):
            bpy.context.view_layer.objects.active = obj
            modifier = obj.modifiers.new('WEB | n-gons para tangentes', 'TRIANGULATE')
            modifier.min_vertices = 5
            if hasattr(modifier, 'keep_custom_normals'):
                modifier.keep_custom_normals = True
            bpy.ops.object.modifier_apply(modifier=modifier.name)
            triangulated.append(obj['web_source_object'])
    conversion = convert_materials(objects, converter, asset_id, max_size)
    conversion['sourceNgonsTriangulatedForTangents'] = triangulated
    canonical = Matrix.Translation(-pivot)
    for obj in objects:
        obj.data = obj.data.copy()
        obj.data.transform(canonical @ obj.matrix_world)
        obj.matrix_world = Matrix.Identity(4)
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    path = DEST / (asset_id + '.glb')
    kwargs = {'filepath': str(path), 'export_format': 'GLB', 'use_selection': True, 'use_active_scene': True,
              'export_apply': True, 'export_materials': 'EXPORT', 'export_image_format': 'AUTO', 'export_yup': True,
              'export_animations': False, 'export_cameras': False, 'export_lights': False, 'export_extras': True,
              'export_skins': False, 'export_morph': False, 'export_tangents': True}
    parameters = bpy.ops.export_scene.gltf.get_rna_type().properties
    bpy.ops.export_scene.gltf(**{k: v for k, v in kwargs.items() if k in parameters})
    info = glb_info(path)
    expected = {'min': [reference['min'][i] - position[i] for i in range(3)],
                'max': [reference['max'][i] - position[i] for i in range(3)]}
    error = max(abs(info['canonicalBounds'][side][i] - expected[side][i]) for side in ('min', 'max') for i in range(3))
    assert error < 1e-5, (asset_id, error)
    world = {side: [info['canonicalBounds'][side][i] + position[i] for i in range(3)] for side in ('min', 'max')}
    dimensions = dict(zip(('w', 'h', 'd'), [info['canonicalBounds']['max'][i] - info['canonicalBounds']['min'][i] for i in range(3)]))
    result = {'id': asset_id, 'path': path.name, 'types': [], 'pivot': 'center-xz-base-y', 'front': '+Z',
              'dimensions': dimensions,
              'source': {'objects': [o.name for o in originals], 'pivotBlender': list(pivot),
                         'positionThree': position, 'rotationQuarterTurns': 0,
                         'coordinates': 'Three=(Blender.x,Blender.z,-Blender.y)'},
              'sourceAnchorCanto': spec['anchor'], 'worldBoundsCanto': world,
              'sourceWorldBoundsCanto': reference, 'sourcePoseMaxAbsErrorMeters': error,
              'replaces': [], 'materialConversion': conversion, **info}
    print('COMPLEMENT_OK', asset_id, info['bytes'], info['triangles'], error, flush=True)
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--asset', default='all', choices=('all', *SPECS))
    parser.add_argument('--max-size', type=int, default=1024)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    assert 64 <= args.max_size <= 1024
    before = sha(SOURCE)
    assert before == EXPECTED_SHA
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    source_scene = bpy.data.scenes['03 | Sala e jantar']
    bpy.context.window.scene = source_scene
    DEST.mkdir(parents=True, exist_ok=True)
    LOCAL.mkdir(parents=True, exist_ok=True)
    exporter = module('complement_source_exporter', ROOT / 'exportar-web.py')
    converter = module('complement_material_converter', ROOT / 'materiais-web.py')
    output = DEST / 'complementos.json'
    metadata = json.loads(output.read_text(encoding='utf-8')) if output.exists() else {'assets': []}
    metadata.update({'schema': 'liv-interior-complements-v1', 'complete': False,
                     'sourceBlendSha256': before,
                     'sourceBlend': {'path': 'experimentos/liv-luz-natural-2026-10-26/entrega/LIV_Luz_Natural.blend', 'scene': source_scene.name, 'sha256': before},
                     'integration': 'Merge assets and decorations by assetId into the main catalog; this script never writes catalogo.json.',
                     'exporterSHA256': sha(Path(__file__)), 'materialConverterSHA256': sha(ROOT / 'materiais-web.py')})
    for asset_id in SPECS if args.asset == 'all' else (args.asset,):
        result = export_asset(source_scene, asset_id, exporter, converter, args.max_size)
        metadata['assets'] = [a for a in metadata['assets'] if a['id'] != asset_id] + [result]
        metadata['decorations'] = [{'assetId': a['id'], 'typology': 'canto', 'position': a['source']['positionThree'],
                                    'yaw': 0, 'dimensions': a['dimensions']} for a in metadata['assets']]
        output.write_text(json.dumps(metadata, indent=2, ensure_ascii=False), encoding='utf-8')
    assert sha(SOURCE) == before
    metadata['complete'] = set(a['id'] for a in metadata['assets']) == set(SPECS)
    metadata['sourceBlendSHA256After'] = sha(SOURCE)
    output.write_text(json.dumps(metadata, indent=2, ensure_ascii=False), encoding='utf-8')
    print('COMPLEMENTS_COMPLETE', metadata['complete'], len(metadata['assets']), sum(a['bytes'] for a in metadata['assets']), before, flush=True)


if __name__ == '__main__':
    main()

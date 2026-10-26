"""Exporta cópias dos móveis aprovados para glTF, sem alterar o .blend fonte."""
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


def specifications(scene):
    visible = [o for o in scene.objects if o.type in ('MESH', 'CURVE') and not o.hide_render]
    def asset(label):
        return [o for o in visible if o.get('R3_asset') == label]
    def collection(name):
        return [o for o in bpy.data.collections[name].objects if o.type in ('MESH', 'CURVE') and not o.hide_render]
    result = {
        'sofa': {'objects': asset('Sofa linho'), 'types': ['sofa'], 'rot': 3, 'replaces': ['movel-7']},
        'mesa-jantar': {'objects': asset('Mesa jantar'), 'types': ['mesa'], 'namePattern': 'jantar', 'rot': 0, 'replaces': ['movel-10']},
        'cadeira-jantar': {'objects': [o for o in asset('Cadeira 1') if o.name.startswith('R3 | Cadeira 1 |')], 'types': ['cadeira'], 'rot': 0, 'replaces': ['movel-11', 'movel-12', 'movel-13', 'movel-14', 'movel-25', 'movel-26']},
        'geladeira': {'objects': asset('Geladeira'), 'types': ['geladeira'], 'rot': 3, 'replaces': ['movel-17']},
        'fogao': {'objects': asset('Fogao'), 'types': ['fogao'], 'rot': 3, 'replaces': ['movel-15']},
        'pia-cozinha': {'objects': collection('R3 | Cozinha detalhada'), 'types': ['pia'], 'namePattern': 'cozinha', 'rot': 3, 'fitHeightReference': .91, 'replaces': ['movel-16']},
        'planta': {'objects': asset('Planta Poly Haven'), 'types': ['planta'], 'rot': 0, 'replaces': []},
        'quadro': {'objects': collection('R3 | Arte impressa'), 'types': ['quadro'], 'rot': 2, 'replaces': []},
    }
    result['mesa-varanda'] = {'objects': [o for o in visible if o.name in ('mesh-83', 'mesh-84', 'mesh-85', 'mesh-86', 'mesh-87')], 'types': ['mesa'], 'namePattern': 'varanda', 'rot': 0, 'replaces': ['movel-24']}
    result['cadeira-varanda-lateral'] = {'objects': [o for o in visible if o.name.startswith('R3 | Cadeira 6 |')], 'types': ['cadeira'], 'namePattern': 'varanda.*2', 'rot': 1, 'replaces': ['movel-26']}
    result['mesa-apoio'] = {'objects': [o for o in visible if o.name in ('R2 | Mesa de apoio redonda', 'R2 | Tampo carvalho mesa de apoio', 'R2 | Vaso mesa de apoio')], 'types': [], 'rot': 0, 'replaces': []}
    result['livros-rack'] = {'objects': [o for o in visible if o.name.startswith(('R2 | Livro areia', 'R2 | Livro verde'))], 'types': [], 'rot': 0, 'replaces': []}
    instances = []
    for index, (furniture_id, rotation) in enumerate(zip(('movel-11', 'movel-12', 'movel-13', 'movel-14', 'movel-25', 'movel-26'), (0, 0, 2, 2, 0, 1)), 1):
        group = [o for o in visible if o.name.startswith('R3 | Cadeira ' + str(index) + ' |')]
        corners = [o.matrix_world @ Vector(c) for o in group for c in o.bound_box]
        low = [min(v[i] for v in corners) for i in range(3)]
        high = [max(v[i] for v in corners) for i in range(3)]
        instances.append({'furnitureId': furniture_id, 'positionThree': [(low[0] + high[0]) / 2, low[2], -(low[1] + high[1]) / 2], 'rotationQuarterTurns': rotation})
    result['cadeira-jantar']['instances'] = instances
    sample_scene = bpy.data.scenes.new('WEB | Amostras materiais aprovados')
    samples = []
    material_names = {}
    for index, (target, name) in enumerate((('wall', 'LIV | Interior-m0'), ('wood-floor', 'LIV | SketchUp - Carvalho claro'), ('tile-floor', 'LIV | SketchUp - Carrara acetinado'))):
        mesh = bpy.data.meshes.new('WEB sample | ' + target)
        mesh.from_pydata([(0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0)], [], [(0, 1, 2, 3)])
        uv = mesh.uv_layers.new(name='UVMap')
        for loop, value in zip(uv.data, ((0, 0), (1, 0), (1, 1), (0, 1))):
            loop.uv = value
        mesh.materials.append(bpy.data.materials[name])
        obj = bpy.data.objects.new('WEB approved sample | ' + target, mesh)
        obj.location = (index * 1.1, 0, index * .01)
        sample_scene.collection.objects.link(obj)
        samples.append(obj)
        material_names[name] = 'web-' + target
    result['acabamentos'] = {'objects': samples, 'types': [], 'rot': 0, 'replaces': [], 'reuseUV': True, 'materialNames': material_names}
    return result


def glb_info(path):
    data = path.read_bytes()
    magic, version, length = struct.unpack_from('<III', data)
    assert magic == 0x46546C67 and version == 2 and length == len(data)
    size, kind = struct.unpack_from('<II', data, 12)
    assert kind == 0x4E4F534A
    gltf = json.loads(data[20:20 + size])
    assert not gltf.get('cameras') and not gltf.get('animations')
    assert 'KHR_lights_punctual' not in gltf.get('extensions', {})
    assert all('bufferView' in im for im in gltf.get('images', [])), 'Textura externa no GLB'
    assert all(max(m.get('emissiveFactor', [0, 0, 0])) == 0 for m in gltf.get('materials', [])), 'Emission exportada'
    triangles = sum(gltf['accessors'][p['indices']]['count'] // 3 for mesh in gltf.get('meshes', []) for p in mesh['primitives'] if 'indices' in p)
    return {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'triangles': triangles, 'meshes': len(gltf.get('meshes', [])), 'textures': len(gltf.get('textures', [])), 'materials': [m.get('name') for m in gltf.get('materials', [])]}


def duplicate_for_export(objects, scene, render_density=False):
    copies = []
    materials = {}
    bpy.context.window.scene = scene
    for source in objects:
        obj = source.copy()
        obj.data = source.data.copy()
        obj.name = 'WEB | ' + source.name
        scene.collection.objects.link(obj)
        # One extra subdivision preserves the cloth silhouette without exporting
        # the render-only density. The final source is never saved or modified.
        for modifier in obj.modifiers:
            if modifier.type == 'SUBSURF':
                modifier.levels = modifier.render_levels if render_density else min(modifier.levels, 1)
        bpy.context.view_layer.update()
        evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        mesh = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=bpy.context.evaluated_depsgraph_get())
        transform = obj.matrix_world.copy()
        bpy.data.objects.remove(obj, do_unlink=True)
        obj = bpy.data.objects.new('WEB | ' + source.name, mesh)
        obj.matrix_world = transform
        scene.collection.objects.link(obj)
        for index, mat in enumerate(obj.data.materials):
            if mat:
                if mat not in materials:
                    materials[mat] = mat.copy()
                    materials[mat]['web_source_material'] = mat.name
                obj.data.materials[index] = materials[mat]
        copies.append(obj)
    bpy.context.view_layer.update()
    return copies


def source_bounds(scene):
    report = {'sourceBlendSha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(), 'density': 'original render modifier levels; no web decimation', 'assets': []}
    specs = specifications(scene)
    for key, spec in specs.items():
        if key == 'acabamentos':
            continue
        groups = [(key, spec['objects'])]
        if key == 'cadeira-jantar':
            groups = [(entry['furnitureId'], [o for o in scene.objects if o.name.startswith('R3 | Cadeira ' + str(index) + ' |') and not o.hide_render]) for index, entry in enumerate(spec['instances'], 1)]
        entries = []
        for label, originals in groups:
            temporary = bpy.data.scenes.new('SOURCE BOUNDS | ' + label)
            copies = duplicate_for_export(originals, temporary, render_density=True)
            minimum = np.full(3, np.inf)
            maximum = np.full(3, -np.inf)
            triangles = 0
            for obj in copies:
                values = np.empty(len(obj.data.vertices) * 3, dtype=np.float32)
                obj.data.vertices.foreach_get('co', values)
                matrix = np.array(obj.matrix_world)
                points = values.reshape(-1, 3) @ matrix[:3, :3].T + matrix[:3, 3]
                minimum = np.minimum(minimum, points.min(axis=0))
                maximum = np.maximum(maximum, points.max(axis=0))
                obj.data.calc_loop_triangles()
                triangles += len(obj.data.loop_triangles)
            entries.append({'id': label, 'sourceObjects': [o.name for o in originals], 'blenderBounds': {'min': minimum.tolist(), 'max': maximum.tolist()}, 'threeBounds': {'min': [minimum[0], minimum[2], -maximum[1]], 'max': [maximum[0], maximum[2], -minimum[1]]}, 'trianglesRender': triangles})
            bpy.context.window.scene = scene
            for obj in copies:
                mesh = obj.data
                bpy.data.objects.remove(obj, do_unlink=True)
                if mesh.users == 0:
                    bpy.data.meshes.remove(mesh)
            bpy.data.scenes.remove(temporary)
        report['assets'].append({'id': key, 'instances': entries} if key == 'cadeira-jantar' else {'id': key, **entries[0]})
        print('SOURCE_BOUNDS_OK', key, flush=True)
    target = ROOT / 'fontes/export_web_source_bounds.json'
    target.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print('SOURCE_BOUNDS_COMPLETE', str(target), flush=True)


def export_asset(key, spec, direct=False):
    assert spec['objects'], ('Asset sem geometria', key)
    scene = bpy.data.scenes.new('WEB EXPORT | ' + key)
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 1
    objects = duplicate_for_export(spec['objects'], scene)
    if direct:
        assert all(not any(n.type in ('BUMP', 'TEX_NOISE') for n in m.node_tree.nodes) for o in objects for m in o.data.materials if m and m.use_nodes), 'Material procedural requer helper'
        conversion = {'method': 'native image-based PBR', 'illumination_baked': False}
    else:
        path = ROOT / 'materiais-web.py'
        module_spec = importlib.util.spec_from_file_location('materiais_web', path)
        module = importlib.util.module_from_spec(module_spec)
        module_spec.loader.exec_module(module)
        conversion = {'objects': [], 'images': [], 'bakeLighting': False}
        buckets = {}
        for obj in objects:
            dimension = max(obj.dimensions)
            resolution = min(1024, max(64, 2 ** math.ceil(math.log2(max(.1, dimension) * 512))))
            buckets.setdefault(resolution, []).append(obj)
        for resolution, group in sorted(buckets.items()):
            result = module.prepare_export_materials(group, ROOT / 'fontes/materiais-web' / key, max_size=1024 if spec.get('reuseUV') else resolution, reuse_existing_uv=bool(spec.get('reuseUV')))
            for field in ('objects', 'images'):
                conversion[field].extend(result.get(field, []))
            if result.get('warnings'):
                conversion.setdefault('warnings', []).extend(result['warnings'])
    if spec.get('materialNames'):
        for obj in objects:
            for mat in obj.data.materials:
                source_name = mat.get('web_source_material')
                if source_name in spec['materialNames']:
                    mat.name = spec['materialNames'][source_name]
    corners = [o.matrix_world @ v.co for o in objects for v in o.data.vertices]
    low = Vector([min(v[i] for v in corners) for i in range(3)])
    high = Vector([max(v[i] for v in corners) for i in range(3)])
    pivot = Vector(((low.x + high.x) / 2, (low.y + high.y) / 2, low.z))
    canonical = Matrix.Rotation(-spec['rot'] * math.pi / 2, 4, 'Z') @ Matrix.Translation(-pivot)
    for obj in objects:
        obj.data.transform(canonical @ obj.matrix_world)
        obj.matrix_world = Matrix.Identity(4)
    bpy.context.view_layer.update()
    for obj in objects:
        obj.data.calc_loop_triangles()
    total = sum(len(o.data.loop_triangles) for o in objects)
    ratio = max(.1, min(1, 60000 / max(1, total)))
    if ratio < 1:
        for obj in objects:
            if len(obj.data.polygons) > 512:
                bpy.context.view_layer.objects.active = obj
                mod = obj.modifiers.new('Web tessellation', 'DECIMATE')
                mod.ratio = ratio
                bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    output = DEST / (key + '.glb')
    kwargs = {'filepath': str(output), 'export_format': 'GLB', 'use_selection': True, 'use_active_scene': True, 'export_apply': True, 'export_materials': 'EXPORT', 'export_image_format': 'AUTO', 'export_yup': True, 'export_animations': False, 'export_cameras': False, 'export_lights': False, 'export_extras': True, 'export_skins': False, 'export_morph': False, 'export_tangents': True}
    parameters = bpy.ops.export_scene.gltf.get_rna_type().properties
    bpy.ops.export_scene.gltf(**{name: value for name, value in kwargs.items() if name in parameters})
    bpy.context.view_layer.update()
    corners = [v.co for o in objects for v in o.data.vertices]
    size = [max(v[i] for v in corners) - min(v[i] for v in corners) for i in range(3)]
    info = glb_info(output)
    result = {'id': key, 'path': output.name, 'types': spec['types'], 'pivot': 'center-xz-base-y', 'front': '+Z', 'dimensions': {'w': size[0], 'h': size[2], 'd': size[1]}, 'source': {'objects': [o.name for o in spec['objects']], 'pivotBlender': list(pivot), 'positionThree': [pivot.x, pivot.z, -pivot.y], 'rotationQuarterTurns': spec['rot'], 'coordinates': 'Three=(Blender.x,Blender.z,-Blender.y)'}, 'replaces': spec['replaces'], 'materialConversion': conversion, **info}
    for optional in ('namePattern', 'fitHeightReference', 'instances'):
        if optional in spec:
            result[optional] = spec[optional]
    native = json.loads((DEST.parent / 'canto/unidade.json').read_text(encoding='utf-8'))['planta']['moveis']
    reference = next((f for f in native if f['tipo'] in spec['types'] and (not spec.get('namePattern') or __import__('re').search(spec['namePattern'], f['nome'], __import__('re').I))), None)
    if reference:
        result['referenceFootprintCanto'] = {name: reference[name] for name in ('w', 'h', 'd')}
    print('WEB_ASSET_OK', json.dumps({k: result[k] for k in ('id', 'bytes', 'triangles', 'textures', 'dimensions')}, ensure_ascii=False), flush=True)
    return result


def export(scene, key, direct):
    DEST.mkdir(parents=True, exist_ok=True)
    specs = specifications(scene)
    catalog_path = DEST / 'catalogo.json'
    catalog = json.loads(catalog_path.read_text(encoding='utf-8')) if catalog_path.exists() else {'schema': 'liv-interior-improvements-v1', 'complete': False, 'assets': [], 'decorations': [], 'materialOverrides': []}
    catalog['sourceBlendSha256'] = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    catalog['sourceBlend'] = {'path': 'experimentos/liv-luz-natural-2026-10-26/entrega/LIV_Luz_Natural.blend', 'scene': scene.name, 'sha256': catalog['sourceBlendSha256']}
    catalog['hiddenSourceObjects'] = [{'name': o.name, 'sourceSlot': o.get('LIV_source_slot')} for o in scene.objects if o.hide_render and o.get('LIV_source_slot') is not None]
    catalog['complete'] = False
    catalog_path.write_text(json.dumps(catalog, indent=2, ensure_ascii=False), encoding='utf-8')
    keys = list(specs) if key == 'all' else [key]
    for name in keys:
        result = export_asset(name, specs[name], direct)
        catalog['assets'] = [a for a in catalog['assets'] if a['id'] != name] + [result]
        catalog_path.write_text(json.dumps(catalog, indent=2, ensure_ascii=False), encoding='utf-8')
    if (DEST / 'ceu.json').exists():
        catalog['environment'] = json.loads((DEST / 'ceu.json').read_text(encoding='utf-8'))
    if any(a['id'] == 'acabamentos' for a in catalog['assets']):
        catalog['materialOverrides'] = [{'target': target, 'assetId': 'acabamentos', 'materialName': 'web-' + target} for target in ('wall', 'wood-floor', 'tile-floor')]
    catalog_path.write_text(json.dumps(catalog, indent=2, ensure_ascii=False), encoding='utf-8')


def bounds(obj):
    points = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return [[min(p[i] for p in points) for i in range(3)], [max(p[i] for p in points) for i in range(3)]]


def inventory(scene):
    rows = []
    for obj in scene.objects:
        if obj.type not in ('MESH', 'CURVE') or obj.hide_render:
            continue
        rows.append({'name': obj.name, 'type': obj.type, 'asset': obj.get('R3_asset'), 'bounds': bounds(obj), 'vertices': len(obj.data.vertices) if obj.type == 'MESH' else None, 'modifiers': [{'name': m.name, 'type': m.type} for m in obj.modifiers], 'materials': [m.name for m in obj.data.materials if m]})
    mats = []
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        users = [o.name for o in scene.objects if o.type == 'MESH' and not o.hide_render and mat in list(o.data.materials)]
        if not users:
            continue
        nodes = []
        for node in mat.node_tree.nodes:
            if node.type in ('TEX_COORD', 'TEX_IMAGE', 'NORMAL_MAP', 'BUMP', 'BSDF_PRINCIPLED', 'TEX_NOISE'):
                row = {'name': node.name, 'type': node.type}
                if node.type == 'TEX_COORD':
                    row['object'] = node.object.name if node.object else None
                    row['used_outputs'] = [s.name for s in node.outputs if s.is_linked]
                if node.type == 'TEX_IMAGE':
                    row['image'] = node.image.name if node.image else None
                    row['size'] = list(node.image.size) if node.image else None
                if node.type == 'BSDF_PRINCIPLED':
                    row['inputs'] = {s.name: {'linked': s.is_linked, 'value': list(s.default_value) if hasattr(s.default_value, '__len__') else s.default_value} for s in node.inputs if s.name in ('Base Color', 'Roughness', 'Metallic', 'Transmission Weight', 'Alpha')}
                nodes.append(row)
        mats.append({'name': mat.name, 'users': users[:8], 'nodes': nodes})
    report = {'source_sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(), 'objects': rows, 'materials': mats}
    (ROOT / 'fontes/export_web_inventario.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print('WEB_INVENTORY_OK', len(rows), len(mats), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--mode', choices=('inventory', 'source-bounds', 'export'), default='inventory')
    parser.add_argument('--asset', default='all')
    parser.add_argument('--direct', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    original = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    scene = bpy.data.scenes['03 | Sala e jantar']
    bpy.context.window.scene = scene
    bpy.context.view_layer.update()
    if args.mode == 'inventory':
        inventory(scene)
    elif args.mode == 'source-bounds':
        source_bounds(scene)
    else:
        export(scene, args.asset, args.direct)
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == original

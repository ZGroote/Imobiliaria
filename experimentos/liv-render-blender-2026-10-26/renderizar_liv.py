"""Cenas Cycles a partir do snapshot do arquivo LIV efetivamente aberto no SketchUp."""
import argparse
import json
import math
from pathlib import Path
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector
import numpy as np

ROOT = Path(__file__).resolve().parent
DELIVERY = ROOT / 'entrega'
BLEND = DELIVERY / 'LIV_Ipanema_Render.blend'


def enum_set(owner, name, requested):
    available = [item.identifier for item in owner.bl_rna.properties[name].enum_items]
    # Algumas enums dinamicas do Blender 5.2 retornam apenas NONE pela RNA.
    try:
        setattr(owner, name, requested)
    except (TypeError, ValueError) as error:
        raise ValueError((name, requested, available)) from error


def srgb(c):
    x = c / 255
    return x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4


def socket(node, name, value):
    target = next((i for i in node.inputs if i.name == name and i.enabled), None)
    if target is not None:
        target.default_value = value


def gpu():
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'CUDA'
    prefs.refresh_devices()
    enabled = []
    for device in prefs.devices:
        device.use = device.type == 'CUDA'
        if device.use:
            enabled.append(device.name)
    if not enabled:
        raise RuntimeError('Nao foi encontrado dispositivo CUDA')
    print('CUDA:', enabled, flush=True)


def make_material(key, spec):
    mat = bpy.data.materials.new(spec['name'])
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    color = tuple(srgb(v) for v in spec['color']) + (1,)
    socket(bsdf, 'Base Color', color)
    name = spec['name'].lower()
    roughness = spec.get('roughness', .65)
    # Os fatores de mapas do SketchUp Classic retornam 1 mesmo sem metal.
    # Somente materiais identificados como metais recebem reflexao condutora.
    metalness = 0
    if any(x in name for x in ('algod', 'tecido', 'bed |', 'sofa |')):
        roughness = .85
        socket(bsdf, 'Sheen Weight', .22)
    elif 'carvalho' in name:
        roughness = .42
    elif 'marcenaria' in name or 'madeira' in name:
        roughness = .46
    elif 'carrara' in name:
        roughness = .28
    elif 'metal' in name or 'inox' in name or 'esquadria' in name or 'interior-m3' in name:
        roughness, metalness = .3, .7
    elif any(x in name for x in ('reboco', 'bege', 'interior-m0')):
        roughness = .82
    socket(bsdf, 'Roughness', max(.04, roughness))
    socket(bsdf, 'Metallic', metalness)
    if spec.get('color_map'):
        texture = nodes.new('ShaderNodeTexImage')
        texture.image = bpy.data.images.load(spec['color_map'], check_existing=True)
        enum_set(texture.image.colorspace_settings, 'name', 'sRGB')
        links.new(texture.outputs['Color'], bsdf.inputs['Base Color'])
        texture.label = 'Cor exportada do SketchUp com as alteracoes de tonalidade'
    for field, input_name in [('roughness_map', 'Roughness'), ('metallic_map', 'Metallic')]:
        if spec.get(field):
            texture = nodes.new('ShaderNodeTexImage')
            texture.image = bpy.data.images.load(spec[field], check_existing=True)
            enum_set(texture.image.colorspace_settings, 'name', 'Non-Color')
            links.new(texture.outputs['Color'], bsdf.inputs[input_name])
    if spec.get('normal_map'):
        texture = nodes.new('ShaderNodeTexImage')
        texture.image = bpy.data.images.load(spec['normal_map'], check_existing=True)
        enum_set(texture.image.colorspace_settings, 'name', 'Non-Color')
        normal = nodes.new('ShaderNodeNormalMap')
        normal.inputs['Strength'].default_value = min(spec.get('normal_scale', .2), .4)
        links.new(texture.outputs['Color'], normal.inputs['Color'])
        links.new(normal.outputs['Normal'], bsdf.inputs['Normal'])
    elif any(x in name for x in ('reboco', 'interior-m0', 'bed |', 'sofa |', 'folha', 'grama')):
        noise = nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 180 if ('bed |' in name or 'sofa |' in name) else 90
        noise.inputs['Detail'].default_value = 2
        position = nodes.new('ShaderNodeNewGeometry')
        links.new(position.outputs['Position'], noise.inputs['Vector'])
        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .16
        bump.inputs['Distance'].default_value = .001 if 'folha' in name else .0006
        links.new(noise.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    glass = 'vidro' in name or 'interior-m4' in name
    if glass:
        socket(bsdf, 'Base Color', (.82, .91, .94, 1))
        socket(bsdf, 'Transmission Weight', .94)
        socket(bsdf, 'Roughness', .055)
        socket(bsdf, 'Metallic', 0)
        socket(bsdf, 'IOR', 1.45)
    if 'site-agua' in name:
        socket(bsdf, 'Base Color', (.12, .42, .52, 1))
        socket(bsdf, 'Transmission Weight', .55)
        socket(bsdf, 'Roughness', .08)
        socket(bsdf, 'IOR', 1.333)
        noise = nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 5
        noise.inputs['Detail'].default_value = 3
        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .25
        bump.inputs['Distance'].default_value = .018
        links.new(noise.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    if 'folha' in name or 'palmeira' in name:
        socket(bsdf, 'Subsurface Weight', .05)
        socket(bsdf, 'Roughness', .76)
    mat.diffuse_color = color
    mat['SketchUp_material_id'] = key
    return mat


def matrix(values):
    return Matrix([values[i:i + 4] for i in range(0, 16, 4)]).transposed()


def import_snapshot(data):
    materials = {k: make_material(k, v) for k, v in data['materials'].items()}
    default = bpy.data.materials.new('MAT | Neutro')
    meshes = {}
    for key, record in data['geometries'].items():
        vertices = np.asarray(record['points'], dtype=np.float32).reshape(-1, 3)
        faces = np.asarray(record['triangles'], dtype=np.int32).reshape(-1, 3)
        mesh = bpy.data.meshes.new(record['name'])
        mesh.from_pydata(vertices.tolist(), [], faces.tolist())
        mesh.update()
        ids = list(dict.fromkeys(str(i) for i in record['materials']))
        for mid in ids:
            mesh.materials.append(materials.get(mid, default))
        mapping = {mid: i for i, mid in enumerate(ids)}
        mesh.polygons.foreach_set('material_index', [mapping[str(i)] for i in record['materials']])
        mesh.polygons.foreach_set('use_smooth', [True] * len(mesh.polygons))
        coords = np.asarray(record['uv'], dtype=np.float32).reshape(-1, 2)
        uv = mesh.uv_layers.new(name='UV | SketchUp')
        uv.data.foreach_set('uv', coords[faces.flatten()].flatten())
        normals = np.asarray(record['normals'], dtype=np.float32).reshape(-1, 3)
        mesh.normals_split_custom_set_from_vertices(normals.tolist())
        meshes[key] = mesh
    collections = {}
    for category in ('exterior', 'apartamento'):
        collections[category] = bpy.data.collections.new('LIV | ' + category)
    for item in data['objects']:
        obj = bpy.data.objects.new(item['name'], meshes[item['geometry']])
        obj.matrix_world = matrix(item['matrix'])
        obj['LIV_source_slot'] = item['source_slot'] if item['source_slot'] is not None else -1
        obj['LIV_role'] = item.get('role') or 'geometry'
        collections[item['category']].objects.link(obj)
    return collections


def make_cutaway(source):
    collection = bpy.data.collections.new('LIV | Apartamento em corte')
    cutter_mesh = bpy.data.meshes.new('AUX | Caixa de corte')
    v = [(-12, -12, -1), (12, -12, -1), (12, 12, -1), (-12, 12, -1),
         (-12, -12, 1.15), (12, -12, 1.15), (12, 12, 1.15), (-12, 12, 1.15)]
    cutter_mesh.from_pydata(v, [], [(3, 2, 1, 0), (0, 1, 5, 4), (1, 2, 6, 5),
                                  (2, 3, 7, 6), (3, 0, 4, 7), (4, 5, 6, 7)])
    cutter = bpy.data.objects.new('AUX | Corte a 1,15 m', cutter_mesh)
    bpy.context.scene.collection.objects.link(cutter)
    cutter.hide_render = True
    for original in source.objects:
        if original.get('LIV_role') == 'ceiling':
            continue
        obj = original.copy()
        obj.name = 'CORTE | ' + original.name
        collection.objects.link(obj)
        if original.get('LIV_source_slot') == 0:
            record = json.loads((ROOT / 'fontes/parede-corte.json').read_text(encoding='utf-8'))
            mesh = bpy.data.meshes.new('GEO | Paredes do corte - planta publicada')
            mesh.from_pydata(record['vertices'], [], record['faces'])
            mesh.materials.append(original.data.materials[0])
            bm = bmesh.new()
            bm.from_mesh(mesh)
            bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.000001)
            bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
            bm.to_mesh(mesh)
            bm.free()
            obj.data = mesh
            obj.matrix_world = Matrix.Identity(4)
            continue
        coords = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
        if min(p.z for p in coords) < 1.15 < max(p.z for p in coords):
            obj.data = original.data.copy()
            obj.data.transform(obj.matrix_world)
            obj.matrix_world = Matrix.Identity(4)
            bm = bmesh.new()
            bm.from_mesh(obj.data)
            bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.00001)
            bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
            bm.to_mesh(obj.data)
            bm.free()
            if original.get('LIV_source_slot') in (53, 60):
                for polygon in obj.data.polygons:
                    polygon.use_smooth = False
                obj.data.normals_split_custom_set([(0, 0, 0)] * len(obj.data.loops))
            mod = obj.modifiers.new('Corte limpo a 1,15 m', 'BOOLEAN')
            enum_set(mod, 'operation', 'INTERSECT')
            enum_set(mod, 'solver', 'EXACT')
            mod.use_self = True
            mod.use_hole_tolerant = True
            mod.object = cutter
    # O volume de corte e ligado apenas a cena da planta; nao aparece no render.
    collection.objects.link(cutter)
    bpy.context.scene.collection.objects.unlink(cutter)
    return collection


def world(scene, sky=False):
    world = bpy.data.worlds.new('WORLD | ' + scene.name)
    world.use_nodes = True
    nodes, links = world.node_tree.nodes, world.node_tree.links
    nodes.clear()
    output = nodes.new('ShaderNodeOutputWorld')
    lighting = nodes.new('ShaderNodeBackground')
    if sky:
        texture = nodes.new('ShaderNodeTexSky')
        types = [i.identifier for i in texture.bl_rna.properties['sky_type'].enum_items]
        enum_set(texture, 'sky_type', 'MULTIPLE_SCATTERING' if 'MULTIPLE_SCATTERING' in types else 'NISHITA')
        texture.sun_elevation = math.radians(38)
        texture.sun_rotation = math.radians(135)
        texture.sun_disc = False
        lighting.inputs['Strength'].default_value = .28
        links.new(texture.outputs['Color'], lighting.inputs['Color'])
    else:
        lighting.inputs['Color'].default_value = (.78, .82, .88, 1)
        lighting.inputs['Strength'].default_value = .45
    camera_background = nodes.new('ShaderNodeBackground')
    camera_background.inputs['Color'].default_value = (.78, .76, .71, 1)
    camera_background.inputs['Strength'].default_value = 1
    path = nodes.new('ShaderNodeLightPath')
    mix = nodes.new('ShaderNodeMixShader')
    links.new(path.outputs['Is Camera Ray'], mix.inputs[0])
    links.new(lighting.outputs[0], mix.inputs[1])
    links.new(camera_background.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs[0])
    scene.world = world


def aim(obj, point):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def area(scene, name, position, target, power, size, color=(1, .93, .83)):
    light = bpy.data.lights.new(name, 'AREA')
    light.energy, light.size, light.color = power, size, color
    obj = bpy.data.objects.new(name, light)
    scene.collection.objects.link(obj)
    obj.location = position
    aim(obj, target)
    return obj


def sun(scene, energy=2):
    light = bpy.data.lights.new('LGT | Sol suave', 'SUN')
    light.energy = energy
    light.angle = math.radians(5)
    light.color = (1, .93, .82)
    obj = bpy.data.objects.new(light.name, light)
    scene.collection.objects.link(obj)
    obj.rotation_euler = (math.radians(28), math.radians(-35), math.radians(-40))


def floor(scene, objects, size):
    z = min((o.matrix_world @ Vector(v)).z for o in objects for v in o.bound_box) - .015
    mesh = bpy.data.meshes.new('GEO | Fundo de estudio')
    half = size / 2
    mesh.from_pydata([(-half, -half, z), (half, -half, z), (half, half, z), (-half, half, z)], [], [(0, 1, 2, 3)])
    obj = bpy.data.objects.new(mesh.name, mesh)
    scene.collection.objects.link(obj)
    mat = bpy.data.materials.new('MAT | Fundo mineral claro')
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    socket(bsdf, 'Base Color', (.72, .70, .65, 1))
    socket(bsdf, 'Roughness', .87)
    mesh.materials.append(mat)


def camera(scene, objects, position, target, ortho=False, lens=50, margin=.86):
    data = bpy.data.cameras.new('CAM | ' + scene.name)
    obj = bpy.data.objects.new(data.name, data)
    scene.collection.objects.link(obj)
    obj.location = position
    aim(obj, target)
    data.clip_start, data.clip_end = .03, 1500
    data.lens = lens
    scene.camera = obj
    if ortho:
        enum_set(data, 'type', 'ORTHO')
        inverse = obj.matrix_world.inverted()
        # Atualiza matriz explicita: o depsgraph ainda nao avaliou a rotacao.
        obj.matrix_world = obj.matrix_basis
        inverse = obj.matrix_world.inverted()
        points = [inverse @ (o.matrix_world @ Vector(v)) for o in objects for v in o.bound_box]
        xmin, xmax = min(p.x for p in points), max(p.x for p in points)
        ymin, ymax = min(p.y for p in points), max(p.y for p in points)
        aspect = scene.render.resolution_x / scene.render.resolution_y
        data.ortho_scale = max(xmax - xmin, (ymax - ymin) * aspect) / margin
        shift = obj.matrix_world.to_3x3() @ Vector(((xmin + xmax) / 2, (ymin + ymax) / 2, 0))
        obj.location += shift
    data.show_composition_thirds = True
    return obj


def settings(scene, resolution, interior=False):
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'GPU'
    scene.cycles.samples = 256 if interior else 192
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = .012
    scene.cycles.adaptive_min_samples = 32
    scene.cycles.use_denoising = True
    enum_set(scene.cycles, 'denoiser', 'OPENIMAGEDENOISE')
    scene.cycles.max_bounces = 10
    scene.cycles.diffuse_bounces = 5
    scene.cycles.glossy_bounces = 5
    scene.cycles.transmission_bounces = 10
    scene.cycles.transparent_max_bounces = 12
    scene.cycles.sample_clamp_indirect = 4
    scene.render.resolution_x, scene.render.resolution_y = resolution
    scene.render.resolution_percentage = 100
    enum_set(scene.render.image_settings, 'file_format', 'PNG')
    enum_set(scene.render.image_settings, 'color_mode', 'RGB')
    enum_set(scene.render.image_settings, 'color_depth', '16')
    enum_set(scene.view_settings, 'view_transform', 'AgX')
    looks = [i.identifier for i in scene.view_settings.bl_rna.properties['look'].enum_items]
    selected = next((v for v in looks if 'Medium High Contrast' in v), None)
    if selected:
        scene.view_settings.look = selected
    scene.view_settings.exposure = .35 if interior else .1
    scene.render.film_transparent = False


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    DELIVERY.mkdir(exist_ok=True)
    data = json.loads((ROOT / 'fontes' / 'liv-sketchup.json').read_text(encoding='utf-8'))
    assert len([o for o in data['objects'] if o['category'] == 'exterior']) == 862
    collections = import_snapshot(data)
    exterior = bpy.context.scene
    exterior.name = '01 | Condominio LIV'
    exterior.collection.children.link(collections['exterior'])
    settings(exterior, (2560, 1600))
    world(exterior, sky=True)
    objects = list(collections['exterior'].objects)
    floor(exterior, objects, 500)
    sun(exterior, 1.7)
    camera(exterior, objects, (140, -190, 112), (5, -4, 22), ortho=True, margin=.88)
    cut_collection = make_cutaway(collections['apartamento'])
    plan = bpy.data.scenes.new('02 | Apartamento decorado')
    plan.collection.children.link(cut_collection)
    settings(plan, (2400, 2000))
    world(plan)
    plan_objects = [o for o in cut_collection.objects if o.type == 'MESH' and not o.hide_render]
    floor(plan, plan_objects, 200)
    area(plan, 'LGT | Softbox principal', (-3, -5, 9), (0, 0, 0), 2300, 7)
    area(plan, 'LGT | Preenchimento', (6, 4, 7), (0, 0, 0), 1000, 6, (.88, .93, 1))
    camera(plan, plan_objects, (10, -14, 21), (0, 0, .6), ortho=True, margin=.88)
    interior = bpy.data.scenes.new('03 | Sala e jantar')
    interior.collection.children.link(collections['apartamento'])
    settings(interior, (2048, 1280), interior=True)
    world(interior, sky=True)
    sun(interior, 1.15)
    camera(interior, [], (.05, -2.55, 1.55), (2.55, .15, 1.15), lens=22)
    area(interior, 'LGT | Luz da varanda', (2.4, 4.1, 2.4), (1.1, -.8, 1), 650, 3, (.92, .96, 1))
    area(interior, 'LGT | Luz da suite', (-5.2, .9, 2.4), (-2.5, .9, 1), 180, 2, (.94, .97, 1))
    for i, p in enumerate([(-2.9, 1.0), (-.15, 1.55), (2.2, .3), (.3, -1.8), (-2.7, -1.9), (-1.35, -1.9)]):
        area(interior, 'LGT | Plafon ' + str(i + 1), (p[0], p[1], 2.61), (p[0], p[1], 0),
             45 if i < 4 else 20, .55, (1, .86, .68))
    for scene, filename in ((exterior, 'LIV_exterior.png'), (plan, 'LIV_apartamento.png'), (interior, 'LIV_sala.png')):
        scene['LIV_fonte'] = data['source']
        scene['LIV_unidades'] = 'metros'
        scene.render.filepath = '//'+ filename
    gpu()
    bpy.context.window.scene = exterior
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    report = {'fonte': data['source'], 'geometrias': len(data['geometries']),
              'objetos': len(data['objects']), 'materiais': len(data['materials']),
              'cenas': [s.name for s in (exterior, plan, interior)], 'blend': str(BLEND)}
    (DELIVERY / 'preparo.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print('BUILD_OK', json.dumps(report, ensure_ascii=False), flush=True)


def render(stage, shot):
    bpy.ops.wm.open_mainfile(filepath=str(BLEND))
    gpu()
    output = ROOT / ('previas' if stage == 'draft' else 'entrega')
    output.mkdir(exist_ok=True)
    scenes = {'exterior': '01 | Condominio LIV', 'apartamento': '02 | Apartamento decorado', 'sala': '03 | Sala e jantar'}
    selected = scenes.keys() if shot == 'all' else [shot]
    for key in selected:
        scene = bpy.data.scenes[scenes[key]]
        scene.cycles.device = 'GPU'
        if scene.camera is None:
            raise RuntimeError('Cena sem camera: ' + scene.name)
        if stage == 'draft':
            scene.render.resolution_percentage = 40
            scene.cycles.samples = 32
            scene.cycles.adaptive_min_samples = 8
            scene.cycles.adaptive_threshold = .07
            scene.render.image_settings.color_depth = '8'
        scene.render.filepath = str(output / ('LIV_' + key + '.png'))
        print('RENDER_BEGIN', key, scene.render.filepath, flush=True)
        bpy.ops.render.render(write_still=True, scene=scene.name)
        assert Path(scene.render.filepath).is_file()
        print('RENDER_OK', key, Path(scene.render.filepath).stat().st_size, flush=True)


def finish():
    bpy.ops.wm.open_mainfile(filepath=str(BLEND))
    outputs = {'01 | Condominio LIV': 'exterior', '02 | Apartamento decorado': 'apartamento', '03 | Sala e jantar': 'sala'}
    report = {'blender': bpy.app.version_string, 'engine': 'Cycles', 'images': [], 'source_objects': {}}
    for name, key in outputs.items():
        scene = bpy.data.scenes[name]
        path = DELIVERY / ('LIV_' + key + '.png')
        assert path.is_file() and path.stat().st_size > 100000
        image = bpy.data.images.load(str(path), check_existing=False)
        assert tuple(image.size) == (scene.render.resolution_x, scene.render.resolution_y)
        report['images'].append({'file': path.name, 'resolution': list(image.size), 'bytes': path.stat().st_size})
        bpy.data.images.remove(image)
        scene.render.filepath = '//' + path.name
        # The delivered file must render without changing global GPU preferences.
        scene.cycles.device = 'CPU'
        report['source_objects'][key] = sum('LIV_source_slot' in o for o in scene.objects)
    assert report['source_objects']['exterior'] == 862
    assert report['source_objects']['sala'] == 82
    images = [i for i in bpy.data.images if i.source == 'FILE']
    assert len(images) >= 29 and all(i.packed_file for i in images)
    report['packed_textures'] = len(images)
    checked = []
    for material in bpy.data.materials:
        if any(k in material.name.lower() for k in ('carvalho', 'carrara', 'marcenaria', 'bed |', 'sofa |', 'reboco', 'interior-m0')):
            node = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
            assert node.inputs['Metallic'].default_value == 0, material.name
            checked.append(material.name)
    report['nonmetal_materials_checked'] = checked
    report['camera_check'] = all(bpy.data.scenes[name].camera for name in outputs)
    report['default_render_device'] = 'CPU'
    bpy.context.window.scene = bpy.data.scenes['01 | Condominio LIV']
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                area.spaces.active.region_3d.view_perspective = 'CAMERA'
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    report['blend_bytes'] = BLEND.stat().st_size
    report['status'] = 'aprovado'
    (DELIVERY / 'validacao.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print('VALIDATION_OK', json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--mode', choices=['build', 'draft', 'final', 'finish'], default='build')
    parser.add_argument('--shot', choices=['all', 'exterior', 'apartamento', 'sala'], default='all')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    if args.mode == 'build':
        build()
    elif args.mode == 'finish':
        finish()
    else:
        render(args.mode, args.shot)

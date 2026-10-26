"""Inspeção sem render e teste isolado do vidro no recorte que revelou Q17."""
import argparse
import importlib.util
import json
from pathlib import Path
import sys
import shutil

import bmesh
import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
BLEND = ROOT / 'entrega/LIV_Luz_Natural.blend'
OUT = ROOT / 'previas/q17'


def pipeline():
    spec = importlib.util.spec_from_file_location('liv_render', ROOT / 'renderizar.py')
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    return helper


def inspect(scene):
    materials = {m for o in scene.objects if o.type == 'MESH' and not o.hide_render for m in o.data.materials if m}
    material_rows = []
    for mat in sorted(materials, key=lambda m: m.name):
        if not mat.use_nodes:
            continue
        nodes = []
        for node in mat.node_tree.nodes:
            if node.type in ('BSDF_PRINCIPLED', 'BUMP', 'NORMAL_MAP', 'BSDF_TRANSPARENT', 'LIGHT_PATH', 'OUTPUT_MATERIAL'):
                inputs = {}
                for socket in node.inputs:
                    if socket.name in ('Subsurface Weight', 'Transmission Weight', 'Alpha', 'Strength', 'Distance', 'Normal', 'Displacement', 'Volume'):
                        value = getattr(socket, 'default_value', None)
                        inputs[socket.name] = {'linked': socket.is_linked, 'value': list(value) if value is not None and not isinstance(value, (str, float, int)) else value}
                nodes.append({'name': node.name, 'type': node.type, 'inputs': inputs})
        material_rows.append({'name': mat.name, 'nodes': nodes})
    objects = []
    for obj in scene.objects:
        if obj.type != 'MESH' or obj.hide_render:
            continue
        if not (obj.get('R3_asset') == 'Sofa linho' or any(term in obj.name.lower() for term in ('tapete', 'apoio', 'centro', 'plant', 'cubo', 'mesa'))):
            continue
        mesh = bmesh.new()
        mesh.from_mesh(obj.data)
        closed = bool(mesh.edges) and all(len(edge.link_faces) == 2 for edge in mesh.edges)
        volume = mesh.calc_volume(signed=True) * obj.matrix_world.to_3x3().determinant() if closed else None
        objects.append({'name': obj.name, 'materials': [m.name for m in obj.data.materials if m], 'modifiers': [{'name': m.name, 'type': m.type} for m in obj.modifiers], 'closed': closed, 'signed_world_volume': volume})
        mesh.free()
    report = {'materials': material_rows, 'objects': objects, 'cycles': {name: getattr(scene.cycles, name) for name in ('samples', 'sample_clamp_direct', 'sample_clamp_indirect', 'max_bounces', 'diffuse_bounces', 'transmission_bounces', 'transparent_max_bounces', 'caustics_reflective', 'caustics_refractive') if hasattr(scene.cycles, name)}}
    (ROOT / 'fontes/q17_inspecao.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    suspicious_sss = [r['name'] for r in material_rows for n in r['nodes'] if n['type'] == 'BSDF_PRINCIPLED' and (n['inputs'].get('Subsurface Weight', {}).get('linked') or (n['inputs'].get('Subsurface Weight', {}).get('value') or 0) > 0)]
    negative = [o['name'] for o in objects if o['closed'] and o['signed_world_volume'] < -1e-8]
    print('Q17_INSPECT', json.dumps({'sss_materials': suspicious_sss, 'negative_closed_meshes': negative, 'cycles': report['cycles']}, ensure_ascii=False), flush=True)
    print('WORLD_SAMPLING', {p.identifier: getattr(scene.world.cycles, p.identifier) for p in scene.world.cycles.bl_rna.properties if any(x in p.identifier for x in ('sampl', 'resolu', 'light'))}, flush=True)
    probe = bpy.data.lights.new('Q17 | Leitura API portal', 'AREA')
    print('PORTAL_SUPPORTED', hasattr(probe.cycles, 'is_portal'), flush=True)
    bpy.data.lights.remove(probe)
    points = []
    for obj in scene.objects:
        if obj.type != 'MESH' or obj.hide_render:
            continue
        for polygon in obj.data.polygons:
            if polygon.material_index >= len(obj.data.materials):
                continue
            mat = obj.data.materials[polygon.material_index]
            if mat and mat.name == 'LIV | Interior-m5':
                points.extend(obj.matrix_world @ obj.data.vertices[i].co for i in polygon.vertices)
    window = [p for p in points if 1.4 < p.y < 1.8]
    if window:
        print('WINDOW_GLASS_BOUNDS', {'min': [min(p[i] for p in window) for i in range(3)], 'max': [max(p[i] for p in window) for i in range(3)]}, flush=True)


def diffuse_glass():
    mat = bpy.data.materials['LIV | Interior-m5']
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    path = next(n for n in nodes if n.type == 'LIGHT_PATH')
    mix = next(n for n in nodes if n.type == 'MIX_SHADER' and 'Janela fina' in n.label)
    original = mix.inputs[0].links[0].from_socket
    assert original == path.outputs['Is Shadow Ray']
    either = nodes.new('ShaderNodeMath')
    either.operation = 'MAXIMUM'
    either.label = 'Q17: janela fina para sombra e luz difusa'
    links.new(original, either.inputs[0])
    links.new(path.outputs['Is Diffuse Ray'], either.inputs[1])
    links.new(either.outputs[0], mix.inputs[0])
    assert mix.inputs[1].is_linked and mix.inputs[2].is_linked


def portal(scene):
    data = bpy.data.lights.new('Q17 | Portal sem emissao', 'AREA')
    data.energy = 0
    data.shape = 'RECTANGLE'
    data.size, data.size_y = .73, 2.02
    data.cycles.is_portal = True
    obj = bpy.data.objects.new(data.name, data)
    scene.collection.objects.link(obj)
    obj.location = (2.07, 1.59, 1.085)
    obj.rotation_euler = Vector((0, -1, 0)).to_track_quat('-Z', 'Y').to_euler()
    assert data.cycles.is_portal and data.energy == 0
    report = {'emissive_light_objects': [], 'sampling_portals': [{'name': obj.name, 'type': 'AREA', 'cycles_is_portal': True, 'power_w': data.energy, 'location': list(obj.location), 'size_m': [data.size, data.size_y], 'purpose': 'sample existing World through the measured opening; no emission'}], 'persistent_in_delivery': False}
    (ROOT / 'fontes/q17_portal_inventario.json').write_text(json.dumps(report, indent=2), encoding='utf-8')


def render_test(scene, label='vidro_difuso'):
    helper = pipeline()
    helper.H.gpu()
    scene.cycles.device = 'GPU'
    assert (scene.render.resolution_x, scene.render.resolution_y) == (2048, 1536)
    scene.render.resolution_percentage = 100
    scene.render.use_border = True
    scene.render.use_crop_to_border = True
    scene.render.border_min_x, scene.render.border_max_x = 896 / 2048, 1920 / 2048
    scene.render.border_min_y, scene.render.border_max_y = 64 / 1536, 832 / 1536
    scene.view_layers[0].cycles.denoising_store_passes = True
    scene.render.image_settings.media_type = 'MULTI_LAYER_IMAGE'
    scene.render.image_settings.color_depth = '32'
    scene.render.filepath = str(OUT / ('estar_' + label + '.exr'))
    print('Q17_TEST_BEGIN', scene.cycles.samples, 'same-pixel crop <=1024x768', flush=True)
    bpy.ops.render.render(write_still=True, scene=scene.name)
    scene.render.image_settings.media_type = 'IMAGE'
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_depth = '16'
    path = OUT / ('estar_' + label + '.png')
    bpy.data.images['Render Result'].save_render(str(path), scene=scene)
    check = bpy.data.images.load(str(path), check_existing=False)
    assert 0 < check.size[0] <= 1024 and 0 < check.size[1] <= 768, list(check.size)
    print('Q17_TEST_OK', str(path), list(check.size), flush=True)
    bpy.data.images.remove(check)


def cpu_caps(scene):
    corrected = pipeline().flat_table_caps(scene)
    scene.world.node_tree.nodes['Daylight strength'].inputs['Strength'].default_value = 0
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 1
    scene.cycles.use_adaptive_sampling = False
    scene.cycles.use_denoising = False
    scene.render.resolution_percentage = 100
    scene.render.use_border = True
    scene.render.use_crop_to_border = True
    scene.render.border_min_x, scene.render.border_max_x = 896 / 2048, 1920 / 2048
    scene.render.border_min_y, scene.render.border_max_y = 64 / 1536, 832 / 1536
    scene.view_layers[0].use_pass_normal = True
    tree = bpy.data.node_groups.new('Q17 | Normal geometricamente plano', 'CompositorNodeTree')
    tree.interface.new_socket(name='Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    layers = tree.nodes.new('CompositorNodeRLayers')
    layers.scene = scene
    output = tree.nodes.new('NodeGroupOutput')
    tree.links.new(layers.outputs['Normal'], output.inputs['Image'])
    scene.compositing_node_group = tree
    scene.render.compositor_device = 'CPU'
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_depth = '16'
    scene.render.dither_intensity = 0
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0
    scene.render.filepath = str(OUT / 'mesa_tampas_planas_normal_cpu.png')
    bpy.ops.render.render(write_still=True, scene=scene.name)
    report = {'corrected': corrected, 'source_unchanged': True, 'device': 'CPU', 'samples': 1, 'world_strength': 0, 'normal_pass': scene.render.filepath}
    (ROOT / 'fontes/q17_tampas_planas.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('FLAT_CAPS_CPU_OK', json.dumps(report), flush=True)


def apply_portal(scene):
    helper = pipeline()
    backup = ROOT / 'fontes/q17_original'
    backup.mkdir(exist_ok=True)
    for original in (BLEND, ROOT / 'entrega/LIV_estar_dia.png', ROOT / 'entrega/LIV_jantar_dia.png', ROOT / 'entrega/validacao.json'):
        target = backup / original.name
        if not target.exists():
            shutil.copy2(original, target)
    existing = [o for o in scene.objects if o.type == 'LIGHT' and o.data.type == 'AREA' and o.data.cycles.is_portal]
    assert len(existing) <= 1, 'Portais de amostragem duplicados'
    if not existing:
        helper.daylight_sampling_portal(scene, bpy.data.scenes['04 | Jantar e cozinha'])
    caps = helper.flat_table_caps(scene)
    report = helper.audit(scene)
    report['corrected_table_caps'] = caps
    helper.pack_images()
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    bpy.ops.wm.open_mainfile(filepath=str(BLEND))
    reopened = helper.audit(bpy.data.scenes['03 | Sala e jantar'])
    assert len(reopened['sampling_portals']) == 1 and not reopened['artificial_lights']
    (ROOT / 'fontes/origem_da_luz.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print('PORTAL_CAPS_APPLIED', json.dumps(report, ensure_ascii=False), flush=True)


def blackout(scene):
    folder = ROOT / 'previas/diagnostico'
    png = folder / 'LIV_estar_apagado.png'
    backup = folder / 'LIV_estar_apagado_8bit_original.png'
    if not backup.exists():
        shutil.copy2(png, backup)
    scene.world.node_tree.nodes['Daylight strength'].inputs['Strength'].default_value = 0
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 1
    scene.cycles.use_adaptive_sampling = False
    scene.cycles.use_denoising = False
    scene.render.resolution_percentage = 38
    scene.render.dither_intensity = 0
    scene.render.image_settings.media_type = 'IMAGE'
    scene.render.image_settings.file_format = 'OPEN_EXR'
    scene.render.image_settings.color_depth = '32'
    exr = folder / 'LIV_estar_apagado.exr'
    scene.render.filepath = str(exr)
    bpy.ops.render.render(write_still=True, scene=scene.name)
    image = bpy.data.images.load(str(exr), check_existing=False)
    pixels = np.empty(len(image.pixels), dtype=np.float32)
    image.pixels.foreach_get(pixels)
    rgb = pixels.reshape(-1, 4)[:, :3]
    maximum = float(rgb.max())
    assert np.isfinite(rgb).all() and maximum == 0, ('Luz residual em EXR linear', maximum)
    size = list(image.size)
    bpy.data.images.remove(image)
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_depth = '16'
    bpy.data.images['Render Result'].save_render(str(png), scene=scene)
    report = {'source': str(exr), 'linear_rgb_max': maximum, 'resolution': size, 'samples': 1, 'dither': 0, 'old_png8_preserved': str(backup)}
    (ROOT / 'fontes/blackout_linear.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('BLACKOUT_LINEAR_OK', json.dumps(report), flush=True)


def passes(scene, redenoise=False, label='vidro_difuso'):
    prefix = '' if label == 'vidro_difuso' else label + '_'
    if label == 'portal':
        portal(scene)
    image = bpy.data.images.load(str(OUT / ('estar_' + label + '.exr')), check_existing=False)
    tree = bpy.data.node_groups.new('Q17 | Passes existentes', 'CompositorNodeTree')
    node = tree.nodes.new('CompositorNodeImage')
    node.image = image
    print('EXR_OUTPUTS', [(s.name, s.identifier) for s in node.outputs], flush=True)
    print('SCENE_COMPOSITOR', [p.identifier for p in scene.bl_rna.properties if 'composit' in p.identifier], flush=True)
    print('IMAGE_SELECTORS', [p.identifier for p in node.bl_rna.properties if any(x in p.identifier for x in ('layer', 'pass', 'view'))], flush=True)
    tree.interface.new_socket(name='Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    output = tree.nodes.new('NodeGroupOutput')
    conversion = bpy.data.scenes.new('Q17 | Converter EXR existente')
    conversion.render.engine = 'CYCLES'
    conversion.cycles.device = 'CPU'
    conversion.cycles.samples = 1
    conversion.cycles.use_denoising = False
    conversion.render.resolution_x, conversion.render.resolution_y = 1024, 768
    conversion.render.resolution_percentage = 100
    conversion.render.dither_intensity = 0
    conversion.render.compositor_device = 'CPU'
    conversion.render.compositor_denoise_device = 'CPU'
    conversion.render.compositor_denoise_final_quality = 'HIGH'
    conversion.render.image_settings.file_format = 'PNG'
    conversion.render.image_settings.color_depth = '16'
    conversion.compositing_node_group = tree
    camera = bpy.data.objects.new('Q17 | Camera sem geometria', bpy.data.cameras.new('Q17 | Camera'))
    conversion.collection.objects.link(camera)
    conversion.camera = camera
    bpy.context.window.scene = conversion
    if redenoise:
        denoise = tree.nodes.new('CompositorNodeDenoise')
        if hasattr(denoise, 'prefilter'):
            denoise.prefilter = 'ACCURATE'
        tree.links.new(node.outputs['Noisy Image'], denoise.inputs['Image'])
        tree.links.new(node.outputs['Denoising Albedo'], denoise.inputs['Albedo'])
        tree.links.new(node.outputs['Denoising Normal'], denoise.inputs['Normal'])
        tree.links.new(denoise.outputs['Image'], output.inputs['Image'])
        print('REDENOISE_INPUTS', [(s.name, getattr(s, 'default_value', None)) for s in denoise.inputs], flush=True)
        conversion.view_settings.view_transform = scene.view_settings.view_transform
        conversion.view_settings.look = scene.view_settings.look
        conversion.view_settings.exposure = scene.view_settings.exposure
        conversion.render.filepath = str(OUT / 'estar_redenoise_cpu.png')
        bpy.ops.render.render(write_still=True, scene=conversion.name)
        print('REDENOISE_CPU_OK', conversion.render.filepath, flush=True)
        return
    for name in ('Noisy Image', 'Denoising Normal', 'Denoising Albedo'):
        tree.links.new(node.outputs[name], output.inputs['Image'])
        conversion.view_settings.view_transform = scene.view_settings.view_transform if name == 'Noisy Image' else 'Standard'
        conversion.view_settings.look = scene.view_settings.look if name == 'Noisy Image' else 'None'
        conversion.view_settings.exposure = scene.view_settings.exposure if name == 'Noisy Image' else 0
        conversion.render.filepath = str(OUT / (prefix + name.replace(' ', '_') + '.png'))
        bpy.ops.render.render(write_still=True, scene=conversion.name)
        print('EXR_PASS_OK', conversion.render.filepath, flush=True)
        if name == 'Noisy Image':
            raw = OUT / (prefix + 'Noisy_Image_linear.exr')
            conversion.render.image_settings.file_format = 'OPEN_EXR'
            conversion.render.image_settings.color_depth = '32'
            bpy.data.images['Render Result'].save_render(str(raw), scene=conversion)
            data = bpy.data.images.load(str(raw), check_existing=False)
            values = np.empty(len(data.pixels), dtype=np.float32)
            data.pixels.foreach_get(values)
            rgba = values.reshape(-1, 4)
            luminance = rgba[:, :3] @ np.array((.2126, .7152, .0722))
            summary = {'zero_rgb_fraction': float(np.all(rgba[:, :3] == 0, axis=1).mean()), 'negative_rgb_fraction': float((rgba[:, :3] < 0).mean()), 'luminance_quantiles': np.quantile(luminance, (0, .25, .5, .75, .95, 1)).tolist(), 'alpha_min_max': [float(rgba[:, 3].min()), float(rgba[:, 3].max())]}
            summary['source'] = str(OUT / ('estar_' + label + '.exr'))
            (ROOT / ('fontes/q17_' + prefix + 'noisy_stats.json')).write_text(json.dumps(summary, indent=2), encoding='utf-8')
            print('NOISY_STATS', json.dumps(summary), flush=True)
            bpy.data.images.remove(data)
            conversion.render.image_settings.file_format = 'PNG'
            conversion.render.image_settings.color_depth = '16'


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--mode', choices=('inspect', 'test', 'test_mis', 'test_portal', 'cpu_caps', 'apply', 'blackout', 'passes', 'redenoise'), default='inspect')
    parser.add_argument('--source', default='vidro_difuso', choices=('vidro_difuso', 'mis_none', 'portal'))
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    OUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(BLEND))
    scene = bpy.data.scenes['03 | Sala e jantar']
    bpy.context.window.scene = scene
    bpy.context.view_layer.update()
    if args.mode == 'inspect':
        inspect(scene)
    elif args.mode == 'test':
        diffuse_glass()
        render_test(scene)
    elif args.mode == 'test_mis':
        scene.world.cycles.sampling_method = 'NONE'
        render_test(scene, 'mis_none')
    elif args.mode == 'test_portal':
        portal(scene)
        render_test(scene, 'portal')
    elif args.mode == 'cpu_caps':
        cpu_caps(scene)
    elif args.mode == 'apply':
        apply_portal(scene)
    elif args.mode == 'blackout':
        blackout(scene)
    else:
        passes(scene, args.mode == 'redenoise', args.source)

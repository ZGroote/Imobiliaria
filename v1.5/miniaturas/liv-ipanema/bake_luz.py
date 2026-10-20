"""Cycles DIRECT+INDIRECT diffuse transport, exclusive to the prepared LIV model.

blender -b --python bake_luz.py -- --samples 64
Colors stay in the viewer material: bake.use_pass_color is explicitly False.
"""
from pathlib import Path
import argparse
import base64
import gzip
import hashlib
import json
import math
import sys
import time

import bpy
import numpy as np
from mathutils import Matrix, Vector


HERE = Path(__file__).resolve().parent
BASIS = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))


def sha(data):
    return hashlib.sha256(data).hexdigest()


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def compute_device(scene):
    preferences = bpy.context.preferences.addons['cycles'].preferences
    for backend in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI', 'METAL'):
        try:
            preferences.compute_device_type = backend
            preferences.get_devices()
            available = [d for d in preferences.devices if d.type == backend]
            if not available:
                continue
            for device in preferences.devices:
                device.use = device.type == backend
            scene.cycles.device = 'GPU'
            return backend, [d.name for d in available]
        except (TypeError, ValueError, RuntimeError):
            continue
    scene.cycles.device = 'CPU'
    return 'CPU', []


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=HERE / 'luz')
    parser.add_argument('--samples', type=int, default=64)
    parser.add_argument('--range', type=float, default=16.)
    parser.add_argument('--allow-source-snapshot', action='store_true',
                        help='Testing only: report stale model instead of rejecting it')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    output = args.out
    source = (output / 'source-modelo.json').read_bytes()
    report = json.loads((output / 'unwrap.json').read_text(encoding='utf8'))
    compact_bytes = (output / 'geometry-compact.json').read_bytes()
    compact = json.loads(compact_bytes)
    if sha(source) != report['sourceSHA256'] or sha(compact_bytes) != report['geometrySHA256']:
        raise RuntimeError('Hash do snapshot/UV divergente: executar preparar_luz.py novamente')
    current_matches = sha(Path(report['modelPath']).read_bytes()) == report['sourceSHA256']
    if not current_matches and not args.allow_source_snapshot:
        raise RuntimeError('modelo.json mudou depois do UV: refazer preparar_luz.py antes de assar')
    model = json.loads(source)
    baked_groups = {g['groupIndex']: g for g in compact['groups']}
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    backend, devices = compute_device(scene)
    scene.cycles.samples = args.samples
    scene.cycles.max_bounces = 8
    scene.cycles.diffuse_bounces = 5
    scene.cycles.transparent_max_bounces = 12
    scene.cycles.use_adaptive_sampling = False
    scene.cycles.seed = 47
    scene.world = bpy.data.worlds.new('LIV daylight sky')
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get('Background')
    background.inputs['Color'].default_value = (.72, .82, 1., 1.)
    background.inputs['Strength'].default_value = .55
    scene.view_settings.view_transform = 'AgX'

    materials = {}
    for key, data in model['materials'].items():
        material = bpy.data.materials.new(key)
        material.use_nodes = True
        node = material.node_tree.nodes.get('Principled BSDF')
        node.inputs['Base Color'].default_value = (*data['color'], 1)
        node.inputs['Roughness'].default_value = data['roughness']
        node.inputs['Metallic'].default_value = data['metalness']
        node.inputs['Emission Color'].default_value = (*data.get('emissive', [0, 0, 0]), 1)
        node.inputs['Emission Strength'].default_value = data.get('emissiveIntensity', 0)
        # Glass remains in the occluder scene and transmits sky into balcony recesses.
        if 'vidro' in key.lower() or 'glass' in key.lower():
            node.inputs['Transmission Weight'].default_value = .9
            node.inputs['IOR'].default_value = 1.45
        materials[key] = material

    targets, source_triangles = [], 0
    for group_index, group in enumerate(model['groups']):
        geo = model['geometries'][group['geometry']]
        batch = baked_groups.get(group_index)
        indices = np.asarray(batch['indices'] if batch else geo.get('index') or
                             range(len(geo['position']) // 3), dtype=np.uint32).reshape(-1, 3)
        positions = np.asarray(geo['position'], dtype=np.float32).reshape(-1, 3)
        for instance_index, instance in enumerate(group['instances']):
            mesh = bpy.data.meshes.new(f'LIV-{group_index}-{instance_index}')
            mesh.from_pydata(positions.tolist(), [], indices.tolist())
            mesh.update()
            mesh.materials.append(materials[group['material']])
            if geo.get('normal'):
                normal = np.asarray(geo['normal'], dtype=np.float32).reshape(-1, 3)
                for polygon in mesh.polygons:
                    polygon.use_smooth = True
                mesh.normals_split_custom_set(normal[indices].reshape(-1, 3).tolist())
            uv0 = mesh.uv_layers.new(name='UVMap')
            uv_data = np.asarray(geo['uv'], dtype=np.float32).reshape(-1, 2)
            uv0.data.foreach_set('uv', uv_data[indices].reshape(-1))
            if batch:
                uv_record = next(item for item in batch['instances']
                                 if item['instanceIndex'] == instance_index)
                uv_array = np.frombuffer(base64.b64decode(uv_record['uv1U16']),
                                         dtype='<u2').astype(np.float32) / 65535
                if uv_array.size != len(mesh.loops) * 2:
                    raise RuntimeError('UV corner count differs from Blender loops')
                uv1 = mesh.uv_layers.new(name='Lightmap')
                uv1.data.foreach_set('uv', uv_array)
                mesh.uv_layers.active = uv1
            obj = bpy.data.objects.new(mesh.name, mesh)
            scene.collection.objects.link(obj)
            matrix = instance['matrix']
            obj.matrix_world = BASIS @ Matrix([matrix[i::4] for i in range(4)])
            source_triangles += len(mesh.polygons)
            if batch:
                targets.append(obj)
    print('LIV_BAKE_IMPORTED', len(targets), 'targets', source_triangles,
          'triangles', backend, devices, flush=True)

    light = bpy.data.lights.new('LIV neutral sun', 'SUN')
    light.energy = 2.4
    light.angle = math.radians(3)
    light.color = (1., .97, .91)
    sun = bpy.data.objects.new(light.name, light)
    scene.collection.objects.link(sun)
    # Web (-18, 110, 55), matching the viewer sun direction.
    sun.location = (-18, -55, 110)
    aim(sun, (0, 0, 22))
    bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, -.08))
    ground = bpy.context.object
    ground.name = 'LIV neutral ground bounce'
    mat = bpy.data.materials.new('LIV ground bounce')
    mat.use_nodes = True
    mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = (.27, .29, .26, 1)
    ground.data.materials.append(mat)

    bpy.ops.object.select_all(action='DESELECT')
    for obj in targets:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = targets[0]
    bpy.ops.object.join()
    target = bpy.context.object
    target.name = 'LIV independent instance transport'
    target.data.uv_layers.active = target.data.uv_layers['Lightmap']
    size = report['size']
    image = bpy.data.images.new('LIV diffuse DIRECT INDIRECT no albedo', size, size,
                                alpha=True, float_buffer=True)
    image.colorspace_settings.name = 'Non-Color'
    for material in target.data.materials:
        texture = material.node_tree.nodes.new('ShaderNodeTexImage')
        texture.image = image
        material.node_tree.nodes.active = texture
    scene.render.bake.use_clear = True
    scene.render.bake.margin = max(1, int(report['effectivePaddingPixels'] // 2))
    scene.render.bake.use_pass_color = False
    scene.render.bake.use_pass_direct = True
    scene.render.bake.use_pass_indirect = True
    scene.render.bake.target = 'IMAGE_TEXTURES'
    started = time.perf_counter()
    print('LIV_BAKE_START', size, args.samples, backend, flush=True)
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'})
    pixels = np.empty(size * size * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    pixels = pixels.reshape(size, size, 4)
    if not np.isfinite(pixels).all():
        raise RuntimeError('Non-finite radiance in baked atlas')
    rgb = np.maximum(pixels[:, :, :3], 0)
    coverage = pixels[:, :, 3] > 0
    if not coverage.any() or float(rgb.max()) < .05:
        raise RuntimeError('Empty/black radiance atlas')
    multiplier = np.maximum(1 / 255, np.ceil(np.maximum(rgb.max(axis=2), 0) / args.range * 255) / 255)
    clipped = int(np.sum(rgb.max(axis=2) > args.range))
    multiplier = np.minimum(multiplier, 1)
    encoded = np.empty((size, size, 4), dtype=np.uint8)
    encoded[:, :, :3] = np.rint(np.clip(rgb / (multiplier[:, :, None] * args.range), 0, 1) * 255).astype(np.uint8)
    encoded[:, :, 3] = np.rint(multiplier * 255).astype(np.uint8)
    raw = encoded.tobytes()
    (output / 'irradiance.rgbm.gz').write_bytes(gzip.compress(raw, compresslevel=9, mtime=0))
    # Retain the raw linear irradiance for audit/re-encoding; it is not a viewer texture.
    pixels.tofile(str(output / 'irradiance.f32'))
    image.filepath_raw = str(output / 'irradiance.exr')
    image.file_format = 'OPEN_EXR'
    image.save()
    bpy.ops.wm.save_as_mainfile(filepath=str(output / 'lightmap-scene.blend'))
    decoded = encoded[:, :, :3].astype(np.float32) / 255 * encoded[:, :, 3:4].astype(np.float32) / 255 * args.range
    error = np.abs(decoded - rgb)
    manifest = {'schema': 'liv-lightmap-v1', 'sourceSHA256': report['sourceSHA256'],
                'geometryURL': 'luz/geometry-compact.json',
                'geometryGzipURL': 'luz/geometry-compact.json.gz',
                'geometrySHA256': report['geometrySHA256'],
                'textureURL': 'luz/irradiance.rgbm.gz', 'textureCompression': 'gzip',
                'textureEncoding': 'linear-rgbm-u8', 'textureSHA256': sha(raw),
                'width': size, 'height': size, 'range': args.range,
                'origin': 'bottom-left', 'premultiplyAlpha': False,
                'lightMapIntensity': math.pi, 'samples': args.samples,
                'passes': ['DIRECT', 'INDIRECT'], 'colorPass': False,
                'sunWebPosition': [-18, 110, 55], 'sunWebTarget': [0, 22, 0],
                'sunIntensity': 2.4, 'groups': report['groups'], 'instances': report['instances'],
                'triangles': len(target.data.polygons)}
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf8')
    proof = dict(manifest, seconds=time.perf_counter() - started, backend=backend, devices=devices,
                 sourceMatchesCurrent=current_matches, totalSceneTriangles=source_triangles,
                 coveragePixels=int(coverage.sum()), radianceMin=float(rgb.min()),
                 radianceMax=float(rgb.max()), rangeClippedPixels=clipped,
                 rgbmMeanError=float(error.mean()), rgbmMaxError=float(error.max()),
                 textureBytes=len(raw), textureGzipBytes=(output / 'irradiance.rgbm.gz').stat().st_size,
                 checks={'hashesMatch': True, 'sourceMatchesCurrent': current_matches,
                         'directIndirectWithoutColor': True, 'finiteRadiance': True,
                         'nonBlackAtlas': True, 'independentInstanceUV': True,
                         'noRadianceClipping': clipped == 0})
    (output / 'bake.json').write_text(json.dumps(proof, indent=2), encoding='utf8')
    print('LIV_BAKE_COMPLETE', json.dumps(proof), flush=True)


if __name__ == '__main__':
    main()

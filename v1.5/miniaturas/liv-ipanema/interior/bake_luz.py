"""Import exact LIV browser scene, preserve split normals and bake diffuse transport.

blender -b --python interior/bake_luz.py -- --out interior/luz --samples 512
Use --import-only to save the same authoring scene without computing a lightmap.
"""
from pathlib import Path
import argparse
import base64
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


def web_position(position):
    return (position[0], -position[2], position[1])


def compute_device(scene):
    preferences = bpy.context.preferences.addons['cycles'].preferences
    for backend in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI', 'METAL'):
        try:
            preferences.compute_device_type = backend; preferences.get_devices()
            available = [d for d in preferences.devices if d.type == backend]
            if available:
                for device in preferences.devices:
                    device.use = device.type == backend
                scene.cycles.device = 'GPU'
                return backend, [d.name for d in available]
        except (TypeError, ValueError, RuntimeError):
            continue
    scene.cycles.device = 'CPU'
    return 'CPU', []


def topology(geo, material_count=None):
    positions = np.asarray(geo['position'], dtype=np.float32).reshape(-1, 3)
    normals = np.asarray(geo['normal'], dtype=np.float32).reshape(-1, 3)
    indices = np.asarray(geo.get('index') or range(len(positions)), dtype=np.uint32).reshape(-1, 3)
    face_materials = np.zeros(len(indices), dtype=np.uint16)
    for group in geo.get('groups') or []:
        if material_count != 1:
            face_materials[group['start'] // 3:(group['start'] + group['count']) // 3] = group['materialIndex']
    cross = np.cross(positions[indices[:, 1]] - positions[indices[:, 0]], positions[indices[:, 2]] - positions[indices[:, 0]])
    good = np.linalg.norm(cross, axis=1) > 1e-10
    indices = indices[good].copy(); face_materials = face_materials[good]
    bad = np.einsum('ij,ij->i', cross[good], normals[indices[:, 0]]) < 0
    indices[bad] = indices[bad][:, [0, 2, 1]]
    return positions, normals, indices, face_materials


def texture_node(tree, key, field, source, images):
    data = source['textures'][key]
    image_key = (key, field in ('map', 'emissiveMap') and data.get('colorSpace') == 'srgb')
    if image_key not in images:
        image = bpy.data.images.load(str(images['directory'] / (key + '.png')), check_existing=False)
        image.colorspace_settings.name = 'sRGB' if image_key[1] else 'Non-Color'
        images[image_key] = image
    node = tree.nodes.new('ShaderNodeTexImage'); node.image = images[image_key]
    node.extension = 'REPEAT' if data.get('wrapS') == 1000 or data.get('wrapT') == 1000 else 'EXTEND'
    uv = tree.nodes.new('ShaderNodeUVMap'); uv.uv_map = 'UVMap'
    # Match Three Texture.transformUv(): offset + center + R(-rotation)*(uv-center)*repeat.
    repeat = data.get('repeat', [1, 1]); offset = data.get('offset', [0, 0]); center = data.get('center', [0, 0])
    angle = data.get('rotation', 0); cosine = math.cos(angle); sine = math.sin(angle)
    separate = tree.nodes.new('ShaderNodeSeparateXYZ'); tree.links.new(uv.outputs['UV'], separate.inputs['Vector'])

    def affine(x_coefficient, y_coefficient, constant):
        x = tree.nodes.new('ShaderNodeMath'); x.operation = 'MULTIPLY'; x.inputs[1].default_value = x_coefficient
        y = tree.nodes.new('ShaderNodeMath'); y.operation = 'MULTIPLY'; y.inputs[1].default_value = y_coefficient
        tree.links.new(separate.outputs['X'], x.inputs[0]); tree.links.new(separate.outputs['Y'], y.inputs[0])
        add = tree.nodes.new('ShaderNodeMath'); add.operation = 'ADD'; tree.links.new(x.outputs[0], add.inputs[0]); tree.links.new(y.outputs[0], add.inputs[1])
        translate = tree.nodes.new('ShaderNodeMath'); translate.operation = 'ADD'; translate.inputs[1].default_value = constant
        tree.links.new(add.outputs[0], translate.inputs[0]); return translate.outputs[0]

    a = repeat[0] * cosine; b = repeat[0] * sine
    c = -repeat[1] * sine; d = repeat[1] * cosine
    tx = offset[0] + center[0] - a * center[0] - b * center[1]
    ty = offset[1] + center[1] - c * center[0] - d * center[1]
    if not data.get('flipY', True):
        c, d, ty = -c, -d, 1 - ty
    combine = tree.nodes.new('ShaderNodeCombineXYZ')
    tree.links.new(affine(a, b, tx), combine.inputs['X']); tree.links.new(affine(c, d, ty), combine.inputs['Y'])
    tree.links.new(combine.outputs[0], node.inputs['Vector'])
    return node.outputs['Color']


def create_material(key, data, source, images):
    material = bpy.data.materials.new(data['name'] or key); material.use_nodes = True
    tree = material.node_tree; bsdf = tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*data['color'], 1)
    bsdf.inputs['Roughness'].default_value = data['roughness']; bsdf.inputs['Metallic'].default_value = data['metalness']
    bsdf.inputs['Emission Color'].default_value = (*data.get('emissive', [0, 0, 0]), 1)
    bsdf.inputs['Emission Strength'].default_value = data.get('emissiveIntensity', 0)
    color = tree.nodes.new('ShaderNodeRGB'); color.outputs[0].default_value = (*data['color'], 1)
    output = color.outputs[0]
    factors = []
    if data.get('vertexColors'):
        attr = tree.nodes.new('ShaderNodeVertexColor'); attr.layer_name = 'Color'; factors.append(attr.outputs['Color'])
    if data.get('map'):
        factors.append(texture_node(tree, data['map'], 'map', source, images))
    for factor in factors:
        multiply = tree.nodes.new('ShaderNodeMixRGB'); multiply.blend_type = 'MULTIPLY'; multiply.inputs[0].default_value = 1
        tree.links.new(output, multiply.inputs[1]); tree.links.new(factor, multiply.inputs[2]); output = multiply.outputs[0]
    tree.links.new(output, bsdf.inputs['Base Color'])
    for field, channel, socket, factor in [('roughnessMap', 'Green', 'Roughness', data['roughness']),
                                           ('metalnessMap', 'Blue', 'Metallic', data['metalness'])]:
        if data.get(field):
            separate = tree.nodes.new('ShaderNodeSeparateColor'); separate.mode = 'RGB'
            tree.links.new(texture_node(tree, data[field], field, source, images), separate.inputs['Color'])
            multiply = tree.nodes.new('ShaderNodeMath'); multiply.operation = 'MULTIPLY'; multiply.inputs[1].default_value = factor
            tree.links.new(separate.outputs[channel], multiply.inputs[0]); tree.links.new(multiply.outputs[0], bsdf.inputs[socket])
    normal = None
    if data.get('normalMap'):
        color = texture_node(tree, data['normalMap'], 'normalMap', source, images)
        scale = data.get('normalScale', [1, 1])
        multiply = tree.nodes.new('ShaderNodeVectorMath'); multiply.operation = 'MULTIPLY'; multiply.inputs[1].default_value = (scale[0], scale[1], 1)
        tree.links.new(color, multiply.inputs[0])
        add = tree.nodes.new('ShaderNodeVectorMath'); add.operation = 'ADD'; add.inputs[1].default_value = (.5 * (1 - scale[0]), .5 * (1 - scale[1]), 0)
        tree.links.new(multiply.outputs[0], add.inputs[0])
        mapping = tree.nodes.new('ShaderNodeNormalMap'); mapping.uv_map = 'UVMap'
        mapping.space = 'OBJECT' if data.get('normalMapType') == 1 else 'TANGENT'
        tree.links.new(add.outputs[0], mapping.inputs['Color']); normal = mapping.outputs['Normal']
    if data.get('bumpMap'):
        mapping = tree.nodes.new('ShaderNodeBump'); mapping.inputs['Distance'].default_value = data.get('bumpScale', .001)
        mapping.inputs['Strength'].default_value = 1
        tree.links.new(texture_node(tree, data['bumpMap'], 'bumpMap', source, images), mapping.inputs['Height'])
        if normal:
            tree.links.new(normal, mapping.inputs['Normal'])
        normal = mapping.outputs['Normal']
    if normal:
        tree.links.new(normal, bsdf.inputs['Normal'])
    if data.get('emissiveMap'):
        tint = tree.nodes.new('ShaderNodeRGB'); tint.outputs[0].default_value = (*data.get('emissive', [0, 0, 0]), 1)
        multiply = tree.nodes.new('ShaderNodeMixRGB'); multiply.blend_type = 'MULTIPLY'; multiply.inputs[0].default_value = 1
        tree.links.new(tint.outputs[0], multiply.inputs[1])
        tree.links.new(texture_node(tree, data['emissiveMap'], 'emissiveMap', source, images), multiply.inputs[2])
        tree.links.new(multiply.outputs[0], bsdf.inputs['Emission Color'])
    if data.get('type') == 'MeshBasicMaterial':
        # Browser lamp diffuser is unlit, so its authoring material must not become a dark diffuse patch.
        emission = tree.nodes.new('ShaderNodeEmission'); emission.inputs['Strength'].default_value = 1
        tree.links.new(output, emission.inputs['Color'])
        tree.links.new(emission.outputs[0], tree.nodes.get('Material Output').inputs['Surface'])
    if data.get('opacity', 1) < .5:
        transparent = tree.nodes.new('ShaderNodeBsdfTransparent'); mix = tree.nodes.new('ShaderNodeMixShader')
        mix.inputs[0].default_value = data['opacity']
        tree.links.new(transparent.outputs[0], mix.inputs[1]); tree.links.new(bsdf.outputs[0], mix.inputs[2])
        tree.links.new(mix.outputs[0], tree.nodes.get('Material Output').inputs['Surface'])
    return material


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=HERE / 'luz')
    parser.add_argument('--size', type=int, default=None)
    parser.add_argument('--samples', type=int, default=512)
    parser.add_argument('--range', type=float, default=16.)
    parser.add_argument('--import-only', action='store_true')
    parser.add_argument('--no-glb', action='store_true')
    parser.add_argument('--approval', type=Path, default=None)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    output = args.out.resolve(); source_bytes = (output / 'source-scene.json').read_bytes(); source = json.loads(source_bytes)
    unwrap = json.loads((output / 'unwrap.json').read_text(encoding='utf8'))
    compact_bytes = (output / 'geometry-compact.json').read_bytes(); compact = json.loads(compact_bytes)
    if sha(source_bytes) != unwrap['sourceSHA256'] or sha(compact_bytes) != unwrap['geometrySHA256']:
        raise RuntimeError('Source snapshot/UV SHA mismatch: rerun preparar_luz.py')
    if sha(Path(unwrap['sourcePath']).read_bytes()) != unwrap['sourceSHA256']:
        raise RuntimeError('Source scene changed after unwrap')
    approval_bytes = None
    if not args.import_only:
        approval_path = args.approval or output / 'approval.json'
        if not approval_path.is_file():
            raise RuntimeError('Geometry/layout visual approval is required before calculating interior light')
        approval_bytes = approval_path.read_bytes(); approval = json.loads(approval_bytes)
        if not approval.get('approved') or approval.get('sourceSHA256') != unwrap['sourceSHA256'] or approval.get('unitSHA256') != source['unitSHA256']:
            raise RuntimeError('Visual approval refers to a different scene or builder unit')
        if approval_path.resolve() != (output / 'approval.json').resolve():
            (output / 'approval.json').write_bytes(approval_bytes)
    unit_path = source.get('metadata', {}).get('unitPath')
    if unit_path and sha(Path(unit_path).read_bytes()) != source['unitSHA256']:
        raise RuntimeError('Builder unit changed after scene export')
    size = args.size or unwrap['size']
    if size != unwrap['size']:
        raise RuntimeError('Bake resolution must match prepared UV guard resolution')
    bpy.ops.wm.read_factory_settings(use_empty=True); scene = bpy.context.scene; scene.render.engine = 'CYCLES'
    backend, devices = compute_device(scene)
    scene.cycles.samples = args.samples; scene.cycles.max_bounces = 8; scene.cycles.diffuse_bounces = 5
    scene.cycles.transparent_max_bounces = 12; scene.cycles.use_adaptive_sampling = False; scene.cycles.seed = 31
    scene.view_settings.view_transform = 'AgX'
    lighting = source.get('lighting') or {
        'name': 'canonical interior style, LIV room positions',
        'world': {'color': [.72, .82, 1], 'strength': .45},
        'sun': {'position': [-7, 9, 10], 'target': [0, 0, 0], 'energy': 2.2, 'angleDegrees': 4, 'color': [1, 1, 1]},
        'ceiling': {'energy': 45, 'size': .32, 'color': [1, .95, .86]}}
    world = lighting.get('world', {'color': [.72, .82, 1], 'strength': .45})
    scene.world = bpy.data.worlds.new('LIV interior daylight'); scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get('Background'); bg.inputs['Color'].default_value = (*world['color'], 1); bg.inputs['Strength'].default_value = world['strength']
    texture_directory = output / 'textures'; texture_directory.mkdir(exist_ok=True)
    for key, texture in source['textures'].items():
        (texture_directory / (key + '.png')).write_bytes(base64.b64decode(texture['data'].split(',', 1)[1]))
    images = {'directory': texture_directory}
    materials = {key: create_material(key, data, source, images) for key, data in source['materials'].items()}
    uv_by_object = {item['objectIndex']: item for item in compact['objects']}
    targets = []; scene_triangles = 0; source_objects = 0
    for oi, record in enumerate(source['objects']):
        if not record.get('include', True):
            continue
        geo = source['geometries'][record['geometry']]
        positions, normals, indices, face_materials = topology(geo, len(record['materials']))
        uv_record = uv_by_object.get(oi)
        if uv_record:
            prepared = np.frombuffer(base64.b64decode(uv_record['indicesU32']), dtype='<u4').reshape(-1, 3)
            if not np.array_equal(prepared, indices):
                raise RuntimeError('Prepared corner order differs from imported source')
        if not len(indices):
            continue
        mesh = bpy.data.meshes.new(f'LIV interior slot {record["slot"]} instance {record["instance"]}')
        mesh.from_pydata(positions.tolist(), [], indices.tolist()); mesh.update()
        for key in record['materials']:
            mesh.materials.append(materials[key])
        for face, material_index in zip(mesh.polygons, face_materials):
            if material_index >= len(mesh.materials):
                raise RuntimeError('Material group index out of range')
            face.material_index = int(material_index); face.use_smooth = True
        mesh.normals_split_custom_set(normals[indices].reshape(-1, 3).tolist())
        uv0 = mesh.uv_layers.new(name='UVMap')
        if geo.get('uv'):
            uv0.data.foreach_set('uv', np.asarray(geo['uv'], dtype=np.float32).reshape(-1, 2)[indices].reshape(-1))
        if geo.get('color'):
            color = np.asarray(geo['color'], dtype=np.float32).reshape(-1, 3)
            if record.get('instanceColor'):
                color = color * np.asarray(record['instanceColor'])
            attr = mesh.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='POINT')
            attr.data.foreach_set('color', np.c_[color, np.ones(len(color))].astype(np.float32).reshape(-1))
        if uv_record:
            uv1 = mesh.uv_layers.new(name='Lightmap')
            corners = np.frombuffer(base64.b64decode(uv_record['uv1U16']), dtype='<u2').astype(np.float32) / 65535
            if corners.size != len(mesh.loops) * 2:
                raise RuntimeError('UV1 loop count differs from source')
            uv1.data.foreach_set('uv', corners); mesh.uv_layers.active = uv1
        obj = bpy.data.objects.new(record['name'], mesh); scene.collection.objects.link(obj)
        matrix = record['matrix']; obj.matrix_world = BASIS @ Matrix([matrix[i::4] for i in range(4)])
        obj['liv_slot'] = record['slot']; obj['liv_instance'] = -1 if record['instance'] is None else record['instance']
        obj['liv_geometry_sha256'] = geo['sha256']; obj['liv_unit_sha256'] = source['unitSHA256']
        if record['name'] == 'plafon':
            obj.visible_shadow = False
        if uv_record:
            targets.append(obj)
        scene_triangles += len(mesh.polygons); source_objects += 1
    ceiling = lighting.get('ceiling')
    if ceiling:
        for room in source['rooms']:
            light = bpy.data.lights.new('LIV fixture ' + room['name'], 'AREA'); light.energy = ceiling['energy']; light.shape = 'DISK'
            light.size = ceiling['size']; light.color = ceiling['color']
            obj = bpy.data.objects.new(light.name, light); scene.collection.objects.link(obj)
            obj.location = (room['x'], -room['z'], source['height'] - .16); aim(obj, (room['x'], -room['z'], 0))
    sun_config = lighting.get('sun')
    if sun_config:
        light = bpy.data.lights.new('LIV interior sun', 'SUN'); light.energy = sun_config['energy']; light.angle = math.radians(sun_config['angleDegrees']); light.color = sun_config['color']
        obj = bpy.data.objects.new(light.name, light); scene.collection.objects.link(obj)
        obj.location = web_position(sun_config['position']); aim(obj, web_position(sun_config['target']))
    scene['liv_source_sha256'] = unwrap['sourceSHA256']; scene['liv_unit_sha256'] = source['unitSHA256']
    bpy.ops.file.pack_all(); bpy.ops.wm.save_as_mainfile(filepath=str(output / 'interior-source.blend'))
    glb_error = None
    if not args.no_glb:
        try:
            bpy.ops.export_scene.gltf(filepath=str(output / 'interior-source.glb'), export_format='GLB', export_yup=True,
                                     export_texcoords=True, export_normals=True, export_materials='EXPORT',
                                     export_vertex_color='NAME', export_vertex_color_name='Color',
                                     export_all_vertex_colors=True, export_cameras=False, export_lights=False, export_extras=True)
        except (RuntimeError, TypeError) as error:
            glb_error = str(error)
    authoring = {'sourceSHA256': unwrap['sourceSHA256'], 'unitSHA256': source['unitSHA256'],
                 'sourceObjects': source_objects, 'targetObjects': len(targets), 'totalSceneTriangles': scene_triangles,
                 'splitNormalsPreserved': True, 'lighting': lighting,
                 'blendBytes': (output / 'interior-source.blend').stat().st_size,
                 'glbBytes': (output / 'interior-source.glb').stat().st_size if (output / 'interior-source.glb').is_file() else None,
                 'glbError': glb_error, 'note': 'GLB contains same meshes/PBR/UV1, RGBM transport is integrated separately in LIV viewer'}
    (output / 'authoring.json').write_text(json.dumps(authoring, indent=2), encoding='utf8')
    print('LIV_INTERIOR_IMPORTED', json.dumps(authoring), flush=True)
    if args.import_only:
        return
    if not targets:
        raise RuntimeError('No eligible target surfaces')
    bpy.ops.object.select_all(action='DESELECT')
    for obj in targets:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = targets[0]; bpy.ops.object.join(); target = bpy.context.object
    target.name = 'LIV interior diffuse transport'; target.data.uv_layers.active = target.data.uv_layers['Lightmap']
    image = bpy.data.images.new('LIV interior DIRECT INDIRECT without COLOR', size, size, alpha=True, float_buffer=True)
    image.colorspace_settings.name = 'Non-Color'
    for material in target.data.materials:
        texture = material.node_tree.nodes.new('ShaderNodeTexImage'); texture.image = image; material.node_tree.nodes.active = texture
    scene.render.bake.use_clear = True; scene.render.bake.margin = unwrap['recommendedMarginPixels']; scene.render.bake.margin_type = 'EXTEND'
    scene.render.bake.target = 'IMAGE_TEXTURES'; scene.render.bake.use_pass_color = False
    scene.render.bake.use_pass_direct = True; scene.render.bake.use_pass_indirect = True
    started = time.perf_counter(); print('LIV_INTERIOR_BAKE_START', size, args.samples, backend, devices, flush=True)
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'})
    pixels = np.empty(size * size * 4, dtype=np.float32); image.pixels.foreach_get(pixels); pixels = pixels.reshape(size, size, 4)
    if not np.isfinite(pixels).all() or not (pixels[:, :, 3] > 0).any() or pixels[:, :, :3].max() < .05:
        raise RuntimeError('Empty, non-finite or black interior transport')
    pixels.tofile(str(output / 'irradiance.f32'))
    image.filepath_raw = str(output / 'irradiance.exr'); image.file_format = 'OPEN_EXR'; image.save()
    bpy.ops.file.pack_all(); bpy.ops.wm.save_as_mainfile(filepath=str(output / 'interior-baked.blend'))
    manifest = {'schema': 'liv-interior-lightmap-v1', 'unitId': source['unitId'], 'unitSHA256': source['unitSHA256'],
                'sourceSHA256': unwrap['sourceSHA256'], 'geometrySHA256': unwrap['geometrySHA256'],
                'geometryApproved': True, 'approvalSHA256': sha(approval_bytes),
                'geometryURL': 'interior/luz/geometry-compact.json', 'textureURL': 'interior/luz/irradiance.rgbm.gz',
                'textureCompression': 'gzip', 'textureEncoding': 'linear-rgbm-u8',
                'textureSHA256': None, 'width': size, 'height': size, 'range': args.range,
                'origin': 'bottom-left', 'premultiplyAlpha': False, 'lightMapIntensity': math.pi,
                'samples': args.samples, 'passes': ['DIRECT', 'INDIRECT'], 'colorPass': False,
                'objects': len(targets), 'triangles': len(target.data.polygons), 'lighting': lighting,
                'effectivePaddingPixels': unwrap['effectivePaddingPixels'], 'recommendedGuardPixels': unwrap['recommendedGuardPixels'],
                'ready': False}
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf8')
    proof = dict(manifest, seconds=time.perf_counter() - started, backend=backend, devices=devices,
                 totalSceneTriangles=scene_triangles, coveragePixels=int((pixels[:, :, 3] > 0).sum()),
                 sourceRadianceSHA256=sha((output / 'irradiance.f32').read_bytes()),
                 radianceMin=float(pixels[:, :, :3].min()), radianceMax=float(pixels[:, :, :3].max()),
                 checks={'sceneHash': True, 'unitHash': True, 'UVHash': True, 'visualGeometryApproval': True, 'splitNormalsPreserved': True,
                         'finiteRadiance': True, 'nonBlackAtlas': True, 'colorPassDisabled': True})
    (output / 'bake.json').write_text(json.dumps(proof, indent=2), encoding='utf8')
    print('LIV_INTERIOR_BAKE_COMPLETE', json.dumps(proof), flush=True)


if __name__ == '__main__':
    main()

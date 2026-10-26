"""Sonda local linear na câmera aprovada, com geometria, sem salvar a fonte."""
import hashlib
import json
import math
from pathlib import Path
import shutil

import bpy
import numpy as np

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'entrega/LIV_Luz_Natural.blend'
DEST = ROOT.parent / 'liv-experimental-2026-10-14/interiores/melhorias'
source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
protected_assets = {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in DEST.glob('*.glb')}
catalog_before = hashlib.sha256((DEST / 'catalogo.json').read_bytes()).hexdigest()
if (DEST / 'ambiente-interior.json').exists():
    previous = json.loads((DEST / 'ambiente-interior.json').read_text(encoding='utf-8'))
    if not previous.get('sunDiscIndirect'):
        backup = ROOT / 'fontes/ambiente-interior-v1'
        backup.mkdir(exist_ok=True)
        for filename in ('ambiente-interior.hdr', 'ambiente-interior.json'):
            if not (backup / filename).exists():
                shutil.copy2(DEST / filename, backup / filename)

bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
approved = bpy.data.scenes['03 | Sala e jantar']
source_camera = approved.camera
assert source_camera is not None
source_position = source_camera.matrix_world.translation.copy()
source_exposure = float(approved.view_settings.exposure)

scene = approved.copy()
scene.name = 'Exportacao | Ambiente indireto local aprovado'
scene.world = approved.world.copy()
sky = scene.world.node_tree.nodes['Daylight sky']
assert sky.sun_disc
nodes, links = scene.world.node_tree.nodes, scene.world.node_tree.links
camera_sky = nodes.new('ShaderNodeTexSky')
for parameter in ('sky_type', 'sun_direction', 'turbidity', 'ground_albedo', 'sun_elevation', 'sun_rotation', 'sun_size', 'sun_intensity', 'altitude', 'air_density', 'dust_density', 'ozone_density', 'aerosol_density'):
    if hasattr(sky, parameter) and hasattr(camera_sky, parameter):
        setattr(camera_sky, parameter, getattr(sky, parameter))
camera_sky.sun_disc = False
camera_sky.name = 'Camera only | Sky without direct solar disc'
background = nodes['Daylight strength']
camera_background = nodes.new('ShaderNodeBackground')
camera_background.inputs['Strength'].default_value = background.inputs['Strength'].default_value
links.new(camera_sky.outputs['Color'], camera_background.inputs['Color'])
path_node = nodes.new('ShaderNodeLightPath')
mix = nodes.new('ShaderNodeMixShader')
mix.label = 'Camera sees no solar disc; indirect rays retain approved sun'
links.new(path_node.outputs['Is Camera Ray'], mix.inputs[0])
links.new(background.outputs[0], mix.inputs[1])
links.new(camera_background.outputs[0], mix.inputs[2])
output = next(n for n in nodes if n.type == 'OUTPUT_WORLD' and n.is_active_output)
links.new(mix.outputs[0], output.inputs['Surface'])
assert sky.sun_disc and not camera_sky.sun_disc

scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 16
scene.cycles.use_adaptive_sampling = False
scene.cycles.use_denoising = False
scene.render.resolution_x, scene.render.resolution_y = 512, 256
scene.render.resolution_percentage = 100
scene.render.use_border = False
scene.render.use_crop_to_border = False
scene.render.film_transparent = False
scene.render.image_settings.media_type = 'IMAGE'
scene.render.image_settings.file_format = 'HDR'
scene.render.image_settings.color_mode = 'RGB'
scene.render.dither_intensity = 0
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1

data = bpy.data.cameras.new('Camera panoramica | sonda local web')
data.type = 'PANO'
data.panorama_type = 'EQUIRECTANGULAR'
camera = bpy.data.objects.new(data.name, data)
scene.collection.objects.link(camera)
camera.location = source_position
# Same canonical panorama orientation as ceu.hdr: Three=(Bx,Bz,-By).
camera.rotation_euler = (math.pi / 2, 0, -math.pi / 2)
scene.camera = camera
bpy.context.window.scene = scene
bpy.context.view_layer.update()

path = DEST / 'ambiente-interior.hdr'
scene.render.filepath = str(path)
print('LOCAL_PROBE_BEGIN', json.dumps({'sourceCamera': source_camera.name, 'positionBlender': list(source_position), 'sourceExposureEV': source_exposure, 'samples': 16, 'device': 'CPU'}), flush=True)
bpy.ops.render.render(write_still=True, scene=scene.name)

image = bpy.data.images.load(str(path), check_existing=False)
pixels = np.empty(len(image.pixels), dtype=np.float32)
image.pixels.foreach_get(pixels)
rgb = pixels.reshape(image.size[1], image.size[0], 4)[:, :, :3]
assert tuple(image.size) == (512, 256) and np.isfinite(rgb).all() and rgb.max() > 0
weights = np.sin(math.pi * (np.arange(image.size[1]) + .5) / image.size[1])
solid_angle_mean = (rgb * weights[:, None, None]).sum(axis=(0, 1)) / (weights.sum() * image.size[0])
exterior = json.loads((DEST / 'ceu.json').read_text(encoding='utf-8'))
exterior_mean = np.asarray(exterior['linearRGBMean'])
local_mean = rgb.mean(axis=(0, 1))
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == source_hash
assert all(hashlib.sha256((DEST / name).read_bytes()).hexdigest() == digest for name, digest in protected_assets.items())

report = {
    'path': path.name,
    'bytes': path.stat().st_size,
    'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
    'kind': 'local-interior-radiance-probe',
    'encoding': 'Radiance RGBE; scene-linear Rec.709; EV 0',
    'sourceBlend': 'experimentos/liv-luz-natural-2026-10-26/entrega/LIV_Luz_Natural.blend',
    'sourceBlendSHA256': source_hash,
    'sourceScene': approved.name,
    'sourceWorld': approved.world.name,
    'sourceCamera': source_camera.name,
    'sourcePositionBlender': list(source_position),
    'sourcePositionThree': [source_position.x, source_position.z, -source_position.y],
    'sourceExposureEV': source_exposure,
    'outputExposureEV': 0,
    'sunDisc': False,
    'sunDiscCamera': False,
    'sunDiscIndirect': True,
    'worldRayPolicy': 'Only Is Camera Ray uses sky without solar disc; all indirect and light-sampling rays retain the approved World including sunlight.',
    'reason': 'Capture geometry-occluded local radiance and approved solar bounce; the website already has one moving directional sun.',
    'geometryIncluded': True,
    'width': image.size[0],
    'height': image.size[1],
    'samples': scene.cycles.samples,
    'device': 'CPU',
    'denoising': False,
    'panoramaRotationBlender': list(camera.rotation_euler),
    'linearRGBMean': local_mean.tolist(),
    'linearRGBSolidAngleMean': solid_angle_mean.tolist(),
    'exteriorLinearRGBMean': exterior_mean.tolist(),
    'ratioToExteriorRGBMean': (local_mean / exterior_mean).tolist(),
    'linearRGBMax': float(rgb.max()),
    'sourceUnchanged': True,
    'protectedGLBs': len(protected_assets),
    'catalogSHA256Before': catalog_before,
    'catalogSHA256After': hashlib.sha256((DEST / 'catalogo.json').read_bytes()).hexdigest(),
    'catalogWrittenByExport': False,
}
(DEST / 'ambiente-interior.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print('LOCAL_PROBE_OK', json.dumps(report), flush=True)

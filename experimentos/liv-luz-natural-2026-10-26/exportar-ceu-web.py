"""Transfere o World aprovado para HDR, sem gravar nem modificar o .blend de entrega."""
import hashlib
import json
import math
from pathlib import Path

import bpy
import numpy as np

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'entrega/LIV_Luz_Natural.blend'
DEST = ROOT.parent / 'liv-experimental-2026-10-14/interiores/melhorias'
original_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
approved = bpy.data.scenes['03 | Sala e jantar']
world = approved.world.copy()
sky = world.node_tree.nodes['Daylight sky']
assert sky.sun_disc
sky.sun_disc = False  # O site já representa o mesmo sol por uma fonte direcional dinâmica.

scene = bpy.data.scenes.new('Exportacao | World aprovado para web')
scene.world = world
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 8
scene.cycles.use_denoising = False
scene.render.resolution_x, scene.render.resolution_y = 1024, 512
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'HDR'
scene.render.image_settings.color_mode = 'RGB'
scene.render.film_transparent = False
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure = 0
scene.render.dither_intensity = 0

data = bpy.data.cameras.new('Camera de ambiente web')
data.type = 'PANO'
data.panorama_type = 'EQUIRECTANGULAR'
camera = bpy.data.objects.new(data.name, data)
scene.collection.objects.link(camera)
scene.camera = camera
# Centro da textura +X, direita +Z do Three, vertical +Y (Blender Z-up -> Three Y-up).
camera.rotation_euler = (math.pi / 2, 0, -math.pi / 2)
bpy.context.window.scene = scene
DEST.mkdir(parents=True, exist_ok=True)
path = DEST / 'ceu.hdr'
scene.render.filepath = str(path)
bpy.ops.render.render(write_still=True, scene=scene.name)
image = bpy.data.images.load(str(path), check_existing=False)
pixels = np.empty(len(image.pixels), dtype=np.float32)
image.pixels.foreach_get(pixels)
rgb = pixels.reshape(-1, 4)[:, :3]
assert np.isfinite(rgb).all() and rgb.max() > 0 and len(scene.objects) == 1
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == original_hash
report = {
    'path': path.name, 'bytes': path.stat().st_size,
    'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
    'sourceBlendSHA256': original_hash,
    'sourceWorld': approved.world.name,
    'sourceExposureEV': approved.view_settings.exposure,
    'sourceSkyType': sky.sky_type,
    'sunDisc': False, 'reason': 'The website already has one moving directional sun.',
    'width': image.size[0], 'height': image.size[1],
    'linearRGBMean': rgb.mean(axis=0).tolist(), 'linearRGBMax': float(rgb.max()),
    'sourceUnchanged': True,
}
(DEST / 'ceu.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print('WORLD_EXPORT_OK', json.dumps(report), flush=True)

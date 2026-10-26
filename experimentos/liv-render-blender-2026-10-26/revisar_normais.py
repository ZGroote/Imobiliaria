"""Revisa as normais somente dos armarios recortados; preserva o arquivo em uso no render."""
from pathlib import Path
import bpy

root = Path(__file__).resolve().parent
source = root / 'entrega/LIV_Ipanema_Render.blend'
target = root / 'previas/LIV_revisado.blend'
bpy.ops.wm.open_mainfile(filepath=str(source))
fixed = []
for obj in bpy.data.collections['LIV | Apartamento em corte'].objects:
    if obj.get('LIV_source_slot') not in (53, 60):
        continue
    for polygon in obj.data.polygons:
        polygon.use_smooth = False
    obj.data.normals_split_custom_set([(0, 0, 0)] * len(obj.data.loops))
    fixed.append(obj.name)
assert len(fixed) == 2
bpy.ops.wm.save_as_mainfile(filepath=str(target))
scene = bpy.data.scenes['02 | Apartamento decorado']
scene.cycles.device = 'CPU'
scene.cycles.samples = 16
scene.cycles.adaptive_min_samples = 8
scene.cycles.adaptive_threshold = .08
scene.render.threads_mode = 'FIXED'
scene.render.threads = 4
scene.render.resolution_percentage = 25
scene.render.image_settings.color_depth = '8'
scene.render.filepath = str(root / 'previas/LIV_normais-revisadas.png')
bpy.ops.render.render(write_still=True, scene=scene.name)
print('NORMAIS_REVISADAS', fixed, flush=True)

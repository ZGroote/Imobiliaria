"""Repete duas câmeras antigas na fonte atual, para conferir compatibilidade."""
import bpy
import json
from mathutils import Matrix
from pathlib import Path

base = Path('/root/liv-global')
scene = bpy.context.scene
scene.render.resolution_x,scene.render.resolution_y = 1280,720
scene.render.resolution_percentage = 100
scene.render.pixel_aspect_x = scene.render.pixel_aspect_y = 1
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.cycles.samples = 128
scene.cycles.use_denoising = True
scene.render.use_persistent_data = True
data = bpy.data.cameras.new('verificacao-contexto')
data.sensor_width = 36
data.sensor_fit = 'HORIZONTAL'
data.lens = 18
data.clip_start = .05
data.dof.use_dof = False
camera = bpy.data.objects.new('verificacao-contexto',data)
scene.collection.objects.link(camera)
scene.camera = camera
for i,check in enumerate(json.loads((base/'comparacao.json').read_text())):
    camera.matrix_world = Matrix(check['frame']['transform_matrix'])
    bpy.context.view_layer.update()
    scene.render.filepath = str(base/f'comparacao-{i}.png')
    bpy.ops.render.render(write_still=True)

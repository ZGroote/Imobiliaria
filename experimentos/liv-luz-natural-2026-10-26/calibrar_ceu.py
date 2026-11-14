"""Mede o disco solar no céu realmente renderizado, sem confiar no rótulo da rotação."""
import bpy
from pathlib import Path
from mathutils import Vector
import math
import numpy as np
import json

ROOT=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'entrega/LIV_Luz_Natural.blend'))
world=bpy.data.scenes['03 | Sala e jantar'].world.copy()
scene=bpy.data.scenes.new('CALIBRACAO | Ceu sem geometria')
scene.world=world; scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=1; scene.cycles.use_denoising=False
scene.render.resolution_x=256; scene.render.resolution_y=256; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='OPEN_EXR'; scene.render.image_settings.color_mode='RGB'; scene.render.image_settings.color_depth='32'
data=bpy.data.cameras.new('Camera calibracao'); data.lens=18; data.sensor_width=36; data.sensor_fit='HORIZONTAL'
cam=bpy.data.objects.new(data.name,data); scene.collection.objects.link(cam); scene.camera=cam
folder=ROOT/'fontes/calibracao_ceu'; folder.mkdir(exist_ok=True)
report=[]
for name,direction in [('x',(1,0,0)),('menos_x',(-1,0,0)),('y',(0,1,0)),('menos_y',(0,-1,0)),('z',(0,0,1))]:
 cam.rotation_euler=Vector(direction).to_track_quat('-Z','Y').to_euler()
 bpy.context.window.scene=scene; bpy.context.view_layer.update()
 path=folder/(name+'.exr'); scene.render.filepath=str(path)
 bpy.ops.render.render(write_still=True,scene=scene.name)
 im=bpy.data.images.load(str(path),check_existing=False)
 arr=np.empty(len(im.pixels),dtype=np.float32); im.pixels.foreach_get(arr); arr=arr.reshape(256,256,4)
 lum=arr[:,:,:3]@np.array([.2126,.7152,.0722]); row,col=np.unravel_index(lum.argmax(),lum.shape)
 ray=Vector((2*(col+.5)/256-1,2*(row+.5)/256-1,-1)).normalized()
 ray=cam.matrix_world.to_3x3()@ray
 report.append({'face':name,'peak':float(lum.max()),'direction':list(ray),'pixel':[int(col),int(row)]})
 bpy.data.images.remove(im)
best=max(report,key=lambda r:r['peak'])
(ROOT/'fontes/sol_medido.json').write_text(json.dumps({'samples':report,'sun':best},indent=2),encoding='utf-8')
print('SUN_MEASURED',json.dumps(best),flush=True)

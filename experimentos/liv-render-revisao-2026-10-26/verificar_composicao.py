"""Mede recortes na câmera; não concede aprovação estética."""
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector
from pathlib import Path
import json
import sys

root=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(root/'entrega/LIV_Revisado.blend'))
scene=bpy.data.scenes['03 | Sala e jantar']
bpy.context.window.scene=scene
bpy.context.view_layer.update()
apply='--apply' in sys.argv
if apply:
    scene.render.resolution_y=1536
    scene.camera.rotation_euler=(Vector((1,-2,.93))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    bpy.context.view_layer.update()
objects=[o for o in scene.objects if o.type=='MESH' and ('| sofa |' in o.name or 'Quadro estar moldura' in o.name)]
points=[world_to_camera_view(scene,scene.camera,o.matrix_world@Vector(v)) for o in objects for v in o.bound_box]
report={'camera':scene.camera.name,'lens':scene.camera.data.lens,
        'normalized_bounds':{'min':[min(p[i] for p in points) for i in range(2)],'max':[max(p[i] for p in points) for i in range(2)]},
        'subjects':['sofa','quadro'],'fully_inside':all(0<=p.x<=1 and 0<=p.y<=1 and p.z>0 for p in points)}
report['margin_ok']=all(.02<=p.x<=.98 and .02<=p.y<=.98 and p.z>0 for p in points)
(root/'fontes/composicao.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('FRAMING',json.dumps(report),flush=True)
assert report['margin_ok'],'Enquadramento sem margem de 2%'
if apply:
    bpy.ops.wm.save_as_mainfile(filepath=str(root/'entrega/LIV_Revisado.blend'))
    print('FRAMING_SAVED',flush=True)

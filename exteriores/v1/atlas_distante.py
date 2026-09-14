"""Bake Blender amenities into an aerial atlas for the city-wide distance LOD."""
import bpy,json,math
from pathlib import Path
OUT=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(OUT/'componentes_quintais.blend'))
data=json.loads((OUT/'componentes.json').read_text());scene=bpy.context.scene
for obj in scene.objects:obj.hide_render=True
spans=[]
for i,layout in enumerate(data['layouts']):
    for slot,kind in enumerate(layout['kinds']):
        n=i*4+slot;obj=bpy.data.objects[f'GEO-quintal-{i+1:02}-{kind}-{slot}'];obj.hide_render=False
        a=data['assets'][n];scale=6/max(a['size'][0],a['size'][2]);spans.append(8/scale)
        obj.scale=(scale,scale,scale);obj.location=(n%16*8,n//16*8,0)
camera=scene.camera;camera.hide_render=False;camera.location=(60,36,100);camera.rotation_euler=(0,0,0);camera.data.type='ORTHO';camera.data.ortho_scale=128
scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.color_type='VERTEX'
scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True;scene.display.shading.background_type='WORLD'
scene.render.film_transparent=True;scene.render.resolution_x=1024;scene.render.resolution_y=640;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.filepath=str(OUT/'atlas-distante.png')
bpy.ops.render.render(write_still=True)
(OUT/'atlas-distante.json').write_text(json.dumps(dict(columns=16,rows=10,spans=spans),separators=(',',':')))
print('AERIAL ATLAS READY')

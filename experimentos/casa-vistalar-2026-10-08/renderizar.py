"""Renderiza o arquivo editável com dois cenários de iluminação.

blender -b casa-vistalar.blend --python renderizar.py
Acrescente -- --draft para conferir as duas iluminações em resolução menor.
"""
import bpy
import json
import math
import sys
import time
from pathlib import Path
from mathutils import Vector

OUT=Path(__file__).resolve().parent
scene=bpy.context.scene
DRAFT='--draft' in sys.argv
cam=scene.camera
cam.data.lens=54
cam.data.shift_y=-.030
scene.render.resolution_x=1100 if DRAFT else 2000
scene.render.resolution_y=619 if DRAFT else 1125
scene.render.resolution_percentage=100
scene.cycles.samples=40 if DRAFT else 96
scene.cycles.adaptive_threshold=.055 if DRAFT else .025
scene.cycles.adaptive_min_samples=16 if DRAFT else 24
scene.cycles.use_auto_tile=True
scene.cycles.tile_size=512
sky=next(n for n in scene.world.node_tree.nodes if n.type=='TEX_SKY')
bg=scene.world.node_tree.nodes.get('Background')
for mat in bpy.data.materials:
    # Car emissive maps are mostly black; sampling every face bloats the light tree.
    # Their visible emission remains, while architectural LEDs still sample as lights.
    if not mat.name.startswith('MAT |') and hasattr(mat.cycles,'emission_sampling'):
        mat.cycles.emission_sampling='NONE'
sun=next(o for o in scene.objects if o.type=='LIGHT' and o.data.type=='SUN')
fill=bpy.data.objects.get('LGT | Soft sky fill')
prefs=bpy.context.preferences.addons['cycles'].preferences
for mode in ['CUDA','OPTIX']:
    try:
        prefs.compute_device_type=mode;prefs.get_devices()
        if any(d.type==mode for d in prefs.devices):
            for d in prefs.devices:d.use=d.type==mode
            scene.cycles.device='GPU';print('RENDER_DEVICE '+mode+' '+str([(d.name,d.use) for d in prefs.devices]),flush=True);break
    except Exception:pass

def aim(obj,target):obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()

def daylight():
    sky.sun_elevation=math.radians(32);sky.sun_rotation=math.radians(235)
    sky.aerosol_density=.25;sky.sun_disc=False
    bg.inputs['Strength'].default_value=.34
    sun.location=(-12,-9,11);aim(sun,(0,1,0))
    sun.data.energy=2.25;sun.data.color=(1,.91,.77);sun.data.angle=math.radians(.8)
    fill.data.energy=130;fill.data.color=(.74,.84,1)
    scene.view_settings.exposure=-.25
    for o in scene.objects:
        if o.type=='LIGHT' and o.data.type=='AREA' and o!=fill:
            if 'garage downlight' in o.name:o.data.energy=12
            elif 'canopy warm bounce' in o.name:o.data.energy=60

def evening():
    sky.sun_elevation=math.radians(5);sky.sun_rotation=math.radians(235)
    sky.aerosol_density=.55;sky.sun_disc=False
    bg.inputs['Strength'].default_value=.11
    sun.location=(-15,-8,3.0);aim(sun,(0,1,0))
    sun.data.energy=.8;sun.data.color=(1,.62,.32);sun.data.angle=math.radians(1.1)
    fill.data.energy=70;fill.data.color=(.58,.72,1)
    scene.view_settings.exposure=.05
    for o in scene.objects:
        if o.type=='LIGHT' and o.data.type=='AREA' and o!=fill:
            if 'garage downlight' in o.name:o.data.energy=28
            elif 'canopy warm bounce' in o.name:o.data.energy=100

for name in ['GEO-Suite bathroom toilet','GEO-Suite bathroom toilet tank']:
    o=bpy.data.objects.get(name)
    if o:o.location.x=-2.72
scene['Visita']='Dois pavimentos conectados pela escada, cinco portas interativas e varanda.'
record=OUT/('draft-renders.json' if DRAFT else 'renders.json')
results=json.loads(record.read_text(encoding='utf-8')) if record.exists() else {}
jobs=[('fim-de-tarde',evening)] if '--evening-only' in sys.argv else ([('dia',daylight)] if '--one' in sys.argv else [('dia',daylight),('fim-de-tarde',evening)])
for name,setup in jobs:
    setup()
    prefix='draft-' if DRAFT else 'casa-vistalar-'
    scene.render.filepath=str(OUT/(prefix+name+'.png'))
    if not DRAFT and name=='dia':
        bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'casa-vistalar.blend'),compress=True)
    start=time.perf_counter()
    print('RENDER_START '+name,flush=True)
    bpy.ops.render.render(write_still=True)
    results[name]={'path':scene.render.filepath,'seconds':round(time.perf_counter()-start,2),'bytes':Path(scene.render.filepath).stat().st_size}
    results['resolution']=[scene.render.resolution_x,scene.render.resolution_y]
    results['samples_max']=scene.cycles.samples
    record.write_text(json.dumps(results,indent=2),encoding='utf-8')
    print('RENDER_FINISHED '+json.dumps(results[name]),flush=True)
daylight()
scene.render.filepath=str(OUT/'casa-vistalar-dia.png')
if not DRAFT:
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'casa-vistalar.blend'),compress=True)
results['resolution']=[scene.render.resolution_x,scene.render.resolution_y]
results['samples_max']=scene.cycles.samples
(OUT/('draft-renders.json' if DRAFT else 'renders.json')).write_text(json.dumps(results,indent=2),encoding='utf-8')

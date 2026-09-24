"""Ensaio Mirante 7: autoria assistida por referência, dimensões externas estimadas."""
import sys,time,json,math
from pathlib import Path
import bpy
from mathutils import Vector
B=Path(__file__).resolve().parent;ROOT=B.parents[1]
sys.path.insert(0,str(ROOT/'v1.5/miniaturas'))
from blender_maquete_base import material,box,flush,repetir,exportar
t=time.perf_counter();scene=bpy.context.scene
for ob in list(scene.objects):bpy.data.objects.remove(ob,do_unlink=True)
for name,rgb,rough,metal in [('reboco',(222,214,202),.9,0),('concreto',(204,199,188),.87,0),('grafite',(73,69,65),.8,0),('vidro',(72,107,118),.24,.15),('metal',(49,52,53),.4,.5),('piscina',(58,159,177),.25,.1),('madeira',(154,119,81),.8,0),('verde',(83,115,65),.9,0)]:material(name,rgb,rough,metal)
N=24;LV=3.15;W=30;D=9;torres=[(0,0,0),(20,19,math.pi/2)]
# Uma geometria de paredes e outra de lajes por torre, mantendo seleção dos pisos.
box('reboco',-W/2+.15,LV/2,0,.3,LV,D);box('reboco',W/2-.15,LV/2,0,.3,LV,D)
for s in [-1,1]:
 y=s*D/2
 box('reboco',0,.48,y,W,.96,.24);box('reboco',0,2.9,y,W,.5,.24)
 for col in range(10):
  x=-W/2+1.5+col*3
  box('reboco',x-1.38,1.8,y,.24,1.8,.24)
  balcony=col in [0,3,6,9]
  if balcony:
   box('grafite',x,1.8,y-s*.65,2.7,1.9,.18)
   box('vidro',x,1.65,y-s*.54,2.2,1.65,.04)
  else:
   box('reboco',x,1.8,y,2.76,1.8,.22)
   box('metal',x,1.87,y+s*.14,1.34,1.40,.10)
   box('vidro',x,1.87,y+s*.21,1.20,1.26,.04)
   box('metal',x,1.87,y+s*.25,.04,1.26,.04)
for obj in flush('paredes'):
 repetir([obj],torres,range(N),'paredes' if obj['acabamento']=='reboco' else 'esquadrias',LV)
box('concreto',0,.05,0,W,.10,D)
repetir(flush('lajes'),torres,range(N+1),'lajes',LV)
for s in [-1,1]:
 for col in [0,3,6,9]:
  x=-W/2+1.5+3*col;y=s*(D/2+.25)
  box('concreto',x,.05,y,2.76,.1,.65)
  box('metal',x,1.08,y+s*.35,2.7,.045,.045)
  box('vidro',x,.61,y+s*.35,2.6,.85,.025)
  for a in [-1,0,1]:box('metal',x+a*1.25,.6,y+s*.36,.035,1,.035)
repetir(flush('sacadas'),torres,range(N),'sacadas',LV)
# Paineis verticais escuros e coroamentos; fundo e implantação são aproximações.
for tx,dep,rot in torres:
 def b(mat,x,z,y,w,h,d):
  # cria em coordenadas locais e transforma as malhas ao final
  box(mat,x,z,y,w,h,d)
 for s in [-1,1]:
  for x in [-14.92,-11.98,-5.98,-3.02,3.02,5.98,11.98,14.92]: b('grafite',x,N*LV/2,s*(D/2+.16),.16,N*LV,.12)
 b('reboco',0,N*LV+1.4,0,W,2.8,D)
 b('grafite',0,N*LV+2.85,0,W+.15,.1,D+.15)
 for ob in flush('coroamento'):
  ob.location=(tx,-dep,0);ob.rotation_euler.z=rot;ob['tower']=-1;ob['role']='acabamento'
# Embasamento baixo e telas de garagem.
box('concreto',5,1.4,6,43,2.8,29)
for level in [1,2]:
 box('reboco',5,level*2.8, -8.5,43,.30,.5)
 for x in range(-16,27):box('metal',x,level*2.8-1.1,-8.65,.08,2.0,.08)
 for z in [.45,.85,1.25,1.65,2.05]:box('metal',5,level*2.8-2.4+z,-8.65,43,.045,.05)
box('reboco',13,N*LV/2,7,6,N*LV,7)
box('concreto',10,N*LV+2.8,10,12,.45,13)
box('madeira',10,N*LV+3.1,10,11,.20,12)
box('piscina',10,N*LV+3.3,10,6,.30,4)
for x in [-17,27]:box('verde',x,.65,-7,2.5,1.3,2.5)
for ob in flush('embasamento'):ob['tower']=-1;ob['role']='acabamento'
meta=dict(towers=2,floors=N,source='Perspectiva iPlano; altura, profundidade e implantação estimadas',dimensions_confirmed=False)
exportar(B/'modelo','mirante-7',meta)
world=bpy.data.worlds.new('Ceu');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.6,.7,.8,1);world.node_tree.nodes['Background'].inputs[1].default_value=.55;scene.world=world
target=Vector((7,-9,38))
for name,loc,energy,size in [('Sol',(-40,60,115),140000,65),('Preenchimento',(55,-30,90),85000,55)]:
 data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=size;ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(target-ob.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Camera');cam=bpy.data.objects.new('Camera',data);scene.collection.objects.link(cam);cam.location=target+Vector((-105,125,45));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=105;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True;scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
bpy.ops.wm.save_as_mainfile(filepath=str(B/'modelo/mirante-7.blend'));export_done=time.perf_counter()
scene.render.filepath=str(B/'modelo/preview.png');bpy.ops.render.render(write_still=True)
(B/'tempo-blender.json').write_text(json.dumps(dict(geracao_exportacao_s=export_done-t,render_s=time.perf_counter()-export_done,total_s=time.perf_counter()-t),indent=2))

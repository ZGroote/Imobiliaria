"""Blender --background --factory-startup --python modelar_montes.py -- <propertyId>.
Referencias MRV em referencias/. Fatos do predio vem da fonte LEVE normalizada.
"""
import sys, math, random
from pathlib import Path
ROOT=Path(__file__).resolve().parent
REPO=ROOT.parent.parent
sys.path.insert(0,str(ROOT))
sys.path.insert(0,str(REPO))
import bpy
from blender_maquete_base import material, box, flush, repetir, exportar, renderizar, MATS
from pipeline.fonte_leve import normalizar, FonteLeveErro

if '--' not in sys.argv or sys.argv.index('--')+1 >= len(sys.argv):
 raise SystemExit('uso: blender --background --factory-startup --python modelar_montes.py -- <propertyId>')
uid=sys.argv[sys.argv.index('--')+1]
try: fonte=normalizar(uid)
except FonteLeveErro as exc: raise SystemExit(str(exc))
if fonte['style']['profile']!='montes-mrv-v1':
 raise SystemExit('perfil LEVE nao suportado por modelar_montes.py: '+fonte['style']['profile'])
style=fonte['style']; building=fonte['building']; render=fonte['render']
slug=style['slug']
W=building['width']; D=building['depth']; N=building['floors']; LV=building['floorHeight']
scene=bpy.context.scene
print('BLENDER',bpy.app.version_string,'SCENE',scene.name,len(scene.objects),flush=True)
for ob in list(scene.objects):bpy.data.objects.remove(ob,do_unlink=True)
# A fonte normalizada preserva a ordem do cadastro e dos materiais do gerador aprovado.
towers=[(b.get('du',0),b.get('dv',0),0) for b in building['towers']]
for name,spec in style['materials'].items():
 material(name,spec['color'],spec.get('roughness',.8),spec.get('metalness',0),
          emission=spec.get('emission',0))

# Laterais longas cheias; nas duas empenas, duas sacadas embutidas por piso.
recess=style['recess']; bw=style['balconyWidth']
# eixo x e o comprimento da lamina. Sacadas nas faces x +/- W/2.
centers=style['balconyCenters']
box('reboco',0,LV/2+.08,0,W-2*recess,LV-.16,D)
segments=[(-D/2,centers[0]-bw/2),(centers[0]+bw/2,centers[1]-bw/2),(centers[1]+bw/2,D/2)]
for side in [-1,1]:
 for a,b in segments:box('reboco',side*(W/2-recess/2),LV/2+.08,(a+b)/2,recess,LV-.16,b-a)
repetir(flush('corpo',True),towers,range(N),'paredes')
box('concreto',0,.08,0,W,.16,D)
repetir(flush('laje',True),towers,range(N+1),'lajes')

def janela(x,z,y,w,h,side=1,end=False,lit=False):
 # Moldura com quatro barras, vidro recuado, duas folhas, peitoril e pingadeira.
 def piece(mat,dx,dz,depth,a,b,c):
  if end:box(mat,x+side*depth,z+dz,y+dx,c,b,a)
  else:box(mat,x+dx,z+dz,y+side*depth,a,b,c)
 piece('escuro',0,0,.012,w+.15,h+.13,.035)
 piece('acesa' if lit else 'vidro',0,0,.038,w,h,.025)
 for dx in [-w/2,w/2,0]:piece('metal',dx,0,.078,.046,h+.075,.075)
 for dz in [-h/2,h/2]:piece('metal',0,dz,.078,w+.075,.045,.075)
 piece('concreto',0,-h/2-.07,.12,w+.23,.07,.27)
 if lit:
  for j in range(8):piece('acesa',-w/2+.05+j*w/8,0,.055,.025,h-.05,.015)

# Tres variantes de piso distribuem persianas/luzes sem aumentar numero de materiais.
for variant in range(3):
 for side in [-1,1]:
  for idx,x in enumerate([-W/2+2.6,-W/2+5.5,-5,-1.9,1.9,5,W/2-5.5,W/2-2.6]):
   small=idx in (2,5)
   janela(x,1.75,side*D/2,.68 if small else 1.28,.7 if small else 1.23,side,lit=(idx+variant*3)%7==0)
  for dx in centers:
   # Porta recuada; parapeito de barras com retorno, luminaria no teto.
   janela(side*(W/2-recess+.035),1.38,dx,bw-.28,2.40,side,end=True,lit=(variant+int(dx>0))%3==0)
   for h in [.30,1.18]:box('metal',side*(W/2-.15),h,dx,.055,.045,bw-.12)
   for j in range(9):box('metal',side*(W/2-.15),.74,dx-bw/2+.11+j*(bw-.22)/8,.027,.87,.027)
   for edge in [-1,1]:
    box('metal',side*(W/2-recess/2),1.18,dx+edge*(bw/2-.07),recess-.25,.045,.05)
   box('acesa',side*(W/2-.8),LV-.22,dx,.23,.025,.23)
   if variant==1:
    box('vaso',side*(W/2-.55),.40,dx+.65,.42,.52,.42)
    for j in range(3):box('folha',side*(W/2-.55)+j*.07,.80+j*.1,dx+.65,.44-j*.06,.24,.38)
   # Piso da varanda e soleira.
   box('telhado',side*(W/2-recess/2),.175,dx,recess-.10,.025,bw-.08)
 repetir(flush('esquadrias-'+str(variant)),towers,range(variant,N,3),'fachada')

# Molduras verticais em verde/cinza, lidas nas perspectivas oficiais.
moldura_mode=style['molduraMode']
for side in [-1,1]:
 for center in [-D/2+1.1,D/2-1.1]:
  if moldura_mode=='split-highrise':
   ranges=[(1.0,LV*7-.4),(LV*8+.1,N*LV-1.2)]
  elif moldura_mode=='full-lowrise':
   ranges=[(LV*.7,N*LV-.8)]
  else:
   raise SystemExit('molduraMode nao suportado: '+str(moldura_mode))
  for bottom,top in ranges:
   for z in [bottom,top]:box('moldura',side*(W/2+.023),z,center,.035,.30,1.95)
   for yy in [center-.84,center+.84]:box('moldura',side*(W/2+.025),(top+bottom)/2,yy,.036,top-bottom,.27)
 if style['longFacadeBands']:
  for xx in [-W/2+3.9,W/2-3.9]:
   # Pintura entre vãos nas fachadas longas, sem cobrir janelas.
   for zz in [LV*.72,N*LV-.58]:box('moldura',xx,zz,side*(D/2+.014),7.1,.28,.024)
   for xx2 in [xx-3.42,xx+3.42]:box('moldura',xx2,(N*LV+LV*.72)/2-.29,side*(D/2+.014),.27,N*LV-LV*.72-.58,.024)
repetir(flush('molduras'),towers,[0],'acabamento')

# Cobertura com platibanda, rufo, casa de escada, venezianas e tubulacoes.
H=N*LV
box('telhado',0,H+.19,0,W-.35,.05,D-.35)
for side in [-1,1]:
 box('reboco',side*(W/2-.12),H+.50,0,.24,.68,D)
 box('metal',side*(W/2-.12),H+.86,0,.28,.045,D+.06)
 box('reboco',0,H+.50,side*(D/2-.12),W,.68,.24)
 box('metal',0,H+.86,side*(D/2-.12),W+.05,.045,.28)
box('reboco',0,H+1.5,0,7,2.65,4.4)
box('concreto',0,H+2.88,0,7.2,.14,4.6)
for j in range(8):box('metal',0,H+.8+j*.16,2.23,2.3,.065,.09)
for x in [-6,6]:
 box('escuro',x,H+.65,0,.23,.85,.23)
 box('metal',x,H+1.1,0,.43,.10,.43)
for side in [-1,1]:
 # Juntas e tubo de queda junto aos cantos, evitando detalhes flutuantes.
 box('metal',side*(W/2-.34),H/2,-D/2-.045,.075,H,.075)
 # Acesso social e marquise na fachada longa.
 box('escuro',0,1.28,side*(D/2+.03),1.7,2.35,.065)
 box('vidro',0,1.28,side*(D/2+.08),1.54,2.22,.03)
 box('metal',0,1.28,side*(D/2+.105),.045,2.22,.035)
 box('concreto',0,2.65,side*(D/2+.6),2.7,.15,1.5)
repetir(flush('cobertura-acessos',True),towers,[0],'acabamento')

# Portaria como elemento separado. Posicao e fato do cadastro; desenho 8 x 4 segue regra visual atual.
gx=building['portaria'].get('du',0); gy=building['portaria'].get('dv',0)
box('reboco',gx,1.55,gy,8,3.1,4)
box('moldura',gx,2.85,gy+2.04,8,.85,.12)
box('vidro',gx,1.5,gy+2.085,6.8,1.45,.04)
for xx in [-3.5,0,3.5]:box('metal',gx+xx,1.5,gy+2.12,.065,1.6,.09)
box('concreto',gx,3.34,gy,8.4,.22,4.4)
for j in range(24):box('escuro',gx+4.3+j*.23,1.1,gy+1.5,.035,2.2,.035)
for z in [.15,2.15]:box('escuro',gx+7,z,gy+1.5,5.6,.055,.07)
flush('portaria',True)

out=ROOT/(slug+'_blender')
metadata={'id':uid,'towers':len(towers),'floors':N,'floor_height':LV,'balcony_depth':recess,
 'reference':fonte['metadata']['reference'],
 'scope':fonte['metadata']['scope'],
 'uncertainty':fonte['metadata']['uncertainty']}
exportar(out,slug,metadata)
ref=ROOT/style['referenceImage']
renderizar(out,slug,ref,render['target'],render['distance'],render['ortho'])

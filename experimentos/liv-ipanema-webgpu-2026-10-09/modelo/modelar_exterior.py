"""Variante isolada do LIV: contorno ilustrado, sem substituir a base comercial.

Blender -b --factory-startup --python modelar_exterior.py -- --no-render
Herda linguagem visual/implantação da autoria original, com procedência registrada.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

OWN = Path(__file__).resolve().parent
ROOT = OWN.parents[2]
CANON = ROOT / 'v1.5/miniaturas/liv-ipanema'
sys.path[:0] = [str(OWN), str(CANON), str(CANON.parent)]
from contorno import Outline, triangulate
from blender_maquete_base import material, box, flush, MATS, buckets, exportar

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--saida', type=Path, default=OWN / 'variante')
parser.add_argument('--contorno', type=Path, default=OWN / 'contorno-torre.json')
parser.add_argument('--no-render', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
OUT = args.saida.resolve()
if not OUT.is_relative_to(OWN) or OUT == OWN:
    raise ValueError('A saída deve ser uma subpasta deste estudo isolado')
OUT.mkdir(parents=True, exist_ok=True)
outline = Outline(args.contorno, ROOT)
scene = bpy.context.scene
for ob in list(scene.objects):
    bpy.data.objects.remove(ob, do_unlink=True)
N, LV, W, D = 17, 2.85, 47.7, 12.7
if outline.spec['model'] != dict(floors=N, floorHeight=LV, width=W, bodyDepth=D):
    raise ValueError('O registro deve conservar os eixos e pavimentos da base')
BALCONIES = [(v-.5)*W for v in [.11,.19,.45,.76,.85]]
OLD_WINDOWS = [(v-.5)*W for v in [.062,.238,.302,.503,.571,.653,.707,.911]]
WINDOWS = outline.window_centers(OLD_WINDOWS)
CORE_X, CORE_W, BAL_W = -.13*W, .076*W, 2.38

for name, rgb, rough, metal in [
    ('reboco',(221,218,206),.84,0), ('laje',(218,216,204),.85,0),
    ('cinza',(143,156,156),.82,0), ('bege',(185,164,143),.87,0),
    ('recuo',(123,132,125),.88,0), ('esquadria',(37,44,43),.38,1),
    ('vidro',(64,88,95),.23,0), ('vidro-claro',(91,116,120),.26,0),
    ('cortina',(181,178,155),.95,0), ('peitoril',(192,194,184),.78,0),
    ('cobertura',(139,148,146),.92,0), ('luz-varanda',(223,187,120),.83,0),
    ('vaso',(128,112,89),.92,0), ('vegetacao-varanda',(76,105,58),.93,0),
]:
    material(name,rgb,rough,metal)


def copies(template, floors, role):
    for floor in floors:
        for src in template:
            ob=src.copy(); ob.data=src.data; scene.collection.objects.link(ob)
            ob.name=f'GEO-T01-{role}-{floor:02d}-{src["acabamento"]}'
            ob.location=(0,0,floor*LV)
            ob['tower']=0; ob['floor']=floor; ob['role']=role
    for src in template:
        bpy.data.objects.remove(src,do_unlink=True)


def prism(mat, low, high):
    """Extrusão fechada, tampas trianguladas e normais orientadas para fora."""
    if high <= low:
        raise ValueError('Espessura inválida')
    points=[Vector((x,-z,0)) for x,z in reversed(outline.points)]
    n=len(points); verts,faces=buckets.setdefault(mat,([],[])); base=len(verts)
    verts.extend((p.x,p.y,h) for h in [low,high] for p in points)
    for ids in triangulate([(p.x,p.y) for p in points]):
        faces.append(tuple(base+i for i in reversed(ids)))
        faces.append(tuple(base+n+i for i in ids))
    for i in range(n):
        j=(i+1)%n;faces.append((base+i,base+j,base+n+j,base+n+i))


def color(x, depth):
    if CORE_X-CORE_W/2-.001 < x < CORE_X+CORE_W/2+.001:return 'bege'
    return 'cinza' if abs(abs(depth)-D/2)>.1 else 'reboco'


def long_walls(sign):
    openings=[(x,1.14,.89,2.12) for x in WINDOWS]
    openings += [(x,BAL_W,.20,2.68) for x in BALCONIES]
    openings += [(CORE_X,.86,.99,2.04)]
    breaks={x for x,z in outline.points}
    for x,width,z0,z1 in openings:breaks.update([x-width/2,x+width/2])
    cuts=sorted(breaks)
    for a,b in zip(cuts,cuts[1:]):
        if b-a<.001:continue
        x=(a+b)/2;depth=outline.face(x,sign)
        opening=next((o for o in openings if abs(x-o[0])<o[1]/2-.0001),None)
        spans=[(.17,opening[2]),(opening[3],LV)] if opening else [(.17,LV)]
        for low,high in spans:
            if high-low>.005:box(color(x,depth),x,(low+high)/2,depth-sign*.125,b-a,high-low,.25)
    for x in BALCONIES:
        front=outline.face(x,sign)
        box('recuo',x,1.48,front-sign*1.70,BAL_W,2.64,.22)
        for edge in [-1,1]:
            box('reboco',x+edge*(BAL_W/2+.08),1.48,front-sign*.91,.16,2.64,1.70)


for sign in [-1,1]:long_walls(sign)
# Retornos das quinas e cabeceiras: cada plano deriva da aresta correspondente.
for a,b in zip(outline.points,outline.points[1:]+outline.points[:1]):
    if abs(a[0]-b[0])>.00001:continue
    x=a[0];lo,hi=sorted([a[1],b[1]])
    # Polígono CCW arquitetônico: à esquerda da aresta fica o interior.
    inward=-1 if b[1]>a[1] else 1
    holes=[(-4.35,1.06),(0,.84),(4.35,1.06)] if abs(x)>W/2-1.1 else []
    cuts=sorted({lo,hi,*[y+s*w/2 for y,w in holes for s in [-1,1] if lo<y+s*w/2<hi]})
    for c,d in zip(cuts,cuts[1:]):
        y=(c+d)/2;opening=next((h for h in holes if abs(y-h[0])<h[1]/2-.0001),None)
        spans=[(.17,1),(2.13,LV)] if opening else [(.17,LV)]
        for low,high in spans:
            box('reboco' if holes else color(x+.0001,(lo+hi)/2),x+inward*.125,(low+high)/2,y,.25,high-low,d-c)
box('reboco',0,1.48,0,W-.3,2.64,.22)
for ob in flush('panos',True):
    copies([ob],range(N),'paredes' if ob['acabamento']=='reboco' else 'detalhes-panos')
prism('laje',0,.17)
copies(flush('lajes'),range(N+1),'lajes')


def window(x,y,z=1.52,width=1.14,height=1.22,sign=1,side=False):
    frame=.047
    for s in [-1,1]:
        if side:box('esquadria',x,z,y+s*(width/2-frame/2),.065,height,frame)
        else:box('esquadria',x+s*(width/2-frame/2),z,y,frame,height,.065)
    for zz in [z-height/2+frame/2,z+height/2-frame/2]:
        if side:box('esquadria',x,zz,y,.065,frame,width)
        else:box('esquadria',x,zz,y,width,frame,.065)
    if side:
        box('vidro',x-sign*.014,z,y,.024,height-.09,width-.09)
        box('esquadria',x+sign*.035,z,y,.035,height-.08,.035)
        box('peitoril',x+sign*.04,z-height/2-.025,y,.21,.045,width+.13)
    else:
        box('vidro',x,z,y-sign*.014,width-.09,height-.09,.024)
        box('esquadria',x,z,y+sign*.035,.035,height-.08,.035)
        box('peitoril',x,z-height/2-.025,y+sign*.04,width+.13,.045,.21)


for sign in [-1,1]:
    for x in WINDOWS:window(x,outline.face(x,sign)+sign*.015,sign=sign)
    window(CORE_X,outline.face(CORE_X,sign)+sign*.015,z=1.515,width=.86,height=1.05,sign=sign)
    for x in BALCONIES:
        face=outline.face(x,sign); y=face-sign*1.568
        box('esquadria',x,1.43,y,2.07,2.36,.075)
        box('vidro-claro',x,1.43,y+sign*.047,1.95,2.23,.023)
        for edge in [-.98,0,.98]:box('esquadria',x+edge,1.43,y+sign*.07,.035,2.26,.045)
        front=face-sign*.09
        for zz in [.31,1.31]:box('esquadria',x,zz,front,BAL_W-.10,.045,.045)
        for j in range(15):box('esquadria',x-(BAL_W-.17)/2+j*(BAL_W-.17)/14,.82,front,.024,1.02,.024)
        for edge in [-1,1]:
            xx=x+edge*(BAL_W/2-.05)
            box('esquadria',xx,1.31,face-sign*.92,.045,.045,1.66)
            for j in range(9):box('esquadria',xx,.82,face-sign*(.09+j*.207),.024,1.02,.024)
        box('peitoril',x,LV-.018,face-sign*.92,BAL_W-.1,.025,1.6)
        box('luz-varanda',x,LV-.045,face-sign*.85,.17,.035,.14)
for sign in [-1,1]:
    for y,width in [(-4.35,1.06),(0,.84),(4.35,1.06)]:
        window(outline.end(y,sign)+sign*.013,y,z=1.565,width=width,height=1.13,sign=sign,side=True)
copies(flush('esquadrias-varandas'),range(N),'detalhes')
for variant in range(4):
    for sign in [-1,1]:
        for i,x in enumerate(WINDOWS):
            if (i+variant+(sign==1))%4==0:
                for j in range(6):box('cortina',x,1.04+j*.174,outline.face(x,sign)-sign*.035,1.01,.065,.018)
    copies(flush('persianas-'+str(variant)),range(variant,N,4),'detalhes')

H=N*LV
prism('cobertura',H+.17,H+.21)
for a,b in zip(outline.points,outline.points[1:]+outline.points[:1]):
    dx,dz=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dz)
    x,y=(a[0]+b[0])/2,(a[1]+b[1])/2
    delta=.12 if x>-CORE_X+1.5 else 0
    # Deslocamento para dentro: conserva o contorno exterior das lajes.
    nx,ny=-dz/length,dx/length
    box(color(x,y),x+nx*.125,H+.49+delta,y+ny*.125,
        abs(dx) if dx else .25,.64,abs(dz) if dz else .25)
    box('laje',x+nx*.125,H+.85+delta,y+ny*.125,
        abs(dx)+.06 if dx else .32,.065,abs(dz)+.06 if dz else .32)
for sign in [-1,1]:
    face=outline.face(CORE_X,sign);extension=4.0 if sign==1 else .76
    box('bege',CORE_X,H+.17+extension/2,face-sign*.125,CORE_W,extension,.25)
    for edge in [-1,1]:
        box('bege',CORE_X+edge*(CORE_W/2-.08),H+.17+extension/2,face-sign*.85,.16,extension,1.7)
    box('laje',CORE_X,H+.17+extension+.04,face-sign*.85,CORE_W+.1,.08,1.82)
box('reboco',CORE_X,H+.92,0,3.0,1.82,3.3)
box('cobertura',CORE_X,H+1.88,0,3.15,.1,3.45)
for ob in flush('cobertura',True):ob['tower']=0;ob['role']='cobertura'

# Implantação e base térrea preservadas: o contorno não prova a seção do térreo.
box('cinza',0,.24,0,W+.30,.40,D+.30)
for sign in [-1,1]:
    box('vidro-claro',CORE_X,.98,sign*(D/2+.36),1.58,1.55,.05)
    box('laje',CORE_X,2.35,sign*(D/2+1.4),3.8,.17,2.3)
for ob in flush('entrada-torre'):ob['tower']=0;ob['role']='terreo'
from modelar_implantacao import build_site
site_stats=build_site()
box('reboco',-31.7,.68,43.4,3.10,1.02,.22)
for ob in flush('placa-portaria'):ob['tower']=-1;ob['role']='implantacao'
curve=bpy.data.curves.new('LIV-IPANEMA-tipografia','FONT')
curve.body='LIV IPANEMA';curve.align_x='CENTER';curve.align_y='CENTER'
curve.size=.34;curve.extrude=.002;curve.resolution_u=3
ob=bpy.data.objects.new('GEO-placa-LIV-IPANEMA',curve);scene.collection.objects.link(ob)
ob.location=(-31.7,-43.52,.75);ob.rotation_euler=(math.pi/2,0,0)
curve.materials.append(MATS['esquadria'])
bpy.context.view_layer.objects.active=ob;ob.select_set(True)
bpy.ops.object.convert(target='MESH');ob=bpy.context.object
ob['tower']=-1;ob['role']='implantacao';ob['acabamento']='esquadria';ob.select_set(False)

metadata={'towers':1,'floors':N,'floorHeight':LV,'width':W,'depth':D,
          'balcony_stacks_front':5,'balcony_layout':'2+1+2','core_x':CORE_X,'site':site_stats,
          'dimensions':'proportional estimates from official images',
          'source_url':'https://www.livonincorporadora.com.br/produtos/liv-ipanema/',
          'variant':outline.spec['edition'],'confidence':'inferido',
          'outlineSHA256':hashlib.sha256(outline.path.read_bytes()).hexdigest(),
          'outlineSource':outline.spec['source'],'hypotheses':outline.spec['hypotheses'],
          'windowShifts':[{'oldX':a,'newX':b,'delta':b-a} for a,b in zip(OLD_WINDOWS,WINDOWS)],
          'recipeSources':{p.relative_to(ROOT).as_posix():hashlib.sha256(p.read_bytes()).hexdigest()
                          for p in [Path(__file__).resolve(),OWN/'contorno.py',CANON.parent/'blender_maquete_base.py',CANON/'modelar_implantacao.py']}}
exportar(OUT,'liv-contorno',metadata)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'liv-contorno.blend'))
print('LIV_CONTOUR_READY',json.dumps({'output':str(OUT),'variant':metadata['variant'],'floors':N}),flush=True)

"""LIV Ipanema: reconstrução proporcional das imagens oficiais, Blender 5.x.

blender --background --factory-startup --python modelar_liv_ipanema.py
As dimensões lineares são estimadas; os 17 pavimentos são oficiais.
X segue a lâmina, +Y arquitetônico é a fachada voltada ao lazer.
"""
import bpy, json, math, random, sys
from pathlib import Path
from mathutils import Vector

OUT = Path(__file__).resolve().parent
sys.path.insert(0, str(OUT.parent))
sys.path.insert(0, str(OUT))
from blender_maquete_base import material, box, flush, MATS, exportar

scene = bpy.context.scene
for ob in list(scene.objects):
    bpy.data.objects.remove(ob, do_unlink=True)
N, LV, W, D = 17, 2.85, 47.7, 12.7
BALCONIES = [(v-.5)*W for v in [.11,.19,.45,.76,.85]]
WINDOWS = [(v-.5)*W for v in [.062,.238,.302,.503,.571,.653,.707,.911]]
CORE_X, CORE_W = -.13*W, .076*W
BAL_W, BAL_BACK = 2.38, D/2-1.70

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

def wall_color(x, sign):
    # Faixas medidas na foto: núcleo bege descentrado, dois canais cinza.
    if CORE_X-CORE_W/2-.03 < x < CORE_X+CORE_W/2+.03:
        return 'bege'
    t=x/W+.5
    if .282<t<.330 or .553<t<.629:
        return 'cinza'
    return 'reboco'

def wall_with_holes(sign):
    """Panos segmentados: esquadrias e varandas são aberturas reais na parede."""
    openings=[(x,1.14,.89,2.12,'window') for x in WINDOWS]
    openings += [(x,BAL_W,.20,2.68,'balcony') for x in BALCONIES]
    openings += [(CORE_X,.86,.99,2.04,'core')]
    breaks={-W/2,W/2,CORE_X-CORE_W/2,CORE_X+CORE_W/2}
    for t in [.282,.33,.553,.629]: breaks.add((t-.5)*W)
    for x,width,z0,z1,typ in openings:
        breaks.update([x-width/2,x+width/2])
    cuts=sorted(breaks)
    for a,b in zip(cuts,cuts[1:]):
        if b-a<.001:continue
        x=(a+b)/2;col=wall_color(x,sign)
        y=sign*(D/2-.12)
        if col=='bege':y=sign*(D/2+.30)
        opening=next((o for o in openings if o[0]-o[1]/2-.001<x<o[0]+o[1]/2+.001),None)
        if opening:
            _,_,z0,z1,typ=opening
            for low,high in [(.17,z0),(z1,LV)]:
                if high-low>.005:box(col,x,(low+high)/2,y,b-a,high-low,.25)
        else: box(col,x,(.17+LV)/2,y,b-a,LV-.17,.25)
    # Profundidade útil do edifício, com corredor interno e divisórias de varanda.
    for x in BALCONIES:
        box('recuo',x,1.48,sign*BAL_BACK,BAL_W,2.64,.22)
        for edge in [-1,1]:
            box('reboco',x+edge*(BAL_W/2+.08),1.48,sign*(D/2-.91),.16,2.64,1.70)
    # Núcleo ligeiramente projetado, paredes laterais ligadas ao corpo principal.
    for edge in [-1,1]:
        box('bege',CORE_X+edge*(CORE_W/2-.08),1.5,sign*(D/2+.06),.16,2.7,.64)

for sign in [-1,1]: wall_with_holes(sign)
# Cabeceiras estreitas com três colunas de esquadrias, coerentes com vista aérea.
for sign in [-1,1]:
    holes=[(-4.35,1.06),(0,.84),(4.35,1.06)]
    edges=sorted(set([-D/2,D/2]+[y+s*w/2 for y,w in holes for s in [-1,1]]))
    for a,b in zip(edges,edges[1:]):
        y=(a+b)/2;opening=next((o for o in holes if abs(y-o[0])<o[1]/2+.001),None)
        spans=[(.17,1),(2.13,LV)] if opening else [(.17,LV)]
        for low,high in spans:box('reboco',sign*(W/2-.12),(low+high)/2,y,.25,high-low,b-a)
    # Corredor interno discreto, visível apenas por aberturas.
box('reboco',0,1.48,0,W-.3,2.64,.22)
walls=flush('panos',True)
for ob in walls:
    copies([ob],range(N),'paredes' if ob['acabamento']=='reboco' else 'detalhes-panos')

# Laje contínua fina; balcões permanecem recuados dentro da lâmina.
box('laje',0,.085,0,W,.17,D)
copies(flush('lajes'),range(N+1),'lajes')

def window(x,y,z=1.52,width=1.14,height=1.22,sign=1,side=False,core=False):
    frame=.047
    for s in [-1,1]:
        if side:box('esquadria',x,z,y+s*(width/2-frame/2),.065,height,frame)
        else:box('esquadria',x+s*(width/2-frame/2),z,y,frame,height,.065)
    for zz in [z-height/2+frame/2,z+height/2-frame/2]:
        if side:box('esquadria',x,zz,y,.065,frame,width)
        else:box('esquadria',x,zz,y,width,frame,.065)
    # Dois vidros, separados por montante. Sombreado pelas bordas dos vãos.
    if side:
        box('vidro',x-sign*.014,z,y,.024,height-.09,width-.09)
        box('esquadria',x+sign*.035,z,y,.035,height-.08,.035)
        box('peitoril',x+sign*.04,z-height/2-.025,y,.21,.045,width+.13)
    else:
        box('vidro',x,z,y-sign*.014,width-.09,height-.09,.024)
        box('esquadria',x,z,y+sign*.035,.035,height-.08,.035)
        box('peitoril',x,z-height/2-.025,y+sign*.04,width+.13,.045,.21)

for sign in [-1,1]:
    for x in WINDOWS:window(x,sign*(D/2+.015),sign=sign)
    window(CORE_X,sign*(D/2+.447),z=1.515,width=.86,height=1.05,sign=sign)
    for x in BALCONIES:
        # Porta de correr ao fundo, montantes e painel de cortina.
        y=sign*(BAL_BACK+.132)
        box('esquadria',x,1.43,y,2.07,2.36,.075)
        box('vidro-claro',x,1.43,y+sign*.047,1.95,2.23,.023)
        for edge in [-.98,0,.98]:box('esquadria',x+edge,1.43,y+sign*.07,.035,2.26,.045)
        # Guarda-corpo metálico vertical: 14 barras e retorno em ambas laterais.
        front=sign*(D/2-.09)
        for zz in [.31,1.31]:box('esquadria',x,zz,front,BAL_W-.10,.045,.045)
        for j in range(15):box('esquadria',x-(BAL_W-.17)/2+j*(BAL_W-.17)/14,.82,front,.024,1.02,.024)
        for edge in [-1,1]:
            xx=x+edge*(BAL_W/2-.05)
            box('esquadria',xx,1.31,sign*(D/2-.92),.045,.045,1.66)
            for j in range(9):box('esquadria',xx,.82,sign*(D/2-.09-j*.207),.024,1.02,.024)
        # Forro claro e luminária pequena, como nas fotos do empreendimento.
        box('peitoril',x,LV-.018,sign*(D/2-.92),BAL_W-.1,.025,1.6)
        box('luz-varanda',x,LV-.045,sign*(D/2-.85),.17,.035,.14)
for sign in [-1,1]:
    for y,width in [(-4.35,1.06),(0,.84),(4.35,1.06)]:
        window(sign*(W/2+.013),y,z=1.565,width=width,height=1.13,sign=sign,side=True)
copies(flush('esquadrias-varandas'),range(N),'detalhes')

# Algumas persianas em posições determinísticas: profundidade, sem mudar o padrão.
for variant in range(4):
    for sign in [-1,1]:
        for i,x in enumerate(WINDOWS):
            if (i+variant+(sign==1))%4==0:
                for j in range(6):box('cortina',x,1.04+j*.174,sign*(D/2-.035),1.01,.065,.018)
    copies(flush('persianas-'+str(variant)),range(variant,N,4),'detalhes')

# Parapetos escalonados e núcleo bege mais alto, características da silhueta.
H=N*LV
box('cobertura',0,H+.025,0,W-.43,.04,D-.43)
for sign in [-1,1]:
    for lo,hi,delta in [(-W/2,-CORE_X+1.5,0),(-CORE_X+1.5,W/2,.12)]:
        box('reboco',(lo+hi)/2,H+.41+delta,sign*(D/2-.12),hi-lo,.64,.25)
        box('laje',(lo+hi)/2,H+.74+delta,sign*(D/2-.12),hi-lo+.09,.065,.32)
    # Só a face publicada tem o núcleo alto comprovado; fundos são inferidos.
    extension=4.0 if sign==1 else .76
    box('bege',CORE_X,H+extension/2+.04,sign*(D/2+.30),CORE_W,extension,.25)
    for edge in [-1,1]:box('bege',CORE_X+edge*(CORE_W/2-.08),H+extension/2+.02,sign*(D/2-.45),.16,extension+.02,1.7)
    box('laje',CORE_X,H+extension+.065,sign*(D/2-.43),CORE_W+.1,.08,1.82)
for sign in [-1,1]:box('reboco',sign*(W/2-.12),H+.44,0,.25,.69,D)
# Interior técnico discreto da cobertura; inferido da foto aérea.
box('reboco',CORE_X,H+.92,0,3.0,1.82,3.3)
box('cobertura',CORE_X,H+1.88,0,3.15,.1,3.45)
for ob in flush('cobertura',True):ob['tower']=0;ob['role']='cobertura'

# Substrato térreo e acesso ao hall.
box('cinza',0,.24,0,W+.30,.40,D+.30)
for sign in [-1,1]:
    box('vidro-claro',CORE_X,.98,sign*(D/2+.36),1.58,1.55,.05)
    box('laje',CORE_X,2.35,sign*(D/2+1.4),3.8,.17,2.3)
for ob in flush('entrada-torre'):ob['tower']=0;ob['role']='terreo'

site_stats={}
try:
    from modelar_implantacao import build_site
    site_stats=build_site()
except ImportError:
    if '--tower-only' not in sys.argv:raise

if site_stats:
    # Placa vista nas perspectivas oficiais; tipografia é aproximação geométrica.
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
    ob['tower']=-1;ob['role']='implantacao';ob['acabamento']='esquadria'
    ob.select_set(False)

# Imagens de referência empacotadas na autoria, fora do conjunto exportável.
for name in ['fachada','aerea','implantacao','portaria']:
    path=OUT/'referencias'/(name+'.jpg')
    if path.exists():
        img=bpy.data.images.load(str(path),check_existing=True);img.pack()
        ob=bpy.data.objects.new('REF-'+name,None);scene.collection.objects.link(ob)
        ob.empty_display_type='IMAGE';ob.data=img;ob.hide_render=True
        ob.location=(150,0,30);ob.empty_display_size=40

metadata={'towers':1,'floors':N,'floorHeight':LV,'width':W,'depth':D,
          'balcony_stacks_front':5,'balcony_layout':'2+1+2','core_x':CORE_X,
          'site':site_stats,'dimensions':'proportional estimates from official images',
          'source_url':'https://www.livonincorporadora.com.br/produtos/liv-ipanema/'}
exportar(OUT,'liv-ipanema',metadata)

# Render de inspeção da MESMA geometria navegável. Luz nova própria do LIV.
world=bpy.data.worlds.new('WORLD-LIV-estudio');world.use_nodes=True;scene.world=world
nodes=world.node_tree.nodes;nodes.clear()
bg=nodes.new('ShaderNodeBackground');bg.inputs['Color'].default_value=(.27,.33,.40,1);bg.inputs['Strength'].default_value=.6
out=nodes.new('ShaderNodeOutputWorld');world.node_tree.links.new(bg.outputs[0],out.inputs[0])
def aim(ob,target):ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
def area(name,loc,power,color,size):
    data=bpy.data.lights.new('LGT-'+name,'AREA');data.energy=power;data.size=size;data.color=color
    ob=bpy.data.objects.new('LGT-'+name,data);scene.collection.objects.link(ob);ob.location=loc;aim(ob,(0,0,22))
area('key',(-40,-65,85),105000,(1,.91,.80),45)
area('fill',(70,-15,65),68000,(.79,.87,1),65)
area('rim',(0,55,70),80000,(1,.98,.88),50)
camera=bpy.data.cameras.new('CAM-LIV');cam=bpy.data.objects.new('CAM-LIV',camera);scene.collection.objects.link(cam)
scene.camera=cam;camera.type='ORTHO';camera.ortho_scale=135
cam.location=(-77,-100,76);aim(cam,(5,-5,18))
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.cycles.use_adaptive_sampling=True;scene.cycles.adaptive_threshold=.06
try:
    cp=bpy.context.preferences.addons['cycles'].preferences
    cp.compute_device_type='OPTIX';cp.get_devices()
    for device in cp.devices:device.use=device.type=='OPTIX'
    if any(device.use for device in cp.devices):scene.cycles.device='GPU'
except (TypeError,RuntimeError):
    scene.render.threads_mode='FIXED';scene.render.threads=8
scene.render.resolution_x=1200;scene.render.resolution_y=950;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=True
scene.view_settings.view_transform='AgX'
for screen in bpy.data.screens:
    for a in screen.areas:
        if a.type=='VIEW_3D':
            a.spaces.active.shading.type='MATERIAL'
            a.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'liv-ipanema.blend'))
if '--no-render' not in sys.argv:
    scene.render.filepath=str(OUT/'preview.png');bpy.ops.render.render(write_still=True)
print('LIV_READY',json.dumps(metadata),flush=True)

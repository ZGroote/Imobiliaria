"""Blender headless: 25 muros modulares + 40 quintais ilustrativos em metros.
Run: blender -b --factory-startup --python exteriores/v1/gerar.py -- [--preview]
"""
import bpy, math, sys, json, base64, array, hashlib, importlib.util
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parent
for folder in ('glb','previas'): (ROOT/folder).mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('urban_mesh',ROOT.parents[1]/'modelos_urbanos/v1/gerar.py')
U=importlib.util.module_from_spec(spec);spec.loader.exec_module(U)
U.C.update({k:U.rgb(v) for k,v in dict(grass='688448',leaf='49663E',leaf2='789250',soil='68513C',water='269FAB',water2='73C4C9',linen='E5D9B8',pink='BE817D',terracotta='B87154',cream2='DDD2B9',paver='A9A79B',lightstone='D1CABA',whitecloth='EFEDE3',jeans='586F8C',flower='C98A95',gravel='9C9685').items()})

class Mesh(U.Mesh):
    def __init__(self): super().__init__(0)
    def cylinder(self,x,y,z,r,h,color,segments=12,r2=None,mat=0):
        r2=r if r2 is None else r2
        verts=[(x+rr*math.cos(j*2*math.pi/segments),y+rr*math.sin(j*2*math.pi/segments),zz)
               for rr,zz in [(r,z-h/2),(r2,z+h/2)] for j in range(segments)]
        faces=[tuple(reversed(range(segments))),tuple(range(segments,segments*2))]
        faces += [(j,(j+1)%segments,(j+1)%segments+segments,j+segments) for j in range(segments)]
        self.poly(verts,faces,color,mat)
    def crown(self,x,y,z,r,color='leaf',stretch=1):
        n=7;v=[(x,y,z+r*stretch),(x,y,z-r*.55*stretch)]
        v += [(x+r*math.cos(i*2*math.pi/n),y+r*math.sin(i*2*math.pi/n),z) for i in range(n)]
        self.poly(v,[(0,2+i,2+(i+1)%n) for i in range(n)]+[(1,2+(i+1)%n,2+i) for i in range(n)],color)

WALL_NAMES=['Reboco com capa','Tijolinho aparente','Bloco de concreto','Pedra canjiquinha','Gabiao de pedra',
 'Ripado de madeira vertical','Madeira horizontal','Grade de ferro','Cobogo quadrado','Cobogo cruzado',
 'Concreto com frisos','Muro com pilaretes','Alvenaria com grade superior','Mureta com trelica','Pedra rustica',
 'Telha de capa colonial','Concreto pre-moldado','Ripado metalico horizontal','Tijolo com faixa vazada','Reboco com jardim vertical',
 'Concreto com seixos','Reboco escalonado','Madeira com trelica diagonal','Pedra com pilares','Painel de brises verticais']

def wall(i):
    m=Mesh();h=2.2
    def slab(color='cream',height=2.2,depth=.20):m.box(0,0,height/2,2.98 if i in (11,12,13,15,18) else 3.2,depth,height,color)
    def posts(color='concrete',height=2.2):
        for x in (-1.49,1.49):m.box(x,0,height/2,.22,.30,height,color)
    def cap(color='lightstone',z=2.24):m.box(0,0,z,3.22,.34,.08,color)
    def masonry(color,rows,cols,depth=.23):
        width=2.98 if i==23 else 3.2
        for row in range(rows):
            step=width/cols;offset=(row%2)*step/2
            for j in range(-1,cols+1):
                a=max(-width/2,-width/2+j*step+offset);b=min(width/2,-width/2+(j+1)*step+offset)
                if b-a>.02:m.box((a+b)/2,0,(row+.5)*2.2/rows,b-a-.014,depth,2.2/rows-.014,color if (row+j)%4 else 'sand')
    if i==0:slab('white');cap();m.box(0,-.108,.18,3.2,.04,.36,'stone')
    elif i==1:masonry('brick',17,10);cap('clay')
    elif i==2:masonry('concrete',10,8);cap()
    elif i==3:
        slab('stone')
        for row in range(15):
            for j in range(7):m.box(-1.6+(j+.5)*3.2/7,(-.13 if row%2 else -.15),(row+.5)*2.08/15,3.2/7-.018,.09,2.08/15-.02,['sand','lightstone','stone'][(row+j)%3])
        cap()
    elif i==4:
        slab('stone',2.05,.34)
        for row in range(8):
            for j in range(12):m.crown(-1.46+j*.265,-.18,.14+row*.255,.16,'gravel' if (j+row)%2 else 'stone',.75)
        for j in range(17):m.beam((-1.6+j*.2,-.34,.02),(-1.6+j*.2,-.34,2.1),.018,'metal')
        for row in range(11):m.beam((-1.6,-.34,row*.21),(1.6,-.34,row*.21),.018,'metal')
        cap('dark')
    elif i in (5,6,17,24):
        posts('dark');m.box(0,0,.12,3.2,.24,.24,'concrete')
        if i in (5,24):
            for j in range(19 if i==5 else 12):
                n=19 if i==5 else 12
                m.box(-1.38+(j+.5)*2.76/n,0,1.17,2.76/n*(.78 if i==5 else .55),.12 if i==5 else .3,1.9,'wood' if i==5 else 'white')
        else:
            rows=13 if i==6 else 18
            for row in range(rows):m.box(0,0,.30+row*1.85/(rows-1),2.83,.10 if i==6 else .16,.11 if i==6 else .075,'wood' if i==6 else 'dark')
        cap('dark')
    elif i in (7,12):
        slab('white',.75 if i==12 else .22);posts('stone')
        low=.75 if i==12 else .22
        for j in range(20):m.box(-1.35+j*2.7/19,0,(2.05+low)/2,.035,.06,2.05-low,'dark')
        for z in (low+.12,1.98):m.box(0,0,z,2.8,.07,.06,'dark')
        cap()
    elif i in (8,9):
        posts('white');m.box(0,0,.1,3.2,.23,.2,'white')
        for row in range(5):
            for col in range(7):
                x=-1.25+col*.416;y=0;z=.38+row*.355
                for dx in (-.185,.185):m.box(x+dx,y,z,.045,.17,.355,'terracotta' if i==8 else 'white')
                for dz in (-.155,.155):m.box(x,y,z+dz,.37,.17,.045,'terracotta' if i==8 else 'white')
                if i==9:m.beam((x-.15,0,z-.13),(x+.15,0,z+.13),.047,'white')
        cap()
    elif i==10:
        slab('concrete');cap('dark')
        for z in (.45,.95,1.45,1.95):m.box(0,-.105,z,3.2,.018,.028,'slate')
    elif i==11:
        slab('cream',1.92);posts('white',2.3)
        for x in (-1.49,1.49):m.box(x,0,2.31,.31,.36,.12,'lightstone')
        cap(z=1.94)
    elif i==13:
        slab('sage',1.1);posts('white');cap(z=1.12)
        for j in range(12):m.box(-1.37+j*.249,0,1.65,.035,.07,.95,'white')
        for z in (1.25,1.52,1.79,2.06):m.box(0,0,z,2.78,.07,.035,'white')
    elif i==14:
        masonry('stone',7,6,.32);cap('sand')
    elif i==15:
        slab('cream');posts('brick')
        for j in range(22):
            x=-1.52+j*.145
            m.beam((x,-.22,2.14),(x,0,2.23),.11,'tile');m.beam((x,0,2.23),(x,.22,2.14),.11,'tile')
    elif i==16:
        posts('concrete')
        for row in range(7):m.box(0,0,.18+row*.30,2.78,.13,.28,'concrete' if row%2 else 'stone')
        cap()
    elif i==18:
        slab('brick',1.55);posts('clay')
        for j in range(12):m.box(-1.35+j*.245,0,1.85,.13,.21,.55,'brick')
        cap('clay')
    elif i==19:
        slab('white');cap()
        for row in range(3):
            for j in range(5):
                x=-1.12+j*.56;z=.6+row*.55
                m.box(x,-.19,z,.32,.21,.20,'dark');m.crown(x,-.23,z+.15,.23,'leaf2',.8)
    elif i==20:
        slab('concrete');cap()
        for row in range(8):
            for j in range(5):m.crown(-.48+j*.24,-.12,.2+row*.245,.12,'lightstone',.8)
    elif i==21:
        for j in range(4):
            h=1.6+j*.2;m.box(-1.2+j*.8,0,h/2,.8,.22,h,'white');m.box(-1.2+j*.8,0,h+.03,.8,.29,.06,'slate')
    elif i==22:
        posts('wood');m.box(0,0,.13,3.2,.20,.26,'wood')
        for z in (.35,.65,.95,1.25,1.55,1.85):
            for j in range(5):
                x=-1.3+j*.55;m.beam((x-.23,0,z-.13),(x+.23,0,z+.13),.045,'wood');m.beam((x-.23,.04,z+.13),(x+.23,.04,z-.13),.045,'wood')
        cap('wood')
    elif i==23:
        masonry('stone',10,7,.28);posts('white',2.3);cap()
    return m

def plant(m,x,y,z=0,kind='pot',s=1):
    if kind=='tree':
        m.cylinder(x,y,z+.7,.075,1.4,'wood',7)
        for dx,dy,dz,r in [(0,0,1.7,.55),(-.35,0,1.5,.42),(.25,.25,1.55,.45)]:m.crown(x+dx*s,y+dy*s,z+dz*s,r*s,'leaf2' if dx else 'leaf')
    else:
        m.cylinder(x,y,z+.19*s,.18*s,.38*s,'terracotta',10,.23*s)
        m.cylinder(x,y,z+.39*s,.2*s,.015,'soil',10)
        for j in range(6):
            a=j*math.pi/3;m.crown(x+.16*s*math.cos(a),y+.16*s*math.sin(a),z+.57*s,.16*s,'leaf' if j%2 else 'leaf2',1.65)

def bench(m,x,y,w=1.5):
    for j in range(4):m.box(x,y-.18+j*.12,.46,w,.105,.06,'wood')
    for dx in (-w*.38,w*.38):m.box(x+dx,y,.23,.08,.42,.46,'dark');m.box(x+dx,y+.20,.75,.07,.07,.6,'dark')
    for z in (.7,.87):m.box(x,y+.22,z,w,.045,.12,'wood')

def table(m,x,y,s=1):
    m.cylinder(x,y,.76,.55*s,.07,'wood',12)
    m.cylinder(x,y,.38,.065,.75,'dark',8)
    m.cylinder(x,y,.06,.31,.06,'dark',10)
    for sign in (-1,1):
        cy=y+sign*.82*s
        m.box(x,cy,.46,.46,.42,.06,'cream2')
        for dx in (-.18,.18):
            for dy in (-.16,.16):m.box(x+dx,cy+dy,.23,.035,.035,.44,'dark')
        m.box(x,cy+sign*.20,.73,.46,.05,.5,'wood')

def bbq(m,x,y):
    m.box(x,y,.38,1.05,.72,.76,'brick')
    # Hollow firebox with a dark back, two cheeks and a tapered hood.
    for dx in (-.45,.45):m.box(x+dx,y,1.13,.15,.72,.75,'brick')
    m.box(x,y+.29,1.13,.8,.12,.75,'dark');m.box(x,y,.82,.8,.65,.07,'slate')
    for j in range(9):m.beam((x-.36+j*.09,y-.30,.85),(x-.36+j*.09,y+.25,.85),.023,'metal')
    m.poly([(x+dx,y+dy,z) for z,w,d in [(1.49,.53,.39),(1.95,.22,.21)] for dx,dy in [(-w,-d),(w,-d),(w,d),(-w,d)]],[(3,2,1,0),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)],'brick')
    m.box(x,y,2.13,.44,.42,.38,'brick');m.box(x,y,2.34,.57,.53,.07,'slate')
    for z in (.2,.4,.6):m.box(x,y-.366,z,1.04,.008,.012,'sand')
    m.box(x+.94,y,.45,.76,.62,.9,'white');m.box(x+.94,y,.94,.84,.68,.06,'slate')
    m.box(x+.94,y,.976,.35,.32,.012,'metal',1)
    m.beam((x+1.05,y+.18,.97),(x+1.05,y+.18,1.23),.025,'metal');m.beam((x+1.05,y+.18,1.23),(x+1.05,y,1.23),.025,'metal')

def laundry(m,x,y,w=1.8):
    for dx in (-w/2,w/2):
        m.cylinder(x+dx,y,1.03,.025,2.06,'metal',8)
        m.beam((x+dx,y-.43,2.05),(x+dx,y+.43,2.05),.035,'metal')
    for j in range(3):
        yy=y-.35+j*.35;m.beam((x-w/2,yy,2.05),(x+w/2,yy,2.05),.009,'linen')
    for j in range(3):
        xx=x-.55+j*.55;yy=y-.35+(j%3)*.35;c=['whitecloth','jeans','pink'][j]
        if j==1:
            for dx in (-.12,.12):m.box(xx+dx,yy,1.48,.20,.02,.75,c)
            m.box(xx,yy,1.92,.45,.02,.18,c)
        else:
            m.box(xx,yy,1.65,.40,.02,.66,c)
            for dx in (-.28,.28):m.box(xx+dx,yy,1.9,.18,.025,.21,c)
        for dx in (-.14,.14):m.box(xx+dx,yy,2.055,.025,.05,.07,'wood')

def pool(m,x,y,w,d,round_=False):
    if round_:
        m.cylinder(x,y,.17,min(w,d)/2,.24,'lightstone',20)
        m.cylinder(x,y,.298,min(w,d)/2-.16,.016,'water',20,mat=1)
        m.cylinder(x,y,.31,min(w,d)/2-.32,.012,'water2',20,mat=1)
    else:
        m.box(x,y,.15,w,d,.20,'lightstone')
        m.box(x,y,.254,w-.24,d-.24,.014,'water',1)
        m.box(x,y,.265,w-.44,d-.44,.009,'water2',1)
        for sign in (-1,1):
            m.box(x+sign*(w/2-.07),y,.29,.14,d,.09,'cream2')
            m.box(x,y+sign*(d/2-.07),.29,w-.28,.14,.09,'cream2')
    for dx in (-.23,.23):
        m.beam((x+dx,y-d/2-.10,.3),(x+dx,y-d/2-.10,.85),.025,'metal')
        m.beam((x+dx,y-d/2-.10,.85),(x+dx,y-d/2+.18,.85),.025,'metal')
        m.beam((x+dx,y-d/2+.18,.85),(x+dx,y-d/2+.18,.30),.025,'metal')

def umbrella(m,x,y):
    m.cylinder(x,y,1.15,.027,2.3,'wood',8)
    m.cylinder(x,y,.10,.25,.08,'concrete',12)
    # Closed eight-sided canopy with a shallow peaked silhouette.
    m.cylinder(x,y,2.26,1.0,.34,'linen',8,.06)

def lounger(m,x,y):
    for dx in (-.27,.27):
        m.beam((x+dx,y-.75,.15),(x+dx,y+.75,.45),.045,'white')
    m.box(x,y-.25,.37,.58,1.18,.08,'linen')
    a=(x,y+.33,.4);b=(x,y+.85,.85)
    for dx in (-.27,.27):m.beam((a[0]+dx,a[1],a[2]),(b[0]+dx,b[1],b[2]),.05,'white')
    for j in range(6):m.box(x,y+.35+j*.085,.42+j*.075,.52,.07,.045,'linen')

def pergola(m,x,y,w=2.5,d=2.3):
    for dx in (-w/2,w/2):
        for dy in (-d/2,d/2):m.box(x+dx,y+dy,1.24,.12,.12,2.48,'wood')
    for dx in (-w/2,w/2):m.box(x+dx,y,2.5,.14,d+.22,.16,'wood')
    for j in range(10):m.box(x-w/2+j*w/9,y,2.62,.07,d+.34,.09,'wood')

def bed(m,x,y,w=1.4,d=.75):
    m.box(x,y,.18,w,d,.28,'wood');m.box(x,y,.329,w-.1,d-.1,.015,'soil')
    for j in range(4):m.crown(x-w*.35+j*w*.23,y,.47,.17,'leaf2',.7)

def detail(m,kind,x,y,w,d):
    if kind=='pool':pool(m,x,y,w*.86,d*.87)
    elif kind=='roundpool':pool(m,x,y,w*.9,d*.9,True)
    elif kind=='laundry':laundry(m,x,y,min(2,w*.8))
    elif kind=='bbq':bbq(m,x-.4,y)
    elif kind=='table':table(m,x,y)
    elif kind=='pergola':pergola(m,x,y,min(2.5,w*.85),min(2.4,d*.85));table(m,x,y,.85)
    elif kind=='lounge':lounger(m,x-.4,y);plant(m,x+.55,y+.55)
    elif kind=='shade':umbrella(m,x,y+.2);lounger(m,x,y-.4)
    elif kind=='garden':
        plant(m,x-.4,y+.25,kind='tree',s=.85);plant(m,x+.4,y-.45);plant(m,x-.55,y-.55,s=.7)
    elif kind=='orchard':
        plant(m,x,y,kind='tree');
        for j in range(5):m.crown(x+.42*math.cos(j*1.25),y+.42*math.sin(j*1.25),1.65,.075,'ochre')
    elif kind=='beds':bed(m,x,y-.55,min(w*.8,2),.7);bed(m,x,y+.55,min(w*.8,2),.7)
    elif kind=='bench':bench(m,x,y,min(1.6,w*.75));plant(m,x-w*.35,y+.4)
    elif kind=='service':
        laundry(m,x,y+.35,min(w*.8,1.8));m.box(x,y-.9,.45,.8,.54,.9,'white');m.box(x,y-.9,.91,.65,.4,.03,'slate')
    elif kind=='shower':
        m.box(x,y,.08,1,1,.05,'slate');m.cylinder(x,y+.3,1.14,.035,2.2,'metal',8)
        m.beam((x,y+.3,2.23),(x,y-.12,2.23),.03,'metal');m.cylinder(x,y-.12,2.21,.13,.035,'metal',10)
        plant(m,x+.6,y+.4)
    elif kind=='firepit':
        m.cylinder(x,y,.27,.45,.44,'stone',12);m.cylinder(x,y,.496,.34,.018,'dark',12)
        for j in range(3):m.beam((x-.22,y-.13+j*.13,.51),(x+.22,y-.13+j*.13,.51),.065,'wood')
        bench(m,x,y+.9,1.5)
    elif kind=='play':
        m.box(x,y,.14,1.7,1.5,.18,'wood');m.box(x,y,.235,1.5,1.3,.015,'sand')
        for dx in (-.65,.65):m.beam((x+dx,y-.5,.25),(x+dx,y+.2,1.8),.075,'blue')
        m.box(x,y+.22,1.8,1.5,.09,.09,'blue')
        for dx in (-.2,.2):m.beam((x+dx,y+.22,1.8),(x+dx,y+.22,.6),.015,'metal')
        m.box(x,y+.22,.6,.55,.3,.06,'wood')
    elif kind=='kennel':
        m.box(x,y,.4,.95,.95,.7,'wood');m.box(x,y-.48,.34,.43,.012,.53,'dark')
        for dx in (-.25,.25):m.beam((x+dx*2,y-.55,.76),(x,y-.55,1.1),.10,'clay');m.beam((x+dx*2,y+.55,.76),(x,y+.55,1.1),.10,'clay')
        m.box(x,y,1.0,1.07,1.07,.08,'clay');m.cylinder(x+.7,y-.2,.10,.18,.10,'metal',10)
    elif kind=='pond':
        pool(m,x,y,w*.65,d*.6,True)
        for j in range(6):m.crown(x+math.cos(j)*w*.34,y+math.sin(j)*d*.3,.24,.21,'stone',.7)
        plant(m,x+w*.35,y+d*.25,s=.8)
    elif kind=='pots':
        for dx,dy,s in [(-.5,-.3,1),(.4,.3,1.4),(.5,-.45,.65)]:plant(m,x+dx,y+dy,s=s)
    elif kind=='path':
        for j in range(4):m.box(x+(.15 if j%2 else -.15),y-d*.35+j*d*.23,.09,min(.7,w*.5),d*.16,.05,'lightstone')

# Each row specifies a real layout: four surface zones and four distinct amenities.
YARDS=[
 ('Servico cimentado',4,5,'cement','service','pots','path','bench'),
 ('Varal no gramado',4,6,'grass','laundry','garden','path','pots'),
 ('Horta domestica',5,5,'grass','beds','beds','path','service'),
 ('Churrasco de domingo',5,6,'paver','bbq','table','garden','path'),
 ('Piscina e espreguicadeira',6,7,'grass','pool','lounge','path','shower'),
 ('Piscina com deck',6,8,'deck','pool','shade','lounge','pots'),
 ('Pergolado de madeira',5,6,'paver','pergola','garden','path','bench'),
 ('Pomar pequeno',5,6,'grass','orchard','orchard','bench','path'),
 ('Jardim de vasos',4,5,'gravel','pots','pots','path','bench'),
 ('Patio de lajotas',4,6,'clay','table','bbq','pots','path'),
 ('Piscina redonda',6,6,'cement','roundpool','shower','shade','garden'),
 ('Horta e varal',5,7,'mixed','beds','service','orchard','path'),
 ('Lazer com churrasqueira',6,7,'mixed','bbq','pool','table','lounge'),
 ('Quintal de vila',4,5,'mixed','laundry','pots','table','path'),
 ('Jardim com banco',4,6,'grass','garden','bench','path','pots'),
 ('Fogueira e conversa',6,6,'gravel','firepit','bench','garden','path'),
 ('Brinquedos na grama',5,7,'grass','play','bench','garden','path'),
 ('Quintal pet',4,6,'mixed','kennel','service','garden','path'),
 ('Piscina e horta',6,8,'mixed','pool','beds','lounge','path'),
 ('Patio gourmet',6,7,'paver','bbq','pergola','table','pots'),
 ('Jardim de pedra',4,5,'gravel','pond','pots','bench','path'),
 ('Lavanderia e descanso',5,6,'cement','service','bench','pots','table'),
 ('Deck com ducha',5,6,'deck','shower','lounge','shade','pots'),
 ('Lazer tropical',6,8,'grass','pool','garden','shade','shower'),
 ('Horta em canteiros',5,6,'gravel','beds','beds','service','path'),
 ('Pergola e varal',5,7,'mixed','pergola','laundry','garden','path'),
 ('Patio de tijolinho',5,5,'clay','bench','firepit','pots','path'),
 ('Pomar com churrasqueira',6,7,'grass','orchard','bbq','table','path'),
 ('Piscina compacta',5,6,'cement','pool','shower','pots','bench'),
 ('Area social com deck',6,6,'deck','pergola','table','lounge','pots'),
 ('Jardim com lago',5,7,'grass','pond','garden','bench','path'),
 ('Quintal familiar',6,8,'mixed','play','bbq','table','laundry'),
 ('Servico com piso drenante',4,6,'paver','service','beds','pots','path'),
 ('Piscina e churrasqueira',6,8,'clay','pool','bbq','shade','table'),
 ('Pergola de leitura',4,6,'deck','pergola','pots','bench','path'),
 ('Quintal rustico',5,7,'gravel','bbq','orchard','bench','laundry'),
 ('Jardim de convivencia',6,7,'paver','table','garden','firepit','bench'),
 ('Piscina com pomar',6,8,'grass','pool','orchard','shower','lounge'),
 ('Quintal de fundos estreito',4,7,'mixed','service','bbq','beds','path'),
 ('Lazer completo',7,8,'mixed','pool','pergola','bbq','shower'),
]

def yard(i):
    name,w,d,surface,*kinds=YARDS[i];m=Mesh()
    m.box(0,0,.02,w,d,.04,'soil')
    for slot,kind in enumerate(kinds):
        x=(-1 if slot%2==0 else 1)*w/4;y=(1 if slot<2 else -1)*d/4
        s=surface if surface!='mixed' else ('grass' if slot in (0,3) else 'cement')
        color={'grass':'grass','cement':'concrete','deck':'wood','paver':'paver','clay':'terracotta','gravel':'gravel'}[s]
        m.box(x,y,.05,w/2-.01,d/2-.01,.04,color)
        if s in ('paver','clay','deck'):
            nx=max(2,int((w/2)/(.16 if s=='deck' else .6)));ny=1 if s=='deck' else max(2,int(d/2/.6))
            for a in range(nx):
                for b in range(ny):m.box(x-w/4+(a+.5)*w/2/nx,y-d/4+(b+.5)*d/2/ny,.079,w/2/nx-.015,d/2/ny-.015,.015,color)
        detail(m,kind,x,y,w/2-.2,d/2-.2)
    # Narrow edging defines the plot without adding invented boundary walls.
    for sign in (-1,1):m.box(sign*(w/2-.025),0,.07,.05,d,.08,'stone');m.box(0,sign*(d/2-.025),.07,w,.05,.08,'stone')
    return m

def pack_mesh(obj,ident,category,name):
    me=obj.data;me.calc_loop_triangles();p=[];n=[];c=[];idx=[];groups=[];lut={}
    colors=me.color_attributes['Color']
    for mat in (0,1):
        start=len(idx)
        for tri in me.loop_triangles:
            if tri.material_index!=mat:continue
            assert tri.area>1e-10,(ident,'degenerate')
            for vi in tri.vertices:
                v=me.vertices[vi].co;normal=tri.normal;col=colors.data[vi].color
                # Blender Z up -> map/glTF Y up, millimetres preserve thin clotheslines.
                pp=tuple(round(v[k]*sign*1000) for k,sign in [(0,1),(2,1),(1,-1)])
                nn=tuple(round(normal[k]*sign*127) for k,sign in [(0,1),(2,1),(1,-1)])
                cc=tuple(max(0,min(255,round(x*255))) for x in col[:3]);key=pp+nn+cc
                if key not in lut:lut[key]=len(p)//3;p.extend(pp);n.extend(nn);c.extend(cc)
                idx.append(lut[key])
        if len(idx)>start:groups.append(dict(start=start,count=len(idx)-start,material=mat))
    assert len(lut)<65536 and max(abs(x) for x in p)<32768
    enc=lambda code,a:base64.b64encode(array.array(code,a).tobytes()).decode()
    return dict(id=ident,category=category,name=name,size=[round(obj.dimensions[k],3) for k in (0,2,1)],
       p=enc('h',p),n=enc('b',n),c=enc('B',c),i=enc('H',idx),groups=groups,triangles=len(idx)//3)

def main():
    preview='--preview' in sys.argv;scene=U.setup();scene.name='Muros e quintais - 65 modelos'
    scene.cycles.samples=24;scene.render.resolution_x=540;scene.render.resolution_y=540
    assets=[];records=[];objects=[]
    choices=[('muros',i,n) for i,n in enumerate(WALL_NAMES)]+[('quintais',i,r[0]) for i,r in enumerate(YARDS)]
    if preview:choices=[v for v in choices if (v[0],v[1]) in {('muros',1),('muros',8),('muros',19),('quintais',0),('quintais',5),('quintais',39)}]
    for category,i,name in choices:
        ident=f'{category}-{i+1:02}';m=wall(i) if category=='muros' else yard(i)
        # Center the complete envelope, including foliage beyond the ground slab.
        if category=='quintais':
            cx=(min(v[0] for v in m.v)+max(v[0] for v in m.v))/2
            cy=(min(v[1] for v in m.v)+max(v[1] for v in m.v))/2
            m.v=[(x-cx,y-cy,z) for x,y,z in m.v]
        obj=m.make('GEO-'+ident);bpy.context.view_layer.update();report=U.geometry_report(obj)
        assert report['finite'] and report['degenerate_triangles']==0 and report['triangles']<12000,(ident,report)
        obj['descricao']=name;obj['ilustrativo']=True;obj.asset_mark();objects.append(obj)
        assets.append(pack_mesh(obj,ident,category,name));records.append(dict(id=ident,name=name,category=category,**report))
        U.frame(obj);scene.render.filepath=str(ROOT/'previas'/f'{ident}.png')
        if preview or not Path(scene.render.filepath).exists() or ('--rerender='+ident) in sys.argv or (category=='muros' and '--rerender-walls' in sys.argv):bpy.ops.render.render(write_still=True)
        if not preview:
            bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
            bpy.ops.export_scene.gltf(filepath=str(ROOT/'glb'/f'{ident}.glb'),export_format='GLB',use_selection=True,export_animations=False,export_yup=True,export_materials='EXPORT',export_extras=True)
        obj.hide_render=True
        print('ASSET_DONE',ident,report['triangles'],flush=True)
        (ROOT/'progress.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
    if preview:return
    assert len(assets)==65 and len({r['geometry_sha256'] for r in records})==65
    for category in ('muros','quintais'):
        col=bpy.data.collections.new('COL-'+category);scene.collection.children.link(col)
        for i,obj in enumerate(o for o in objects if o.name.startswith('GEO-'+category)):
            for old in list(obj.users_collection):old.objects.unlink(obj)
            col.objects.link(obj);obj.location=((i%5)*11,(i//5)*12+(0 if category=='muros' else 70),0);obj.hide_render=False
            with bpy.context.temp_override(id=obj):bpy.ops.ed.lib_id_load_custom_preview(filepath=str(ROOT/'previas'/f'{category}-{i+1:02}.png'))
    scene.camera.location=(95,-90,125);scene.camera.rotation_euler=(Vector((23,80,0))-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.camera.data.ortho_scale=180
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.shading.type='MATERIAL';area.spaces.active.clip_end=1000
                area.spaces.active.region_3d.view_location=(23,80,0);area.spaces.active.region_3d.view_distance=150
                area.spaces.active.region_3d.view_rotation=scene.camera.rotation_euler.to_quaternion()
    (ROOT/'mapa-exteriores.json').write_text(json.dumps(dict(version=1,units='m',quantization=1000,assets=assets),separators=(',',':')),encoding='utf-8')
    (ROOT/'catalogo.json').write_text(json.dumps(dict(illustrative=True,wall_module_width=3.2,assets=records),ensure_ascii=False,indent=2),encoding='utf-8')
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'biblioteca_65.blend'))
    print('COMPLETE 25 muros + 40 quintais',flush=True)
if __name__=='__main__':main()

"""Run with Blender --background --factory-startup --python gerar.py -- [--preview|--export]."""
import bpy, math, json, sys, hashlib, time
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
for folder in ('previas', 'glb', 'glb_lod1', 'fbx', 'validation'):
    (ROOT / folder).mkdir(exist_ok=True)

def rgb(hexcode):
    vals=[int(hexcode[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<=0.04045 else ((v+.055)/1.055)**2.4 for v in vals)+(1,)

C={k:rgb(v) for k,v in dict(white='E8E3D8',cream='D6C5A9',sand='B7A387',
    clay='A9563B',tile='AE6349',tile2='805344',slate='51575A',dark='303B40',
    glass='344B57',glass2='637C86',wood='926546',stone='A49F94',concrete='BFC0B9',
    sage='899580',blue='879EAA',ochre='C6A477',brick='9C604A',metal='50585C').items()}

def material(name,roughness):
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=roughness
    a=m.node_tree.nodes.new('ShaderNodeVertexColor');a.layer_name='Color'
    m.node_tree.links.new(a.outputs['Color'],p.inputs['Base Color'])
    m.diffuse_color=(.65,.62,.55,1)
    return m

class Mesh:
    def __init__(self,lod): self.v=[];self.f=[];self.c=[];self.mi=[];self.lod=lod
    def poly(self,verts,faces,color,mat=0):
        start=len(self.v);self.v.extend(verts)
        col=C[color] if isinstance(color,str) else color
        self.c.extend([col]*len(verts))
        self.f.extend([tuple(start+i for i in f) for f in faces]);self.mi.extend([mat]*len(faces))
    def box(self,x,y,z,w,d,h,color='white',mat=0):
        if min(w,d,h)<=0:return
        x0=x-w/2;x1=x+w/2;y0=y-d/2;y1=y+d/2;z0=z-h/2;z1=z+h/2
        self.poly([(x0,y0,z0),(x1,y0,z0),(x1,y1,z0),(x0,y1,z0),
                   (x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1)],
                  [(3,2,1,0),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)],color,mat)
    def beam(self,a,b,width,color='metal'):
        a,b=Vector(a),Vector(b)
        if (b-a).length<1e-6:return
        axis=(b-a).normalized()
        side=axis.cross(Vector((0,0,1)))
        if side.length<.01:side=Vector((1,0,0))
        side.normalize();up=axis.cross(side).normalized()
        vs=[tuple(p+(side*s+up*t)*width/2) for p in (a,b) for s,t in [(-1,-1),(1,-1),(1,1),(-1,1)]]
        self.poly(vs,[(3,2,1,0),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)],color)
    def make(self,name):
        me=bpy.data.meshes.new(name);me.from_pydata(self.v,[],self.f);me.update()
        ca=me.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
        ca.data.foreach_set('color',[v for c in self.c for v in c])
        me.materials.append(MATS[0]);me.materials.append(MATS[1])
        for p,mi in zip(me.polygons,self.mi):p.material_index=mi
        # A simple per-face UV unwrap is retained for downstream material replacement.
        uv=me.uv_layers.new(name='UVMap')
        for p in me.polygons:
            axis=max(range(3),key=lambda a:abs(p.normal[a]));axes=[a for a in range(3) if a!=axis]
            for li in p.loop_indices:
                co=me.vertices[me.loops[li].vertex_index].co
                uv.data[li].uv=(co[axes[0]],co[axes[1]])
        obj=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(obj)
        return obj

def roof(m,x,y,w,d,z,kind='hip',rise=1.5,color='tile',neighbors=()):
    W=w/2+.25;D=d/2+.25
    if kind=='flat':
        m.box(x,y,z+.07,w,d,.14,'concrete')
        # Remove shared parapets instead of overlapping two coplanar roof edges.
        # Remaining segments preserve the visible perimeter of L/U-shaped envelopes.
        for axis,center,half,other,span in [(0,x,w/2,y,d),(1,y,d/2,x,w)]:
            for sign in (-1,1):
                edge=center+sign*half;probe=edge+sign*.10;segments=[(other-span/2,other+span/2)]
                for nv in neighbors:
                    nc=nv['x'] if axis==0 else nv['y'];ns=nv['w'] if axis==0 else nv['d']
                    oc=nv['y'] if axis==0 else nv['x'];os=nv['d'] if axis==0 else nv['w']
                    if not(nc-ns/2-.001<probe<nc+ns/2+.001 and nv['z']<z and nv['z']+nv['f']*3>=z-.01):continue
                    lo,hi=oc-os/2-.08,oc+os/2+.08;rest=[]
                    for a,b in segments:
                        if hi<=a or lo>=b:rest.append((a,b))
                        else:
                            if lo>a:rest.append((a,lo))
                            if hi<b:rest.append((hi,b))
                    segments=rest
                for a,b in segments:
                    if b-a<.04:continue
                    if axis==0:m.box(edge,(a+b)/2,z+.28,.16,b-a,.48,'white')
                    else:m.box((a+b)/2,edge,z+.28,b-a,.16,.48,'white')
        return
    # Closed roof volume, with gable infills; ridge orientation is deliberately varied.
    if kind in ('gable','hip'):
        r=max(0,D-W*.65) if kind=='hip' else D
        vs=[(x-W,y-D,z),(x+W,y-D,z),(x+W,y+D,z),(x-W,y+D,z),
            (x,y-r,z+rise),(x,y+r,z+rise)]
        fs=[(0,1,4),(1,2,5,4),(2,3,5),(3,0,4,5),(3,2,1,0)]
        if r<1e-6:m.poly(vs[:5],[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(3,2,1,0)],color)
        else:m.poly(vs,fs,color)
        if m.lod==0:
            m.beam(vs[4],vs[5],.12,color)
            # Roof courses follow each inclined surface, rather than a flat texture grid.
            for side in (-1,1):
                for t in (.18,.36,.54,.72,.90):
                    yy=D*(1-t)+r*t
                    m.beam((x+side*W*(1-t),y-yy,z+rise*t+.018),
                           (x+side*W*(1-t),y+yy,z+rise*t+.018),.027,'tile2')
    elif kind=='cross':
        # Ridge runs left-to-right, distinct from the front-facing gable.
        vs=[(x-W,y-D,z),(x+W,y-D,z),(x+W,y+D,z),(x-W,y+D,z),
            (x-W,y,z+rise),(x+W,y,z+rise)]
        m.poly(vs,[(0,1,5,4),(1,2,5),(2,3,4,5),(3,0,4),(3,2,1,0)],color)
        if m.lod==0:
            for side in (-1,1):
                for t in (.2,.4,.6,.8):m.beam((x-W,y+side*D*(1-t),z+rise*t+.02),(x+W,y+side*D*(1-t),z+rise*t+.02),.03,'tile2')
    elif kind=='shed':
        vs=[(x-W,y-D,z),(x+W,y-D,z),(x+W,y+D,z),(x-W,y+D,z),
            (x-W,y-D,z+.15),(x+W,y-D,z+rise),(x+W,y+D,z+rise),(x-W,y+D,z+.15)]
        m.poly(vs,[(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7),(3,2,1,0)],color)
    elif kind=='butterfly':
        vs=[(x-W,y-D,z),(x,y-D,z),(x+W,y-D,z),(x+W,y+D,z),(x,y+D,z),(x-W,y+D,z),
            (x-W,y-D,z+rise),(x,y-D,z+.15),(x+W,y-D,z+rise),(x+W,y+D,z+rise),(x,y+D,z+.15),(x-W,y+D,z+rise)]
        m.poly(vs,[(6,7,10,11),(7,8,9,10),(0,1,7,6),(1,2,8,7),(2,3,9,8),(3,4,10,9),(4,5,11,10),(5,0,6,11),(5,4,3,2,1,0)],color)
    if m.lod==0:
        m.box(x,y-D,z-.05,w+.55,.1,.18,'white');m.box(x,y+D,z-.05,w+.55,.1,.18,'white')

def facade_box(m,side,plane,u,z,w,h,depth,color,mat=0):
    if side in (0,2):m.box(u,plane,z,w,depth,h,color,mat)
    else:m.box(plane,u,z,depth,w,h,color,mat)

def window(m,side,plane,u,z,w=1.25,h=1.25,door=False):
    sign=-1 if side in (0,3) else 1
    # Opaque backing stands outside the wall; no implied interior behind the glazing.
    facade_box(m,side,plane+sign*.035,u,z,w+.16,h+.16,.07,'dark')
    facade_box(m,side,plane+sign*.078,u,z,w,h,.024,'wood' if door else 'glass',0 if door else 1)
    if m.lod==0:
        for du in (-w/2,w/2):facade_box(m,side,plane+sign*.10,u+du,z,.055,h+.12,.05,'white')
        for dz in (-h/2,h/2):facade_box(m,side,plane+sign*.10,u,z+dz,w+.1,.055,.05,'white')
        if not door:
            facade_box(m,side,plane+sign*.104,u,z,.045,h,.03,'metal')
            facade_box(m,side,plane+sign*.14,u,z-h/2-.08,w+.25,.09,.24,'stone')
            facade_box(m,side,plane+sign*.11,u+w*.24,z,w*.44,h*.86,.022,'glass2',1)
        else:facade_box(m,side,plane+sign*.15,u+w*.32,z,.035,.28,.055,'metal')

def rail(m,x,y,z,w,d,style=0):
    m.box(x,y,z,w,d,.15,'concrete')
    for yy in (y-d/2,):
        if style==1 or m.lod:
            m.box(x,yy,z+.53,w,.09,.92,'white' if style==1 else 'glass2',0 if style==1 else 1)
        else:
            for j in range(max(3,int(w/.65))+1):
                xx=x-w/2+w*j/max(3,int(w/.65));m.box(xx,yy,z+.52,.045,.045,1.02,'metal')
        m.box(x,yy,z+1.05,w+.06,.065,.065,'metal')
    for xx in (x-w/2,x+w/2):
        m.box(xx,y,z+.53,.065,d,.92,'glass2',1)
        m.box(xx,y,z+1.05,.07,d,.065,'metal')

def porch(m,x,y,w,d,z=2.75,kind='flat'):
    for xx in (x-w/2+.14,x+w/2-.14):m.box(xx,y-d/2+.15,z/2,.18,.18,z,'white')
    if kind=='pergola':
        for j in range(max(4,int(w/.5))):m.box(x-w/2+w*j/max(3,int(w/.5)-1),y,z,.12,d,.2,'wood')
        m.box(x,y-d/2,z-.14,w,.15,.2,'wood');m.box(x,y+d/2,z-.14,w,.15,.2,'wood')
    else:roof(m,x,y,w,d,z,kind,.65,'tile')

def vol(x,y,w,d,f=1,z=0,roofkind='flat',tone='white'):
    return dict(x=x,y=y,w=w,d=d,f=f,z=z,roof=roofkind,tone=tone)

HOUSE_NAMES=['Compacta quatro águas','Colonial com varanda','Geminada estreita','Volumes contemporâneos','Pátio em L',
 'Cobertura inclinada','Cobertura borboleta','Telhado transversal','Duas empenas','Pátio em U',
 'Varanda de esquina','Garagem lateral','Pórtico modernista','Volumes escalonados','Casa de vila',
 'Pátio com pergolado','Térrea horizontal','Chalé urbano','Anexo lateral','Fachada com brises']
SOB_NAMES=['Sobrado colonial','Sobrado com alpendre','Sacada frontal','Caixa em balanço','Sobrado em L',
 'Cobertura de uma água','Dupla empena','Terraço recuado','Garagem lateral coberta','Pátio em U',
 'Esquina com varanda','Volume vertical de tijolo','Pórtico duplo','Pavimento recuado','Vila de dois pisos',
 'Pátio e pergolado','Sobrado horizontal','Empena alta','Anexo térreo','Brises e terraço']
TOWER_NAMES=['Bloco de três pisos','Lâmina de quatro pisos','Residencial com sacadas','Torre compacta',
 'Torre em L','Pátio residencial em U','Duas torres conectadas','Torre com coroamento recuado',
 'Sacadas alternadas','Lâmina com brises','Torre de esquina','Residencial escalonado',
 'Bloco com pilotis','Torre com base comercial','Lâmina de tijolos','Torre com varanda contínua',
 'Volumes em H','Torre esbelta','Terraços em cascata','Conjunto assimétrico']

def house_config(i,sob=False):
    f=2 if sob else 1
    # Each entry specifies a different envelope/roof/implantation, not a colour seed.
    cfg=[
      [vol(0,0,7.2,9,f,roofkind='hip',tone='cream')],
      [vol(0,.5,9,9,f,roofkind='cross',tone='ochre')],
      [vol(0,0,5.4,12,f,roofkind='gable',tone='sage')],
      [vol(-1.5,.4,5.8,9,f,roofkind='flat'),vol(3,-1.2,3.4,6.2,1,roofkind='flat',tone='stone')],
      [vol(-2,0,4.2,11,f,roofkind='flat'),vol(2.9,3.3,5.6,4.4,f,roofkind='flat',tone='sand')],
      [vol(0,0,7.6,9.5,f,roofkind='shed',tone='blue')],
      [vol(-2,0,4.2,10,f,roofkind='gable'),vol(2.5,1.2,4.2,7.6,f,roofkind='gable',tone='brick')] if sob else [vol(0,0,9,9,1,roofkind='butterfly')],
      [vol(0,0,8.6,10,1,roofkind='flat',tone='sand'),vol(0,1.8,7.4,6.4,1,z=3,roofkind='flat')] if sob else [vol(0,0,8.6,10,1,roofkind='cross',tone='sand')],
      [vol(-2,0,4.4,10,f,roofkind='gable',tone='cream'),vol(2.5,1.5,4.4,7,f if not sob else 1,roofkind='gable',tone='sage')],
      [vol(-3.6,0,3.4,10,f,roofkind='hip'),vol(3.6,0,3.4,10,f,roofkind='hip'),vol(0,3.4,4,3.2,f,roofkind='cross',tone='sand')],
      [vol(0,0,7.2,8.5,f,roofkind='hip',tone='sage')],
      [vol(-1.7,.8,6.4,10,f,roofkind='hip',tone='brick'),vol(3.3,-1.5,3.5,5.4,1,roofkind='flat',tone='stone')],
      [vol(0,0,9.2,9,f,roofkind='flat',tone='white')],
      [vol(0,0,10.4,9,1,roofkind='flat',tone='concrete'),vol(-1.5,1.1,6.2,6.8,1,z=3 if sob else .75,roofkind='flat')],
      [vol(0,0,4.8,10.6,f,roofkind='cross',tone='ochre')],
      [vol(-3,0,3.5,10,f,roofkind='flat'),vol(3,0,3.5,10,1,roofkind='flat',tone='brick'),vol(0,3.4,3,3.2,1,roofkind='flat')],
      [vol(0,0,13.2,7.6,f,roofkind='hip',tone='cream')],
      [vol(0,0,6.4,8.2,f,roofkind='gable',tone='wood')],
      [vol(-1.7,0,6.2,9.5,f,roofkind='cross'),vol(3,2,3.2,5.5,1,roofkind='shed',tone='sage')],
      [vol(-1.2,0,7,10,f,roofkind='flat'),vol(3.5,2,2.4,6,1,roofkind='flat',tone='brick')]
    ][i]
    if sob and i==3:
        cfg=[vol(0,0,6.2,8.4,1,roofkind='flat',tone='stone'),vol(-.7,-.8,8,9.2,1,z=3,roofkind='flat')]
    return cfg

def tower_config(i):
    n=[3,4,5,7,8,4,9,12,10,6,11,8,5,14,6,16,10,20,9,13][i]
    if i==4:vs=[vol(-3,0,8,18,n),vol(5,5,8,8,n,tone='sand')]
    elif i==5:vs=[vol(-7,0,6,20,n),vol(7,0,6,20,n),vol(0,7,8,6,n,tone='brick')]
    elif i==6:vs=[vol(-7,0,9,12,n),vol(7,1,9,10,n-2,tone='sand'),vol(0,3,5,5,2)]
    elif i==7:vs=[vol(0,0,13,13,n-2),vol(0,1,9,9,2,z=(n-2)*3,tone='stone')]
    elif i==11:vs=[vol(-4,0,8,14,n),vol(3,1,6,12,n-2,tone='sand'),vol(8,2,4,10,n-4,tone='stone')]
    elif i==12:vs=[vol(0,0,20,10,n,z=3,tone='white')]
    elif i==13:vs=[vol(0,0,21,17,1,tone='stone'),vol(0,2,11,11,n-1,z=3)]
    elif i==16:vs=[vol(-6,0,6,16,n),vol(6,0,6,16,n,tone='concrete'),vol(0,0,6,6,n-1,tone='brick')]
    elif i==18:vs=[vol(0,2,16,10,n-3),vol(0,3,13,8,2,z=(n-3)*3),vol(0,4,9,6,1,z=(n-1)*3,tone='sand')]
    elif i==19:vs=[vol(-4,2,9,12,n),vol(5,0,8,16,n-4,tone='stone')]
    else:
        w,d=[(15,10),(22,10),(14,12),(10,10),(12,12),(12,12),(12,12),(12,12),(12,14),(22,10),(14,14),(12,12),(20,10),(11,11),(24,10),(16,13),(12,12),(9,10),(16,14),(12,12)][i]
        vs=[vol(0,0,w,d,n,tone='brick' if i==14 else ('sand' if i in (1,9) else 'white'))]
    return vs,n

def covered(vs,cur,x,y,z):
    return any(v is not cur and v['x']-v['w']/2-.005<x<v['x']+v['w']/2+.005 and v['y']-v['d']/2-.005<y<v['y']+v['d']/2+.005 and v['z']-.01<z<v['z']+v['f']*3+.01 for v in vs)

def build(category,i,lod):
    m=Mesh(lod);tower=category=='predios';sob=category=='sobrados'
    vs,n=tower_config(i) if tower else (house_config(i,sob),2 if sob else 1)
    for v in vs:
        x,y,w,d,f,z=v['x'],v['y'],v['w'],v['d'],v['f'],v['z'];h=f*3
        m.box(x,y,z+h/2,w,d,h,v['tone'])
        m.box(x,y,z+.12,w+.12,d+.12,.24,'stone')
        if not any(o is not v and o['z']>=z+h-.05 and abs(o['x']-x)<w/2 and abs(o['y']-y)<d/2 for o in vs):
            roof(m,x,y,w,d,z+h,v['roof'],min(w*.23,1.85),'slate' if i in (5,6,12,19) else 'tile',vs)
        for floor in range(f):
            zz=z+floor*3
            if tower or sob:
                m.box(x,y,zz+2.92,w+.16,d+.16,.14,'concrete')
            for side in range(4):
                length=w if side in (0,2) else d
                plane=(y+(-d/2 if side==0 else d/2)) if side in (0,2) else (x+(w/2 if side==1 else -w/2))
                center=x if side in (0,2) else y
                cnt=max(1,int(length/(3.1 if tower else 3.0)))
                for j in range(cnt):
                    u=center+(j-(cnt-1)/2)*(length/cnt)
                    sign=-1 if side in (0,3) else 1
                    wx,wy=(u,plane+sign*.18) if side in (0,2) else (plane+sign*.18,u)
                    if covered(vs,v,wx,wy,zz+1.5):continue
                    entry=side==0 and floor==0 and z==0 and j==cnt//2
                    garage=entry and not tower and v is vs[-1] and (i==11 or (sob and i==8))
                    balcony=tower and floor>0 and side==0 and i in (2,3,4,6,7,8,10,15,17,19) and (i!=8 or (floor+j)%2==0)
                    house_balcony=sob and abs(zz-3)<.01 and side==0 and abs(u-x)<w*.34 and i in (0,2,3,4,7,8,9,10,12,13,16,18,19)
                    tall=entry or balcony or house_balcony
                    window(m,side,plane,u,zz+(1.12 if tall else 1.65),2.7 if garage else (.95 if entry else (1.6 if tower else 1.3)),2.15 if tall else 1.3,entry)
                    if garage and lod==0:
                        for bar in range(9):facade_box(m,side,plane-.12,u,.24+bar*.23,2.65,.035,.04,'metal')
                    if balcony:rail(m,u,plane-.73,zz+.05,min(length/cnt-.3,2.7),1.35,i%2)
            if tower and i in (9,14) and lod==0:
                for a in range(max(2,int(w/2))):
                    xx=x-w/2+.5+a*(w-1)/max(1,int(w/2)-1)
                    m.box(xx,y-d/2-.2,zz+1.5,.14,.48,2.85,'brick' if i==9 else 'concrete')
        if tower:
            # Lift/stair enclosure sits on the roof and provides a recognisable crown.
            m.box(x,y+d*.18,z+h+.8,min(3.2,w*.32),min(3.4,d*.3),1.6,'stone')
    main=vs[0];x,y,w,d=main['x'],main['y'],main['w'],main['d'];front=y-d/2
    if not tower:
        if i in (0,1,10,16,17):porch(m,x,front-1.1,w if i!=0 else w*.55,2.2,2.7,'cross' if i in (1,17) else 'flat')
        if i in (4,15):porch(m,0,-2,3,3,2.65,'pergola')
        if i in (11,18):porch(m,x+w/2+1.5,front+2,3,4,2.7,'flat')
        if i in (3,12):
            zz=6.1 if sob else 3.2
            m.box(x,front-.55,zz,w+.7,1.1,.24,'concrete')
            for xx in (x-w/2-.24,x+w/2+.24):m.box(xx,front-.55,zz/2,.24,1.1,zz,'concrete')
        if sob and i in (0,2,3,4,7,8,9,10,12,13,16,18,19):
            by=vs[1]['y']-vs[1]['d']/2 if i==3 else front
            rail(m,x,by-.8,3.05,w*.68,1.6,1 if i in (0,9) else 0)
        if i in (5,11,19) and lod==0:
            for j in range(7):m.box(x-w*.32+j*.18,front-.18,1.55,.085,.24,2.6,'wood')
        if i in (12,19) and lod==0:
            # Domestic roof hardware, deliberately limited to near LOD.
            for j in range(2):m.box(x-.8+j*1.4,y+1,main['z']+main['f']*3+.18,1.15,2,.08,'glass',1)
        # Entry landing, entirely part of the asset (not a large generic lot slab).
        m.box(x,front-.32,.07,1.35,.65,.14,'stone')
    else:
        if i==12:
            for xx in (-8,-4,0,4,8):
                for yy in (-3.8,3.8):m.box(xx,yy,1.5,.5,.5,3,'concrete')
            m.box(0,0,1.5,4,4,3,'stone');window(m,0,-2,0,1.2,1.8,2.3,True)
        else:porch(m,x,front-1.0,min(w*.65,7),2,2.65,'flat')
        if i in (3,7,10,17):
            m.box(x-w*.36,y,n*1.5,.38,d+.35,n*3,'stone')
    obj=m.make('GEO-'+category+'-'+str(i+1).zfill(2)+'-LOD'+str(lod))
    # Recenter geometry, retaining a ground-level origin and identity object transforms.
    mins=[min(v.co[a] for v in obj.data.vertices) for a in range(3)]
    maxs=[max(v.co[a] for v in obj.data.vertices) for a in range(3)]
    shift=Vector(((mins[0]+maxs[0])/2,(mins[1]+maxs[1])/2,mins[2]))
    for vert in obj.data.vertices:vert.co-=shift
    obj['geometry_offset']=list(shift)
    obj['category']=category;obj['variant']=i+1;obj['lod']=lod;obj['front']='-Y';obj['illustrative']=True
    obj.data.update();return obj,n

def setup():
    global MATS
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene=bpy.context.scene;scene.name='Biblioteca urbana / 60 exteriores'
    scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
    MATS=[material('MAT-envelope-cor-vertice',.77),material('MAT-vidro-opaco-cor-vertice',.24)]
    world=bpy.data.worlds.new('WORLD-studio');scene.world=world;world.use_nodes=True
    world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.7,.77,.85,1)
    world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.3
    scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
    # CPU is a portable baseline; configure an available accelerator if present.
    try:
        cp=bpy.context.preferences.addons['cycles'].preferences
        cp.compute_device_type='CUDA';cp.get_devices()
        gpu=[d for d in cp.devices if d.type=='CUDA']
        if gpu:
            for dev in cp.devices:dev.use=dev.type=='CUDA'
            scene.cycles.device='GPU'
    except Exception:pass
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    scene.render.resolution_x=480;scene.render.resolution_y=480;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
    scene.render.film_transparent=True
    camd=bpy.data.cameras.new('CAM-catalogo');cam=bpy.data.objects.new('CAM-catalogo',camd)
    scene.collection.objects.link(cam);scene.camera=cam;camd.type='ORTHO';camd.clip_end=2000
    for name,loc,energy,size in [('key',(-30,-40,65),28000,25),('fill',(40,-15,40),10000,35),('rim',(10,30,60),18000,25)]:
        ld=bpy.data.lights.new('LGT-'+name,'AREA');ld.energy=energy;ld.shape='DISK';ld.size=size
        ob=bpy.data.objects.new('LGT-'+name,ld);scene.collection.objects.link(ob);ob.location=loc
        ob.rotation_euler=(Vector((0,0,8))-ob.location).to_track_quat('-Z','Y').to_euler()
    ground=Mesh(0);ground.box(0,0,-.11,500,500,.2,'white');g=ground.make('GEO-studio-ground')
    g.is_shadow_catcher=True
    return scene

def frame(obj,back=False):
    scene=bpy.context.scene;cam=scene.camera
    vs=[obj.matrix_world@Vector(v) for v in obj.bound_box]
    center=sum(vs,Vector())/8
    direction=Vector((1.15,-1.6,1.15) if not back else (-1.15,1.6,1.15)).normalized()
    extent=max(obj.dimensions);cam.location=center+direction*max(40,extent*3)
    cam.rotation_euler=(-direction).to_track_quat('-Z','Y').to_euler()
    rot=cam.rotation_euler.to_matrix().transposed();points=[rot@(v-center) for v in vs]
    cam.data.ortho_scale=max(max(v.x for v in points)-min(v.x for v in points),max(v.y for v in points)-min(v.y for v in points))*1.16
    # The lights track the subject; this keeps tall towers from losing their upper floors.
    for ob in scene.objects:
        if ob.type=='LIGHT':ob.rotation_euler=(center-ob.location).to_track_quat('-Z','Y').to_euler()

def geometry_report(obj):
    me=obj.data;me.calc_loop_triangles()
    bad=sum(1 for p in me.polygons if p.area<1e-10)
    bad_triangles=sum(1 for t in me.loop_triangles if t.area<1e-10)
    finite=all(math.isfinite(c) for v in me.vertices for c in v.co)
    return dict(vertices=len(me.vertices),triangles=len(me.loop_triangles),materials=len(me.materials),
        dimensions_m=[round(v,3) for v in obj.dimensions],degenerate_faces=bad,degenerate_triangles=bad_triangles,finite=finite,
        geometry_sha256=hashlib.sha256(str([(tuple(round(c,4) for c in v.co)) for v in me.vertices]).encode()).hexdigest())

def main():
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    preview='--preview' in args;export='--export' in args;check='--check' in args
    only=next((set(a.split('=',1)[1].split(',')) for a in args if a.startswith('--only=')),None)
    completed=set()
    if '--resume' in args:
        completed={x['id'] for x in json.loads((ROOT/'validation'/'progress.json').read_text(encoding='utf-8'))}
    scene=setup();records=[];objects=[]
    for category,names in [('casas',HOUSE_NAMES),('sobrados',SOB_NAMES),('predios',TOWER_NAMES)]:
        for i in range(20):
            if preview and i not in (0,4,6,12,17):continue
            ident=f'{category}-{i+1:02}'
            if only and ident not in only:continue
            obj,floors=build(category,i,0);bpy.context.view_layer.update()
            report=geometry_report(obj)
            assert report['finite'] and report['degenerate_faces']==0 and report['degenerate_triangles']==0,(ident,report)
            assert report['triangles']<40000,(ident,report['triangles'])
            obj['label']=names[i];obj['floors']=floors
            objects.append(obj)
            record=dict(id=ident,name=names[i],category=category,floors=floors,lod0=report)
            frame(obj)
            if not export and not check and ident not in completed:
                scene.render.filepath=str(ROOT/'previas'/f'{ident}.png')
                bpy.ops.render.render(write_still=True)
                if i in (0,4,6,12,17):
                    frame(obj,True);scene.render.filepath=str(ROOT/'previas'/f'{ident}-verso.png');bpy.ops.render.render(write_still=True)
            obj.hide_render=True
            low,_=build(category,i,1)
            delta=Vector(low['geometry_offset'])-Vector(obj['geometry_offset'])
            for vert in low.data.vertices:vert.co+=delta
            low['geometry_offset']=obj['geometry_offset'];low.data.update()
            bpy.context.view_layer.update();record['lod1']=geometry_report(low)
            assert record['lod1']['triangles']<report['triangles']
            assert record['lod1']['finite'] and record['lod1']['degenerate_faces']==0 and record['lod1']['degenerate_triangles']==0
            low.hide_render=True
            if export:
                for target,folder in [(obj,'glb'),(low,'glb_lod1')]:
                    bpy.ops.object.select_all(action='DESELECT');target.select_set(True);bpy.context.view_layer.objects.active=target
                    path=ROOT/folder/f'{ident}.glb'
                    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
                        export_animations=False,export_yup=True,export_materials='EXPORT',export_extras=True)
                    record['lod0' if folder=='glb' else 'lod1']['file']=str(path.relative_to(ROOT)).replace('\\','/')
                    record['lod0' if folder=='glb' else 'lod1']['bytes']=path.stat().st_size
                bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
                bpy.ops.export_scene.fbx(filepath=str(ROOT/'fbx'/f'{ident}.fbx'),use_selection=True,
                    object_types={'MESH'},bake_anim=False,apply_unit_scale=True,axis_forward='-Y',axis_up='Z',use_mesh_modifiers=True)
            records.append(record)
            print('ASSET_DONE',ident,report['triangles'],flush=True)
            (ROOT/'validation'/('preflight.json' if check else ('progress-select.json' if only else 'progress.json'))).write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
    if export:
        assert len(records)==60 and len({r['lod0']['geometry_sha256'] for r in records})==60
        # Keep each family in its own Blender collection and each near mesh available as an asset.
        for ci,category in enumerate(('casas','sobrados','predios')):
            coll=bpy.data.collections.new('COL-'+category);scene.collection.children.link(coll)
            lodcoll=bpy.data.collections.new('COL-'+category+'-LOD1');scene.collection.children.link(lodcoll);lodcoll.hide_render=True;lodcoll.hide_viewport=True
            for i in range(20):
                for lod in (0,1):
                    ob=bpy.data.objects[f'GEO-{category}-{i+1:02}-LOD{lod}']
                    for old in list(ob.users_collection):old.objects.unlink(ob)
                    (coll if lod==0 else lodcoll).objects.link(ob)
                    ob.location=((i%5)*32,ci*120+(i//5)*28,0)
                    ob.hide_render=lod==1
                    if lod==0:
                        ob.asset_mark()
                        thumb=ROOT/'previas'/f'{category}-{i+1:02}.png'
                        if thumb.exists():
                            try:
                                with bpy.context.temp_override(id=ob):bpy.ops.ed.lib_id_load_custom_preview(filepath=str(thumb))
                            except RuntimeError as exc:print('PREVIEW_NOTE',str(exc))
        scene.camera.location=(245,-125,245)
        scene.camera.rotation_euler=(Vector((65,150,15))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
        scene.camera.data.ortho_scale=390
        bpy.data.objects['GEO-studio-ground'].hide_viewport=True
        bpy.data.objects['GEO-studio-ground'].location.y=140
        for screen in bpy.data.screens:
            for area in screen.areas:
                if area.type=='VIEW_3D':
                    area.spaces.active.shading.type='MATERIAL'
                    area.spaces.active.clip_end=2500
                    area.spaces.active.region_3d.view_distance=300
                    area.spaces.active.region_3d.view_location=(60,150,12)
                    area.spaces.active.region_3d.view_rotation=scene.camera.rotation_euler.to_quaternion()
        (ROOT/'catalogo.json').write_text(json.dumps(dict(version=1,units='meters',front_blender='-Y',front_glb='+Z',illustrative=True,assets=records),ensure_ascii=False,indent=2),encoding='utf-8')
        bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'biblioteca_60.blend'))
    print('COMPLETE',len(records),flush=True)

if __name__=='__main__':main()

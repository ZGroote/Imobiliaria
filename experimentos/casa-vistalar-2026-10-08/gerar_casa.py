"""Casa VistaLar: estudo de fachada inspirado na referência fornecida.

Executar no Blender: blender -b --factory-startup --python gerar_casa.py -- --preview
Sem bibliotecas externas ou downloads. Todas as medidas estão em metros.
"""
import bpy
import math
import random
import json
import sys
import time
from pathlib import Path
from mathutils import Vector

OUT = Path(__file__).resolve().parent
OUT.mkdir(parents=True, exist_ok=True)
R = random.Random(2718)
PREVIEW = '--preview' in sys.argv
BUILD_ONLY = '--build-only' in sys.argv
START = time.perf_counter()
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for d in list(bpy.data.materials):
    bpy.data.materials.remove(d)

scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
collections = {}
for name in ['01 Arquitetura', '02 Interiores', '03 Paisagismo', '04 Veiculos', '05 Contexto', '06 Luz e cameras']:
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    collections[name] = c
ACTIVE = collections['01 Arquitetura']
BOX_MESHES = {}
CYLINDER_MESHES = {}

def group(obj):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    ACTIVE.objects.link(obj)
    return obj

def material(name, color, rough=.5, metal=0, transmission=0, coat=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    p.inputs['Transmission Weight'].default_value = transmission
    p.inputs['Coat Weight'].default_value = coat
    return m

def texture(m, a, b, scale=3, bump=.015, stretch=None):
    n, l = m.node_tree.nodes, m.node_tree.links
    p = n.get('Principled BSDF')
    tc = n.new('ShaderNodeTexCoord')
    noise = n.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = scale
    noise.inputs['Detail'].default_value = 3
    if stretch:
        v = n.new('ShaderNodeVectorMath'); v.operation = 'MULTIPLY'
        v.inputs[1].default_value = stretch
        l.new(tc.outputs['Object'], v.inputs[0]); l.new(v.outputs[0], noise.inputs['Vector'])
    else:
        l.new(tc.outputs['Object'], noise.inputs['Vector'])
    ramp = n.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = .22
    ramp.color_ramp.elements[0].color = (*a, 1)
    ramp.color_ramp.elements[1].position = .78
    ramp.color_ramp.elements[1].color = (*b, 1)
    l.new(noise.outputs['Fac'], ramp.inputs[0]); l.new(ramp.outputs[0], p.inputs['Base Color'])
    fine = n.new('ShaderNodeTexNoise'); fine.inputs['Scale'].default_value = 95
    l.new(tc.outputs['Object'], fine.inputs['Vector'])
    bn = n.new('ShaderNodeBump'); bn.inputs['Strength'].default_value = .28
    bn.inputs['Distance'].default_value = bump
    l.new(fine.outputs['Fac'], bn.inputs['Height']); l.new(bn.outputs[0], p.inputs['Normal'])
    return m

stone = texture(material('MAT | Limestone ivory', (.63,.59,.51), .73), (.54,.50,.43), (.72,.67,.59), 1.8, .003)
plaster = texture(material('MAT | Warm white mineral plaster', (.78,.77,.70), .85), (.75,.74,.68), (.81,.80,.74), 2, .0015)
concrete = texture(material('MAT | Architectural concrete', (.42,.43,.42), .8), (.35,.36,.35), (.51,.51,.48), 3, .004)
paving = texture(material('MAT | Large stone pavers', (.46,.45,.41), .78), (.38,.38,.35), (.57,.55,.49), 4, .003)
road = texture(material('MAT | Fine asphalt', (.075,.085,.095), .91), (.058,.066,.075), (.105,.115,.12), 9, .005)
wood = texture(material('MAT | Thermowood warm oak', (.27,.13,.055), .44, coat=.15), (.12,.048,.019), (.40,.22,.10), 4, .001, (7,7,.16))
wood_h = texture(material('MAT | Oak soffit horizontal', (.27,.13,.055), .48), (.18,.082,.03), (.43,.25,.13), 4, .0008, (.15,8,8))
black = material('MAT | Anodized charcoal', (.018,.022,.024), .29, 1)
dark = material('MAT | Shadow reveals', (.035,.035,.03), .85)
glass = material('MAT | Clear architectural glass', (.92,.97,.96), .035, transmission=1)
glass.node_tree.nodes.get('Principled BSDF').inputs['IOR'].default_value = 1.46
cloth = texture(material('MAT | Linen sand', (.60,.52,.41), .9), (.50,.42,.33), (.72,.65,.54), 30, .0009)
fabric = material('MAT | Cream upholstery', (.71,.68,.58), .92)
fabric.node_tree.nodes.get('Principled BSDF').inputs['Sheen Weight'].default_value = .3
rubber = texture(material('MAT | Rubber', (.011,.012,.013), .9), (.006,.007,.008), (.02,.02,.02), 38, .001)
chrome = material('MAT | Brushed alloy', (.55,.56,.57), .21, 1)
soil = texture(material('MAT | Garden mulch', (.057,.037,.02), .95), (.03,.021,.013), (.095,.07,.035), 18, .007)
grassmat = texture(material('MAT | Lawn', (.10,.17,.035), .96), (.045,.085,.016), (.19,.26,.052), 4, .001)
bark = texture(material('MAT | Olive bark', (.13,.10,.058), .95), (.07,.052,.03), (.22,.18,.10), 5, .012, (2,2,.35))
leaves=[]
for i,c in enumerate([(.055,.10,.022),(.10,.17,.045),(.16,.22,.075),(.21,.27,.11),(.09,.14,.06)]):
    m=material('MAT | Foliage '+str(i), c, .8)
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Subsurface Weight'].default_value=0
    p.inputs['Sheen Weight'].default_value=.12
    leaves.append(m)
emissive = material('MAT | Warm LED', (1,.58,.20), .35)
p=emissive.node_tree.nodes.get('Principled BSDF')
p.inputs['Emission Color'].default_value=(1,.57,.20,1)
p.inputs['Emission Strength'].default_value=5

def box(name, loc, size, mat, bevel=.015):
    key=(tuple(size),mat.name if mat else None)
    data=BOX_MESHES.get(key)
    if data is None:
        a,b,c=[s*.5 for s in size]
        data=bpy.data.meshes.new(name)
        data.from_pydata([(-a,-b,-c),(a,-b,-c),(a,b,-c),(-a,b,-c),(-a,-b,c),(a,-b,c),(a,b,c),(-a,b,c)],[],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
        data.update()
        if mat:data.materials.append(mat)
        BOX_MESHES[key]=data
    o=bpy.data.objects.new('GEO-'+name,data);ACTIVE.objects.link(o);o.location=loc
    if bevel:
        mod=o.modifiers.new('Small real-world edge', 'BEVEL'); mod.width=bevel; mod.segments=2
        mod.affect='EDGES'
        mod=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    return o

def sphere(name,loc,size,mat,segments=16,rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=loc)
    o=group(bpy.context.object);o.name='GEO-'+name;o.scale=size
    if mat:o.data.materials.append(mat)
    for p in o.data.polygons:p.use_smooth=True
    return o

def cylinder(name,a,b,r,mat,vertices=10,r2=None):
    a,b=Vector(a),Vector(b);delta=b-a
    r2=r if r2 is None else r2
    key=(round(delta.length,6),r,r2,mat.name,vertices)
    data=CYLINDER_MESHES.get(key)
    if data is None:
        vs=[(rad*math.cos(j*math.tau/vertices),rad*math.sin(j*math.tau/vertices),z) for rad,z in [(r,-delta.length*.5),(r2,delta.length*.5)] for j in range(vertices)]
        fs=[(j,(j+1)%vertices,(j+1)%vertices+vertices,j+vertices) for j in range(vertices)]
        fs.extend([tuple(reversed(range(vertices))),tuple(range(vertices,vertices*2))])
        data=bpy.data.meshes.new(name);data.from_pydata(vs,[],fs);data.update();data.materials.append(mat)
        for p in data.polygons:p.use_smooth=len(p.vertices)==4
        CYLINDER_MESHES[key]=data
    o=bpy.data.objects.new('GEO-'+name,data);ACTIVE.objects.link(o);o.location=(a+b)*.5
    o.rotation_euler=delta.to_track_quat('Z','Y').to_euler()
    return o

def mesh(name,verts,faces,mat):
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    o=bpy.data.objects.new('GEO-'+name,me);ACTIVE.objects.link(o)
    if mat:me.materials.append(mat)
    return o

def aim(obj,at):obj.rotation_euler=(Vector(at)-obj.location).to_track_quat('-Z','Y').to_euler()

def light(name,loc,energy,color=(1,.76,.5),size=1,target=None):
    data=bpy.data.lights.new(name,'AREA'); data.energy=energy;data.color=color;data.shape='DISK';data.size=size
    o=bpy.data.objects.new(name,data);collections['06 Luz e cameras'].objects.link(o);o.location=loc
    if target:aim(o,target)
    return o

# Blockout: nested monolithic volumes, open front, realistic wall thickness.
box('Main raised foundation',(-2.8,4,.29),(8,8.5,.36),concrete)
box('Lower living floor',(-3.15,3.8,.51),(6.7,7.5,.16),stone)
box('Rear wall',(-2.95,7.4,3.65),(7.5,.24,6.3),plaster)
box('West flank',(-6.65,3.7,3.65),(.25,7.6,6.3),plaster)
box('East main flank',(.7,3.7,3.65),(.25,7.6,6.3),plaster)
box('Roof slab',(-2.95,3.7,6.72),(7.75,7.9,.30),stone)
box('Roof dark reveal',(-2.95,.03,6.50),(7.32,.16,.065),dark,.002)
box('Feature vertical limestone fin',(-6.65,-.01,3.55),(.49,.83,6.04),stone)
box('Upper horizontal portal',(-2.95,-.03,6.62),(7.1,.68,.37),stone)
box('Upper right portal',(.49,.0,5.10),(.40,.69,3.0),stone)
box('Upper balcony slab',(-4.19,-.03,3.62),(4.60,1.1,.25),stone)
box('Upper suite floor',(-2.94,4,3.6),(7.4,6.9,.22),wood_h)
box('Tall glazing top left',(-5.1,.34,6.31),(2.65,.17,.08),black,.004)
box('Tall glazing bottom left',(-5.1,.34,.65),(2.65,.17,.075),black,.004)
for x in [-6.37,-5.08,-3.76]:
    box('Tall glass vertical frame',(x,.35,3.46),(.045,.12,5.69),black,.004)
for x in [-5.72,-4.42]:
    box('Double height glazing',(x,.39,3.46),(1.24,.012,5.59),glass,.001)
box('Tall window horizontal transom',(-5.06,.32,3.61),(2.64,.15,.065),black,.003)
# Lower entry and timber door.
box('Entrance side wall',(-1.58,.85,1.93),(4.36,.20,2.77),plaster)
box('Entrance recess',(-2.56,.71,1.88),(1.88,.08,2.66),dark,.002)
box('Oak pivot door',(-2.56,.64,1.88),(1.52,.11,2.59),wood,.006)
for x in [-3.26+i*.085 for i in range(18)]:
    box('Door vertical board',(x,.574,1.88),(.063,.023,2.59),wood,.001)
box('Door pull',(-1.96,.50,1.86),(.028,.06,.85),black,.006)
box('Entrance glass sidelight',(-1.58,.65,1.89),(.28,.022,2.61),glass,.001)
box('Entry overhead shadow gap',(-2.02,.18,3.34),(3.9,.08,.08),dark,.001)
# Recessed upper bedroom glazing and balcony.
box('Upper facade backing',(-.59,.78,5.09),(1.88,.16,2.66),wood_h)
box('Suite glass',(-2.74,.53,5.06),(2.1,.014,2.37),glass,.001)
for x in [-3.79,-2.74,-1.69]:box('Suite glass frame',(x,.50,5.06),(.045,.12,2.45),black,.002)
for z in [3.84,6.29]:box('Suite glass track',(-2.74,.51,z),(2.15,.13,.055),black,.002)
for i in range(28):
    x=-1.52+i*.063
    box('Upper brise oak slat',(x,.17,5.075),(.037,.22,2.42),wood,.003)
box('Balcony glass rail',(-4.18,-.57,4.19),(4.4,.017,.95),glass,.001)
box('Balcony top bronze rail',(-4.18,-.57,4.69),(4.47,.026,.025),black,.003)
for x in [-6.30,-4.13,-1.98]:box('Balcony bottom glass clamp',(x,-.57,3.73),(.07,.06,.09),chrome,.004)
box('Upper balcony oak ceiling',(-3.91,.14,6.39),(4.86,1.04,.10),wood_h,.003)
box('Upper curtain left',(-3.58,1.08,5.03),(.30,.12,2.33),cloth,.025)
box('Upper curtain right',(-1.82,1.08,5.03),(.27,.12,2.33),cloth,.025)
# Garage canopy with inset oak soffit, thin reveal and clean outer frame.
box('Garage paved floor',(4.24,2.60,.43),(7.25,6.80,.20),paving)
box('Garage rear wall',(4.3,6.05,1.93),(7.15,.24,3.05),concrete)
box('Garage right pier',(7.69,2.62,1.97),(.33,7.25,3.22),stone)
box('Garage canopy slab',(4.14,2.59,3.48),(7.50,7.32,.34),stone)
box('Garage fascia upper',(4.14,-1.06,3.48),(7.50,.15,.36),stone)
box('Garage soffit',(4.14,2.5,3.279),(7.10,6.91,.075),wood_h,.005)
box('Garage soffit reveal',(4.1,-.97,3.285),(7.05,.07,.055),dark,.002)
for i in range(24):box('Garage soffit board seam',(.66+i*.298,2.5,3.233),(.009,6.89,.003),dark,0)
box('Garage LED profile',(4.16,-.85,3.229),(6.80,.018,.012),emissive,.001)
for x in [1.5,3.55,5.60,7.05]:
    for y in [.20,3.20]:
        cylinder('Recessed downlight trim',(x,y,3.222),(x,y,3.239),.070,black,20)
        cylinder('Recessed downlight emitter',(x,y,3.218),(x,y,3.220),.051,emissive,20)
        light('LGT | garage downlight',(x,y,3.19),35,size=.14,target=(x,y,.5))
light('LGT | canopy warm bounce',(4.2,1.8,3.15),160,size=4,target=(4.2,2,.4))
# Small address plate in understated architectural lettering.
box('Address plate',(-.40,.69,1.91),(.52,.10,.70),stone,.01)
font=bpy.data.curves.new('Number 27','FONT');font.body='27';font.size=.23;font.extrude=.001;font.align_x='CENTER'
o=bpy.data.objects.new('GEO-Address 27',font);ACTIVE.objects.link(o);o.location=(-.40,.625,1.95);o.rotation_euler=(math.pi/2,0,0);o.data.materials.append(black)

ACTIVE=collections['02 Interiores']
# Warm living-room staging visible through glazing.
box('Living interior rug',(-4.75,3.0,.617),(2.6,3.8,.014),cloth,.02)
box('Sofa base',(-4.81,3.8,.84),(2.25,.99,.33),fabric,.11)
box('Sofa back',(-4.81,4.21,1.22),(2.25,.23,.77),fabric,.09)
for x in [-5.83,-3.78]:box('Sofa arm',(x,3.82,1.14),(.21,1.01,.66),fabric,.075)
for x in [-5.28,-4.35]:box('Sofa cushion',(x,3.72,1.04),(.91,.77,.19),fabric,.06)
for x in [-5.42,-4.80,-4.14]:
    o=box('Linen sofa pillow',(x,4.03,1.37),(.42,.15,.38),cloth,.07);o.rotation_euler.x=math.radians(-14)
cylinder('Coffee table pedestal',(-4.65,2.35,.62),(-4.65,2.35,.91),.17,wood,32)
cylinder('Coffee table travertine',(-4.65,2.35,.90),(-4.65,2.35,.97),.58,stone,48)
cylinder('Small coffee table',(-5.38,2.25,.62),(-5.38,2.25,.82),.29,wood,32)
box('Coffee table book',(-4.55,2.27,1.0),(.28,.21,.04),cloth,.004)
box('Interior feature wall',(-6.38,4.85,2.0),(.06,3.6,2.81),wood_h)
for z in [1.15,1.7,2.25]:
    box('Feature floating shelf',(-6.15,5.38,z),(.48,2.15,.06),wood_h,.008)
light('LGT | living ceiling',(-4.6,3.0,3.36),170,size=1.8,target=(-4.6,3,.7))
light('LGT | entry',( -2.6,.62,3.20),45,size=.3,target=(-2.6,-.4,.5))
light('LGT | suite',(-2.7,2.4,6.24),95,size=1.5,target=(-2.7,2.4,4))
# Pendant, with a slender stem and low-poly spun shade.
cylinder('Pendant cable',(-4.75,2.8,3.45),(-4.75,2.8,2.7),.008,black,8)
sphere('Pendant shade',(-4.75,2.8,2.62),(.26,.26,.14),wood_h,24,12)
cylinder('Pendant diffuser',(-4.75,2.8,2.56),(-4.75,2.8,2.565),.20,emissive,24)
box('Suite bed oak platform',(-4.8,4.0,3.86),(2.1,2.6,.29),wood_h,.04)
box('Suite mattress',(-4.8,3.92,4.10),(1.95,2.38,.24),fabric,.09)
box('Suite linen duvet',(-4.8,3.58,4.26),(1.97,1.57,.12),cloth,.055)
box('Suite upholstered headboard',(-4.8,5.15,4.38),(2.27,.13,1.25),fabric,.08)
for x in [-5.32,-4.29]:box('Suite pillow',(x,4.67,4.31),(.72,.43,.14),fabric,.09)
box('Suite bedside table',(-3.27,4.82,3.98),(.66,.57,.66),wood_h,.025)
cylinder('Suite lamp stem',(-3.27,4.82,4.31),(-3.27,4.82,4.64),.025,chrome,12)
sphere('Suite lamp shade',(-3.27,4.82,4.66),(.18,.18,.20),cloth,24,12)
light('LGT | bedside glow',(-3.27,4.82,4.60),12,size=.23,target=(-3.3,4,4))

ACTIVE=collections['05 Contexto']
box('Site terrain',(0,3,-.11),(120,120,.20),grassmat,.0)
box('Street',(0,-12.25,-.065),(70,14.1,.14),road,.01)
box('Sidewalk',(0,-4.63,.065),(29,1.12,.20),paving,.015)
box('Curb',(0,-5.2,.07),(29,.16,.22),stone,.025)
# Sloping driveway: front meets sidewalk, back meets garage level.
xs=(.63,7.51);ys=(-5.14,-.92);zs=(.165,.54)
verts=[(xs[0],ys[0],zs[0]),(xs[1],ys[0],zs[0]),(xs[1],ys[1],zs[1]),(xs[0],ys[1],zs[1]),(xs[0],ys[0],.04),(xs[1],ys[0],.04),(xs[1],ys[1],.04),(xs[0],ys[1],.04)]
mesh('Sloped driveway',verts,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],paving)
for x in [.63+1.146*i for i in range(7)]:
    cylinder('Driveway expansion joint',(x,-5.14,.168),(x,-.92,.542),.006,dark,6)
for y in [-4.11,-3.07,-2.03]:
    z=.165+(y+5.14)/4.22*.375
    cylinder('Driveway cross joint',(.64,y,z+.002),(7.5,y,z+.002),.004,dark,6)
box('Drain grate', (4.13,-1.00,.54),(6.80,.10,.012),black,.001)
for i in range(68):box('Drain slots',(.79+i*.10,-1.005,.548),(.02,.073,.002),chrome,0)
for i in range(17):box('Sidewalk joint',(-13.6+i*1.7,-4.63,.167),(.007,1.10,.002),dark,0)

ACTIVE=collections['03 Paisagismo']
box('Left raised garden',(-5.45,-1.8,.27),(7.2,4.3,.36),soil,.04)
box('Garden lawn',(-5.45,-1.85,.465),(7.00,4.11,.045),grassmat,.01)
box('Garden front retaining stone',(-5.45,-3.93,.25),(7.23,.14,.42),stone,.012)
box('Garden left retaining stone',(-9.05,-1.78,.25),(.15,4.44,.42),stone,.012)
for i in range(5):
    y=-3.62+i*.71
    box('Floating entrance stepping slab',(-2.66,y,.48+i*.016),(1.28,.56,.12),stone,.016)
box('Entry landing',(-2.66,-.17,.59),(1.35,.88,.16),stone,.016)
box('Garage edge planter',(8.27,1.05,.53),(.73,4.8,.68),stone,.025)
box('Garage planter mulch',(8.27,1.05,.88),(.58,4.64,.04),soil,.0)

def leaf_cloud(name,clusters,count=220,leafsize=.075):
    verts=[];faces=[];mats=[]
    for center,radius in clusters:
        center=Vector(center)
        for _ in range(count):
            p=center+Vector((R.gauss(0,radius*.53),R.gauss(0,radius*.53),R.gauss(0,radius*.33)))
            ang=R.uniform(0,math.tau)
            u=Vector((math.cos(ang),math.sin(ang),R.uniform(-.6,.6))).normalized()*R.uniform(.6,1.35)*leafsize
            v=Vector((-u.y,u.x,R.uniform(-leafsize*.5,leafsize*.5))).normalized()*leafsize*.42
            j=len(verts)
            verts.extend([p-u,p-v,p+Vector((0,0,leafsize*.11)),p+v,p+u])
            faces.extend([(j,j+1,j+2),(j,j+2,j+3),(j+4,j+2,j+1),(j+4,j+3,j+2)])
            mi=R.choices(range(5),[2,4,4,1,2])[0];mats.extend([mi]*4)
    o=mesh(name,verts,faces,None)
    for m in leaves:o.data.materials.append(m)
    for poly,mi in zip(o.data.polygons,mats):poly.material_index=mi;poly.use_smooth=True
    return o

def tree(name,x,y,h,spread=1.8):
    base=Vector((x,y,.46 if y<0 else .1))
    trunk=base+Vector((.18,-.04,h*.58))
    cylinder(name+' trunk',base,trunk,.135,bark,12,.07)
    clusters=[]
    for j in range(7):
        a=j*math.tau/7+R.uniform(-.15,.15)
        root=base.lerp(trunk,.48+R.random()*.38)
        tip=base+Vector((math.cos(a)*spread*.72,math.sin(a)*spread*.72,h*(.73+R.random()*.14)))
        elbow=root.lerp(tip,.56)+Vector((0,0,.25))
        cylinder(name+' branch',root,elbow,.047,bark,8,.022)
        cylinder(name+' branch twig',elbow,tip,.021,bark,7,.007)
        for k in range(4):
            off=Vector((R.uniform(-.68,.68),R.uniform(-.65,.65),R.uniform(-.35,.52)))
            end=tip+off
            cylinder(name+' twig',tip.lerp(elbow,.18),end,.008,bark,6,.002)
            clusters.append((end,spread*.36))
    clusters.append((base+Vector((0,0,h*.94)),spread*.50))
    for k in range(3):
        clusters.append((base+Vector((R.uniform(-.35,.35),R.uniform(-.35,.35),h*(.73+k*.09))),spread*.43))
    return leaf_cloud(name+' foliage',clusters,600 if y<2 else 350,.105)

tree('Olive hero',-8.3,-1.5,4.70,1.80)
for x,y,h,s in [(-11,7.6,7,2.3),(-9,11,7.7,2.5),(-5,12.6,7.5,2.4),(1,12.9,8.2,2.6),(8.7,9.1,7.1,2.0),(11.0,5.3,6.5,2.1),(13,11,8.0,2.8)]:
    tree('Background tree',x,y,h,s)
# Shrubs with small individual leaves, rather than opaque green blobs.
for i in range(10):
    x=-6.2+i*.40
    if x>-3.9:break
    leaf_cloud('Low front shrub', [((x,-.45,.80),.38)],350,.040)
for i in range(6):leaf_cloud('Garage shrub',[((8.28,-.5+i*.64,1.20),.30)],260,.041)

def ornamental_grass(name,centers):
    verts=[];faces=[]
    for center in centers:
        for _ in range(55):
            ang=R.uniform(0,math.tau);length=R.uniform(.24,.63)
            p=Vector(center)+Vector((R.uniform(-.08,.08),R.uniform(-.08,.08),0))
            u=Vector((math.cos(ang),math.sin(ang),0));v=Vector((-u.y,u.x,0))*.011
            tip=p+u*length*.52+Vector((0,0,length))
            mid=p.lerp(tip,.50)+Vector((0,0,.09));j=len(verts)
            verts.extend([p-v,p+v,mid+v*.6,mid-v*.6,tip])
            faces.extend([(j,j+1,j+2,j+3),(j+3,j+2,j+4)])
    o=mesh(name,verts,faces,leaves[2]);return o
ornamental_grass('Garden liriope',[(-7.2+i*.55,-3.45,.49) for i in range(7)])
ornamental_grass('Entry accent grass',[(-1.3,-.34,.50),(-1.1,-.6,.5),(8.3,-1.35,.9)])
# Fine grass only on the foreground lawn: 3,800 two-triangle blades.
verts=[];faces=[]
for _ in range(3800):
    x=R.uniform(-8.88,-1.95);y=R.uniform(-3.83,.10)
    if -3.37<x<-1.95:continue
    p=Vector((x,y,.49));ang=R.random()*math.tau
    v=Vector((math.cos(ang),math.sin(ang),0))*.007
    j=len(verts);verts.extend([p-v,p+v,p+Vector((.018,0,R.uniform(.035,.09)))])
    faces.append((j,j+1,j+2))
mesh('Fine lawn blades',verts,faces,leaves[2])
# Garden bollards with a modest warm pool of light.
for x,y in [(-7.0,-3.55),(-3.71,-2.63),(8.28,-1.0)]:
    z=.49 if x<0 else .88
    box('Garden bollard',(x,y,z+.20),(.08,.08,.40),black,.008)
    box('Garden bollard diffuser',(x,y-.043,z+.30),(.048,.008,.06),emissive,.002)
    light('LGT | garden path',(x,y-.10,z+.29),7,size=.15,target=(x,y-.9,z))

ACTIVE=collections['04 Veiculos']
# Compact anonymous cars: ring-loft body, real tire geometry, glass and trim.
# Car length runs along Y, nose toward the street (-Y).
def car(name,x,y,paintcolor):
    paint=material('MAT | '+name+' automotive paint',paintcolor,.25,coat=.8)
    window=material('MAT | '+name+' smoked glazing',(.036,.055,.064),.075,transmission=.18,coat=.4)
    def B(n,loc,size,mat,b=.025):return box(name+' '+n,(x+loc[0],y+loc[1],.54+loc[2]),size,mat,b)
    rings=[(-2.17,.64,.29,.58),(-2.08,.79,.28,.72),(-1.88,.86,.28,.79),(-1.62,.88,.49,.85),(-1.40,.90,.68,.88),(-1.25,.90,.73,.88),(-1.08,.91,.67,.91),(-.87,.91,.44,.93),(-.65,.91,.27,.94),(.65,.90,.27,.94),(.89,.90,.47,.94),(1.1,.90,.68,.93),(1.29,.90,.73,.92),(1.48,.88,.66,.90),(1.69,.86,.45,.87),(1.94,.81,.29,.79),(2.08,.69,.30,.73)]
    vs=[];fs=[]
    for yy,w,z0,z1 in rings:
        for xx,zz in [(-w*.87,.27),(-w,z0),(-w,z1-.035),(-w*.80,z1),(w*.80,z1),(w,z1-.035),(w,z0),(w*.87,.27)]:
            vs.append((x+xx,y+yy,.54+zz))
    for k in range(len(rings)-1):
        for j in range(8):fs.append((k*8+j,k*8+(j+1)%8,(k+1)*8+(j+1)%8,(k+1)*8+j))
    fs.extend([tuple(reversed(range(8))),tuple(range((len(rings)-1)*8,len(rings)*8))])
    o=mesh(name+' body',vs,fs,paint)
    mod=o.modifiers.new('Body smooth subdivision','SUBSURF');mod.levels=2;mod.render_levels=2
    for p in o.data.polygons:p.use_smooth=True
    # Cabin is a tapered eight-corner prism, with a separate roof cap.
    pts=[(-.77,-.88,.91),(.77,-.88,.91),(.78,1.51,.90),(-.78,1.51,.90),(-.63,-.18,1.44),(.63,-.18,1.44),(.64,.84,1.43),(-.64,.84,1.43)]
    o=mesh(name+' glass cabin',[(x+a,y+b,.54+c) for a,b,c in pts],[(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)],window)
    be=o.modifiers.new('Glass edge','BEVEL');be.width=.035;be.segments=3
    sphere(name+' curved roof',(x,y+.33,.54+1.435),(.68,.70,.056),paint,32,12)
    for side in [-1,1]:
        for a,b in [((side*.77,-.88,.91),(side*.63,-.18,1.44)),((side*.78,1.51,.90),(side*.64,.84,1.43)),((side*.79,.38,.94),(side*.65,.38,1.44))]:
            cylinder(name+' window pillar',(x+a[0],y+a[1],.54+a[2]),(x+b[0],y+b[1],.54+b[2]),.032,paint,8)
        B('mirror',(side*.96,-.52,.96),(.20,.29,.13),paint,.055)
        B('door handle',(side*.901,.39,.80),(.022,.19,.035),chrome,.009)
        B('side sill',(side*.88,.08,.26),(.07,3.3,.11),black,.016)
        # Front and rear tires, transverse axle.
        for yy in [-1.25,1.29]:
            c=(x+side*.84,y+yy,.54+.37)
            a=(c[0]-.115,c[1],c[2]);b=(c[0]+.115,c[1],c[2])
            cylinder(name+' tire',a,b,.37,rubber,36)
            xx=x+side*.96
            cylinder(name+' wheel alloy',(xx-side*.012,y+yy,c[2]),(xx+side*.016,y+yy,c[2]),.265,chrome,32)
            cylinder(name+' wheel inset',(xx+side*.020,y+yy,c[2]),(xx+side*.025,y+yy,c[2]),.208,black,32)
            for j in range(7):
                aa=j*math.tau/7
                cylinder(name+' wheel spoke',(xx+side*.029,y+yy,c[2]),(xx+side*.029,y+yy+math.sin(aa)*.207,c[2]+math.cos(aa)*.207),.019,chrome,6)
            cylinder(name+' wheel hub',(xx+side*.026,y+yy,c[2]),(xx+side*.041,y+yy,c[2]),.074,chrome,16)
    B('front dark grille',(0,-2.137,.49),(1.12,.055,.18),black,.035)
    for zz in [.43,.47,.51,.55]:B('grille horizontal bar',(0,-2.166,zz),(1.01,.015,.009),chrome,.002)
    for side in [-1,1]:
        B('headlight',(side*.64,-2.087,.705),(.35,.049,.083),black,.025)
        B('daylight signature',(side*.64,-2.119,.722),(.28,.013,.016),stone,.005)
        B('rear lamp',(side*.61,1.978,.70),(.37,.026,.07),material(name+' red lamp '+str(side),(.27,.013,.009),.2),.018)
    B('front plate',(0,-2.18,.36),(.35,.016,.075),stone,.004)
    B('rear plate',(0,2.00,.50),(.35,.016,.075),stone,.004)
    sphere(name+' sculpted hood',(x,y-1.40,.54+.871),(.68,.61,.027),paint,32,12)
car('Graphite grand touring',2.18,2.44,(.062,.071,.080))
car('Pearl compact',5.32,2.46,(.72,.72,.68))

ACTIVE=collections['06 Luz e cameras']
camdata=bpy.data.cameras.new('CAM | Street architectural hero 43mm')
cam=bpy.data.objects.new('CAM | Street architectural hero 43mm',camdata);ACTIVE.objects.link(cam)
cam.location=(7.4,-26.5,3.4)
# Keep verticals vertical: horizontal camera with a shifted lens.
at=Vector((-.2,1.2,cam.location.z));aim(cam,at)
camdata.lens=50;camdata.sensor_width=36;camdata.shift_y=-.005
camdata.clip_end=250
scene.camera=cam
camdata.dof.use_dof=False
world=bpy.data.worlds.new('WORLD | Procedural late afternoon sky');scene.world=world;world.use_nodes=True
n=world.node_tree.nodes;l=world.node_tree.links
sky=n.new('ShaderNodeTexSky');sky.sky_type='SINGLE_SCATTERING';sky.sun_elevation=math.radians(19);sky.sun_rotation=math.radians(238)
sky.altitude=.15;sky.air_density=1.0;sky.aerosol_density=.55;sky.ozone_density=1.0;sky.sun_disc=False
n.get('Background').inputs['Strength'].default_value=.32
l.new(sky.outputs[0],n.get('Background').inputs['Color'])
# Broad warm key for a gentle architectural late-afternoon sun.
sun_data=bpy.data.lights.new('LGT | Late afternoon sun','SUN');sun_data.energy=2.0;sun_data.angle=math.radians(1.0);sun_data.color=(1.0,.86,.65)
sun=bpy.data.objects.new('LGT | Late afternoon sun',sun_data);ACTIVE.objects.link(sun)
sun.location=(-12,-10,16);aim(sun,(0,1,0))
light('LGT | Soft sky fill',(1,-7,9),250,(.74,.84,1),9,(0,1,2))

scene.render.engine='CYCLES'
scene.cycles.samples=48 if PREVIEW else 192
scene.cycles.use_adaptive_sampling=True
scene.cycles.adaptive_threshold=.055 if PREVIEW else .018
scene.cycles.adaptive_min_samples=16
scene.cycles.use_denoising=True
scene.cycles.denoiser='OPENIMAGEDENOISE'
scene.cycles.max_bounces=6
scene.cycles.diffuse_bounces=2
scene.cycles.glossy_bounces=3
scene.cycles.transmission_bounces=6
scene.cycles.transparent_max_bounces=8
scene.cycles.use_light_tree=True
scene.cycles.sample_clamp_indirect=5
scene.render.resolution_x=1000 if PREVIEW else 1920
scene.render.resolution_y=625 if PREVIEW else 1200
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGB'
scene.render.image_settings.color_depth='8'
scene.render.film_transparent=False
scene.view_settings.view_transform='AgX'
scene.view_settings.look='AgX - Medium High Contrast'
scene.view_settings.exposure=0.0
# Select the available GPU; use CPU only if no CUDA/OptiX device exists.
prefs=bpy.context.preferences.addons['cycles'].preferences
device_used='CPU'
for mode in ['OPTIX','CUDA']:
    try:
        prefs.compute_device_type=mode;prefs.get_devices()
        gpu=[d for d in prefs.devices if d.type==mode]
        if gpu:
            for d in prefs.devices:d.use=d.type==mode
            scene.cycles.device='GPU';device_used=mode;break
    except Exception:pass
# Modest glare, no fake lens dirt or excessive bloom.
nt=bpy.data.node_groups.new('COMPOSITING | restrained photographic glow','CompositorNodeTree')
nt.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
scene.compositing_node_group=nt
rl=nt.nodes.new('CompositorNodeRLayers')
glare=nt.nodes.new('CompositorNodeGlare');glare.inputs['Type'].default_value='Fog Glow';glare.inputs['Quality'].default_value='High'
glare.inputs['Threshold'].default_value=1.8
glare.inputs['Strength'].default_value=.10
comp=nt.nodes.new('NodeGroupOutput')
nt.links.new(rl.outputs['Image'],glare.inputs['Image']);nt.links.new(glare.outputs['Image'],comp.inputs['Image'])
scene.render.filepath=str(OUT/('preview.png' if PREVIEW else 'casa-vistalar-final.png'))

# Keep an editable, self-contained file; no external textures are required.
for o in bpy.context.selected_objects:o.select_set(False)
scene['Estudo']='Casa VistaLar — inspirada na imagem fornecida; medidas ilustrativas, não projeto executivo.'
scene['Otimizacao']='Vegetação consolidada por árvore; materiais procedurais; curvas com poucos segmentos; sem texturas externas.'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'casa-vistalar.blend'),compress=True)
meshes=[o for o in scene.objects if o.type=='MESH']
deps=bpy.context.evaluated_depsgraph_get()
triangles=0
for o in meshes:
    ev=o.evaluated_get(deps);me=ev.to_mesh();me.calc_loop_triangles();triangles+=len(me.loop_triangles);ev.to_mesh_clear()
stats={'blender':bpy.app.version_string,'renderer':'Cycles','device':device_used,'objects':len(scene.objects),'mesh_objects':len(meshes),'unique_meshes':len({o.data.name for o in meshes}),'evaluated_triangles':triangles,'materials':len(bpy.data.materials),'resolution':[scene.render.resolution_x,scene.render.resolution_y],'samples_max':scene.cycles.samples,'blend_bytes':(OUT/'casa-vistalar.blend').stat().st_size,'build_seconds':round(time.perf_counter()-START,2),'external_assets':0,'seed':2718}
print('SCENE_READY '+json.dumps(stats),flush=True)
if not BUILD_ONLY:
    bpy.ops.render.render(write_still=True)
    stats['total_seconds']=round(time.perf_counter()-START,2)
    stats['render_path']=scene.render.filepath
    (OUT/('preview-metrics.json' if PREVIEW else 'metrics.json')).write_text(json.dumps(stats,indent=2),encoding='utf-8')
    print('RENDER_DONE '+json.dumps(stats),flush=True)

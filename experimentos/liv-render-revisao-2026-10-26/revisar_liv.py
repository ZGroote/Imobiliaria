"""Revisão de apresentação, preservando a arquitetura do LIV de origem."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import random
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector
import numpy as np

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent / 'liv-render-blender-2026-10-26/entrega/LIV_Ipanema_Render.blend'
DELIVERY = ROOT / 'entrega'
BLEND = DELIVERY / 'LIV_Revisado.blend'
SCENES = {'exterior': '01 | Condominio LIV', 'apartamento': '02 | Apartamento decorado', 'sala': '03 | Sala e jantar', 'jantar': '04 | Jantar e cozinha'}
RNG = random.Random(261026)


def aim(obj, point):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def principled(mat):
    return next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')


def value(node, key, val):
    inp = next(i for i in node.inputs if i.name == key)
    for link in list(inp.links):
        node.id_data.links.remove(link)
    inp.default_value = val


def material(name, color, rough=.6, metal=0, texture=0):
    m = bpy.data.materials.new('R2 | ' + name)
    m.use_nodes = True
    p = principled(m)
    value(p, 'Base Color', (*color, 1))
    value(p, 'Roughness', rough)
    value(p, 'Metallic', metal)
    if texture:
        micro(m, texture)
    return m


def micro(mat, scale=100, distance=.0008):
    n, l = mat.node_tree.nodes, mat.node_tree.links
    coord = n.new('ShaderNodeTexCoord')
    noise = n.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = scale
    noise.inputs['Detail'].default_value = 3
    l.new(coord.outputs['Object'], noise.inputs['Vector'])
    bump = n.new('ShaderNodeBump')
    bump.inputs['Distance'].default_value = distance
    bump.inputs['Strength'].default_value = .2
    l.new(noise.outputs['Fac'], bump.inputs['Height'])
    l.new(bump.outputs['Normal'], principled(mat).inputs['Normal'])


def textured_color(mat, tint, saturation=.75):
    p = principled(mat)
    source = next((n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image and n.image.colorspace_settings.name == 'sRGB'), None)
    if not source:
        value(p, 'Base Color', (*tint, 1))
        return
    n, l = mat.node_tree.nodes, mat.node_tree.links
    hue = n.new('ShaderNodeHueSaturation')
    hue.inputs['Saturation'].default_value = saturation
    mix = n.new('ShaderNodeMixRGB')
    mix.blend_type = 'MULTIPLY'
    mix.inputs[0].default_value = 1
    mix.inputs[2].default_value = (*tint, 1)
    l.new(source.outputs['Color'], hue.inputs['Color'])
    l.new(hue.outputs['Color'], mix.inputs[1])
    l.new(mix.outputs[0], p.inputs['Base Color'])


def assign(obj, mat):
    obj.data = obj.data.copy()
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def mesh_obj(name, verts, faces, col, mat):
    mesh = bpy.data.meshes.new('R2 | ' + name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new('R2 | ' + name, mesh)
    col.objects.link(obj)
    mesh.materials.append(mat)
    return obj


def cube(name, pos, size, col, mat, bevel=.012):
    sx, sy, sz = (s/2 for s in size)
    v = [(x*sx,y*sy,z*sz) for x,y,z in [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]]
    f = [(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)]
    obj = mesh_obj(name,v,f,col,mat)
    obj.location = pos
    if bevel:
        mod = obj.modifiers.new('Arestas suaves em escala real','BEVEL')
        mod.width, mod.segments = bevel, 3
    return obj


def lathe(name, pos, rings, col, mat, steps=40):
    verts = [(r*math.cos(i*2*math.pi/steps),r*math.sin(i*2*math.pi/steps),z) for z,r in rings for i in range(steps)]
    faces = []
    for j in range(len(rings)-1):
        for i in range(steps):
            k=j*steps+i; k1=j*steps+(i+1)%steps
            faces.append((k,k1,k1+steps,k+steps))
    faces.extend([tuple(reversed(range(steps))), tuple((len(rings)-1)*steps+i for i in range(steps))])
    obj = mesh_obj(name,verts,faces,col,mat)
    obj.location = pos
    for p in obj.data.polygons: p.use_smooth=True
    return obj


def stem(name, a, b, radius, col, mat):
    direction=Vector(b)-Vector(a)
    obj=lathe(name,a,[(0,radius),(direction.length,radius*.65)],col,mat,10)
    obj.rotation_euler=direction.to_track_quat('Z','Y').to_euler()
    return obj


def cushion(name, pos, col, mat):
    verts=[]; faces=[]; steps=32; rings=18
    def power(x): return math.copysign(abs(x)**.55,x)
    for j in range(rings+1):
        phi=-math.pi/2+j*math.pi/rings
        for i in range(steps):
            theta=i*2*math.pi/steps
            verts.append((.11*power(math.cos(phi))*power(math.cos(theta)),
                          .21*power(math.cos(phi))*power(math.sin(theta)),.19*power(math.sin(phi))))
    for j in range(rings):
        for i in range(steps): faces.append((j*steps+i,j*steps+(i+1)%steps,(j+1)*steps+(i+1)%steps,(j+1)*steps+i))
    obj=mesh_obj(name,verts,faces,col,mat); obj.location=pos
    obj.rotation_euler.y=math.radians(-12)
    for p in obj.data.polygons: p.use_smooth=True
    return obj


def broad_leaf(name, start, end, width, col, mat):
    a,b=Vector(start),Vector(end); axis=(b-a).normalized()
    side=axis.cross(Vector((.1,.05,1))).normalized()
    verts=[]; faces=[]
    for i in range(13):
        t=i/12; center=a.lerp(b,t)+Vector((0,0,.045*math.sin(math.pi*t)))
        w=width*math.sin(math.pi*t)**.7
        verts.extend([tuple(center-side*w),tuple(center+Vector((0,0,.008))),tuple(center+side*w)])
    for i in range(12):
        for k in range(2): faces.append((i*3+k,i*3+k+1,(i+1)*3+k+1,(i+1)*3+k))
    o=mesh_obj(name,verts,faces,col,mat)
    for p in o.data.polygons: p.use_smooth=True
    return o


def leaf_mesh(name, count, seed, mat):
    rng=random.Random(seed)
    verts, faces = [], []
    for _ in range(count):
        phi=rng.uniform(0,2*math.pi); zz=rng.uniform(-1,1)
        rr=rng.random()**.28
        center=Vector((rr*math.sqrt(1-zz*zz)*math.cos(phi),rr*math.sqrt(1-zz*zz)*math.sin(phi),rr*zz))
        axis=Vector((rng.uniform(-1,1),rng.uniform(-1,1),rng.uniform(-.5,.8))).normalized()
        tangent=axis.cross(Vector((.05,.02,1))).normalized()
        length=rng.uniform(.055,.105); width=length*rng.uniform(.28,.48)
        start=len(verts)
        for p in (center-axis*length,center-tangent*width,center+Vector((0,0,.012)),center+tangent*width,center+axis*length): verts.append(tuple(p))
        faces.extend([(start,start+1,start+2),(start,start+2,start+3),(start+1,start+4,start+2),(start+2,start+4,start+3)])
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(verts,[],faces); mesh.update(); mesh.materials.append(mat)
    for p in mesh.polygons: p.use_smooth=True
    return mesh


def world(scene, strength, background=(.82,.80,.75)):
    w=bpy.data.worlds.new('R2 | Ambiente '+scene.name); w.use_nodes=True
    n,l=w.node_tree.nodes,w.node_tree.links; n.clear()
    out=n.new('ShaderNodeOutputWorld'); ambient=n.new('ShaderNodeBackground')
    ambient.inputs['Color'].default_value=(.65,.75,.9,1)
    ambient.inputs['Strength'].default_value=strength
    visible=n.new('ShaderNodeBackground'); visible.inputs['Color'].default_value=(*background,1)
    visible.inputs['Strength'].default_value=1
    ray=n.new('ShaderNodeLightPath'); mix=n.new('ShaderNodeMixShader')
    l.new(ray.outputs['Is Camera Ray'],mix.inputs[0]); l.new(ambient.outputs[0],mix.inputs[1]); l.new(visible.outputs[0],mix.inputs[2]); l.new(mix.outputs[0],out.inputs[0])
    scene.world=w


def light(scene, name, pos, target, power, size, color=(1,.92,.8), kind='AREA'):
    data=bpy.data.lights.new('R2 | '+name,kind); data.energy=power; data.color=color
    if kind=='AREA': data.size=size
    if kind=='SUN': data.angle=math.radians(size)
    obj=bpy.data.objects.new(data.name,data); scene.collection.objects.link(obj); obj.location=pos; aim(obj,target)
    return obj


def camera(scene, pos, target, lens=24):
    obj=scene.camera
    obj.location=pos; aim(obj,target); obj.data.type='PERSP'; obj.data.lens=lens
    obj.data.dof.use_dof=False
    obj.data.shift_x=0; obj.data.shift_y=0
    return obj


def bounds(obj):
    pts=[obj.matrix_world@Vector(p) for p in obj.bound_box]
    lo=Vector([min(p[i] for p in pts) for i in range(3)])
    hi=Vector([max(p[i] for p in pts) for i in range(3)])
    return lo,hi


def preserve_manifest():
    p=ROOT/'fontes'; p.mkdir(exist_ok=True)
    old=SOURCE.parent
    data={'source_blend':str(SOURCE),'baseline':{},'policy':'Arquitetura e implantacao preservadas; shaders, cameras, decoracao e folhagem de apresentacao revisados.'}
    for f in [SOURCE,*old.glob('LIV_*.png')]:
        data['baseline'][f.name]={'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'bytes':f.stat().st_size}
    (p/'reference_manifest.json').write_text(json.dumps(data,indent=2,ensure_ascii=False),encoding='utf-8')


def revise_materials():
    for mat in bpy.data.materials:
        if not mat.use_nodes: continue
        p=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
        if p is None: continue
        name=mat.name.lower()
        if any(k in name for k in ('interior-m0','gesso-')):
            value(p,'Base Color',(.68,.65,.59,1)); value(p,'Roughness',.82)
        if 'carvalho' in name:
            textured_color(mat,(.69,.65,.56),.7); value(p,'Roughness',.38); micro(mat,120,.0007)
        if 'marcenaria' in name:
            textured_color(mat,(.85,.78,.60),.65); value(p,'Roughness',.4)
        if 'sofa_material1' in name or 'sofa_material2' in name:
            textured_color(mat,(.28,.47,.35),.25); value(p,'Roughness',.86); value(p,'Sheen Weight',.32)
        if 'bed_material2' in name:
            textured_color(mat,(.32,.48,.52),.35); value(p,'Sheen Weight',.25)
        if name.endswith('bed_material'):
            value(p,'Base Color',(.64,.57,.43,1)); value(p,'Roughness',.86)
        if 'tapete' in name:
            textured_color(mat,(.45,.40,.32),.25); value(p,'Roughness',.95); value(p,'Sheen Weight',.3); micro(mat,260,.002)
        if 'carrara' in name:
            textured_color(mat,(.83,.80,.73),.1); value(p,'Roughness',.32)
        if 'acabamento rack' in name or 'acabamento mesa' in name or 'mesa circular' in name:
            textured_color(mat,(.61,.55,.45),.65); value(p,'Roughness',.4)
        if 'acabamento tv' in name:
            value(p,'Base Color',(.006,.009,.012,1)); value(p,'Roughness',.17); value(p,'Coat Weight',.45)
        if 'geladeira' in name:
            value(p,'Base Color',(.43,.45,.44,1)); value(p,'Metallic',1); value(p,'Roughness',.29)
        if 'site-car-' in name:
            value(p,'Roughness',.23); value(p,'Coat Weight',.55)
        if 'site-asfalto' in name:
            value(p,'Roughness',.88); micro(mat,45,.008)
        if any(k in name for k in ('site-piso','site-permeavel','site-muro')): micro(mat,30,.005)
        if 'vidro' in name or 'interior-m4' in name:
            value(p,'Base Color',(.96,.98,.98,1)); value(p,'Transmission Weight',1); value(p,'Roughness',.035)
        if any(k in name for k in ('esquadria','entrada-metal','site-metal')):
            value(p,'Base Color',(.045,.05,.045,1)); value(p,'Metallic',1); value(p,'Roughness',.3)
        if 'interior-m3' in name:
            value(p,'Base Color',(.56,.57,.53,1)); value(p,'Metallic',0); value(p,'Roughness',.4)
        # Generic source IDs are not semantic names: inventory proved m4 is the
        # frame profile and m5 is the thin pane. Do not infer glass from m4 again.
        if 'interior-m4' in name:
            value(p,'Base Color',(.55,.57,.54,1)); value(p,'Metallic',0)
            value(p,'Transmission Weight',0); value(p,'Roughness',.32)
        if 'interior-m5' in name:
            value(p,'Base Color',(.97,.99,.99,1)); value(p,'Metallic',0)
            value(p,'Transmission Weight',1); value(p,'Roughness',.025); value(p,'IOR',1.45)
        if 'fundo mineral' in name: value(p,'Base Color',(.62,.59,.53,1))


def stage_interior(interior, plan):
    col=bpy.data.collections.new('R2 | Decoracao do apartamento')
    interior.collection.children.link(col)
    clay=material('Ceramica areia',(.42,.31,.20),.64,texture=70)
    black=material('Metal grafite',(.018,.023,.021),.28,1)
    cream=material('Linho cru',(.51,.44,.33),.88,texture=220)
    terra=material('Almofada terracota',(.30,.09,.047),.88,texture=210)
    olive=material('Almofada oliva',(.14,.17,.065),.87,texture=210)
    leaf=material('Folhas internas',(.035,.12,.043),.58)
    value(principled(leaf),'Roughness',.82)
    value(principled(leaf),'Specular IOR Level',.12)
    cabinet=material('Armarios verde acinzentado',(.21,.25,.21),.47)
    stone=material('Bancada quartzo',(.63,.60,.53),.23,texture=120)
    steel=material('Inox escovado',(.48,.5,.49),.25,1)
    glassblack=material('Vidro forno',(.008,.012,.014),.14)
    paper=material('Papel livros',(.63,.59,.5),.9)
    oak=material('Carvalho painel',(.24,.135,.065),.43)
    n,l=oak.node_tree.nodes,oak.node_tree.links
    coord=n.new('ShaderNodeTexCoord'); mapping=n.new('ShaderNodeVectorMath'); mapping.operation='MULTIPLY'; mapping.inputs[1].default_value=(32,32,1.5)
    noise=n.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value=4
    ramp=n.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color=(.10,.055,.024,1); ramp.color_ramp.elements[1].color=(.36,.22,.11,1)
    l.new(coord.outputs['Object'],mapping.inputs[0]); l.new(mapping.outputs[0],noise.inputs[0]); l.new(noise.outputs['Fac'],ramp.inputs[0]); l.new(ramp.outputs[0],principled(oak).inputs['Base Color'])
    for o in [*interior.objects,*plan.objects]:
        if o.type!='MESH': continue
        slot=o.get('LIV_source_slot')
        if slot==75:
            o.data=o.data.copy(); o.data.materials.clear()
            for m in [cabinet,stone,steel]: o.data.materials.append(m)
            for face in o.data.polygons:
                z=(o.matrix_world@face.center).z
                face.material_index=0 if z<.87 else (1 if z<1.01 else 2)
        if slot in (61,69,74,75,76,83):
            mod=o.modifiers.new('Chanfro realista','BEVEL'); mod.width=.004; mod.segments=3
        if 'chair |' in o.name:
            mod=o.modifiers.new('Cantos da cadeira','BEVEL'); mod.width=.004; mod.segments=3
    # Lightweight decoration respects the existing furniture and circulation.
    cube('Livro verde',(-.44,-2.55,.755),(.23,.31,.045),col,olive,.004)
    cube('Livro areia',(-.43,-2.53,.795),(.22,.28,.035),col,paper,.004)
    lathe('Mesa de apoio redonda',(.12,-2.08,.05),[(0,.035),(.29,.035),(.30,.29),(.335,.29)],col,black)
    lathe('Tampo carvalho mesa de apoio',(.12,-2.08,.36),[(0,.31),(.028,.31)],col,oak)
    lathe('Vaso mesa de apoio',(.10,-2.08,.385),[(0,.055),(.08,.07),(.145,.035),(.155,.032)],col,clay)
    for index,y in enumerate((-2.6,-1.45)):
        cushion('Almofada '+str(index),(.99,y,.59),col,terra if index else olive)
    for o in list(interior.objects):
        if 'chair | 3DGeom-1' in o.name:
            lo,hi=bounds(o); c=(lo+hi)/2
            cube('Assento estofado',(c.x,c.y,hi.z+.018),(.40,.39,.042),col,cream,.019)
    for i in range(28):
        cube('Ripado painel TV',(-.614,-2.97+i*.069,1.35),(.014,.042,2.51),col,oak,.003)
    cube('Quadro estar moldura',(.30,-3.022,1.66),(1.12,.035,.72),col,oak,.005)
    cube('Quadro estar tela',(.30,-2.999,1.66),(1.04,.008,.64),col,cream,.001)
    cube('Arte bloco oliva',(.09,-2.989,1.62),(.38,.005,.37),col,olive,.001)
    circle=[(.48,-2.984,1.75)]+[(.48+.19*math.cos(i*2*math.pi/64),-2.984,1.75+.19*math.sin(i*2*math.pi/64)) for i in range(64)]
    mesh_obj('Arte circulo terracota',circle,[(0,i+1,(i+1)%64+1) for i in range(64)],col,terra)
    lathe('Vaso jantar',(2.02,.32,.79),[(0,.055),(.10,.075),(.20,.036),(.22,.039)],col,clay)
    for j in range(5):
        a=Vector((2.02,.32,.99)); b=a+Vector((RNG.uniform(-.12,.12),RNG.uniform(-.1,.1),RNG.uniform(.18,.34)))
        stem('Ramo jantar',a,b,.003,col,olive)
        for index,t in enumerate((.4,.55,.7,.85)):
            c=a.lerp(b,t); side=(-1 if index%2 else 1)
            tip=c+Vector((.055*side,.025,.016)); mid=(c+tip)/2
            mesh_obj('Folha eucalyptus',[tuple(c),tuple(mid+Vector((0,.017,.007))),tuple(tip),tuple(mid-Vector((0,.017,0)))],[(0,1,2,3)],col,leaf)
    lathe('Fruteira',(2.43,.27,.79),[(0,.07),(.035,.14),(.07,.13)],col,cream)
    # Pendant with a real visible emitter, not an invisible ceiling flood.
    lathe('Pendente jantar',(2.05,.32,1.96),[(0,.26),(.018,.26),(.15,.17),(.20,.035)],col,clay)
    stem('Cabo pendente',(2.05,.32,2.15),(2.05,.32,2.69),.006,col,black)
    light(interior,'Pendente jantar',(2.05,.32,1.95),(2.05,.32,.79),38,.34,(1,.78,.53))
    # Burner caps and handles give appliances readable materials at human scale.
    for x in (3.68,3.97):
        for y in (1.02,1.31): lathe('Queimador',(x,y,.951),[(0,.07),(.012,.07)],col,black,24)
    cube('Vidro frontal forno',(3.521,1.175,.44),(.012,.43,.39),col,glassblack,.025)
    stem('Puxador forno',(3.498,.99,.69),(3.498,1.36,.69),.012,col,steel)
    stem('Puxador geladeira',(3.43,-1.43,.95),(3.43,-1.43,1.39),.011,col,black)
    # Pleated linen panels alongside, never covering the balcony opening.
    for x0 in (1.43,3.15):
        v=[]; f=[]
        for j,z in enumerate((.06,2.59)):
            for i in range(49):
                x=x0+(i/48-.5)*.34
                v.append((x,1.56+.045*math.sin(i/48*math.pi*12),z))
        for i in range(48): f.append((i,i+1,50+i,49+i))
        obj=mesh_obj('Cortina linho',v,f,col,cream)
        solid=obj.modifiers.new('Espessura tecido','SOLIDIFY'); solid.thickness=.001
        for p in obj.data.polygons: p.use_smooth=True
    lathe('Cachepo planta',(3.08,1.16,.03),[(0,.16),(.33,.20),(.35,.19)],col,clay)
    for j in range(9):
        end=Vector((3.08+RNG.uniform(-.25,.25),1.16+RNG.uniform(-.17,.17),RNG.uniform(.85,1.43)))
        stem('Haste planta',(3.08,1.16,.32),end,.006,col,olive)
        tip=end+Vector((RNG.uniform(-.25,.25),RNG.uniform(-.12,.12),.18))
        broad_leaf('Folha tropical',end-Vector((0,0,.12)),tip,.085,col,leaf)
    # Plan staging excludes curtains and pendant so they cannot hide the layout.
    cut=bpy.data.collections.new('R2 | Decoracao em corte'); plan.collection.children.link(cut)
    bpy.context.view_layer.update()
    for o in col.objects:
        if o.type!='MESH' or any(k in o.name for k in ('Pendente','pendente','Cortina')): continue
        if bounds(o)[1].z>1.15: continue
        cut.objects.link(o)


def exterior_foliage(scene):
    leaf=material('Folhagem externa',(.07,.15,.028),.72)
    n,l=leaf.node_tree.nodes,leaf.node_tree.links
    info=n.new('ShaderNodeObjectInfo'); ramp=n.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color=(.018,.065,.012,1)
    ramp.color_ramp.elements[1].color=(.15,.25,.055,1)
    l.new(info.outputs['Random'],ramp.inputs[0]); l.new(ramp.outputs[0],principled(leaf).inputs['Base Color'])
    value(principled(leaf),'Subsurface Weight',.08)
    clouds=[leaf_mesh('R2 | Copa folhada '+str(i),950,500+i,leaf) for i in range(3)]
    count=0
    for o in list(scene.objects):
        if o.type!='MESH' or 'SITE-organic-site-folha' not in o.data.name: continue
        lo,hi=bounds(o); center=(lo+hi)/2; half=(hi-lo)/2
        o.data=clouds[count%3]
        o.matrix_world=Matrix.Translation(center)@Matrix.Diagonal((*half,1))
        o['R2_foliage_replacement']=True
        count+=1
    return count


def configure(scene, key):
    scene.render.engine='CYCLES'; scene.cycles.device='GPU'
    scene.cycles.samples=256 if key=='sala' else 160
    scene.cycles.use_adaptive_sampling=True; scene.cycles.adaptive_threshold=.018
    scene.cycles.adaptive_min_samples=32; scene.cycles.use_denoising=True
    scene.cycles.denoiser='OPENIMAGEDENOISE'; scene.cycles.max_bounces=8
    scene.cycles.diffuse_bounces=4; scene.cycles.glossy_bounces=4; scene.cycles.transmission_bounces=8
    scene.cycles.sample_clamp_indirect=4
    scene.render.resolution_percentage=100
    if key=='sala': scene.render.resolution_y=1536
    scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGB'; scene.render.image_settings.color_depth='16'
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    scene.view_settings.exposure=.3 if key=='exterior' else .15
    scene.render.filepath='//LIV_'+key+'_revisado.png'


def source_state():
    report={}
    for o in bpy.data.objects:
        if o.type!='MESH' or 'LIV_source_slot' not in o: continue
        coords=np.empty(len(o.data.vertices)*3,dtype=np.float32)
        o.data.vertices.foreach_get('co',coords)
        report[o.name]=hashlib.sha256(coords.tobytes()+np.asarray(o.matrix_world,dtype=np.float32).tobytes()).hexdigest()
    return report


def keep_source_textures():
    folder=ROOT.parent/'liv-render-blender-2026-10-26/fontes/texturas'
    sources=list(folder.glob('*-color_map.png'))
    assert len(sources)==29,'Conjunto de texturas de origem incompleto'
    existing={i.name:i for i in bpy.data.images if i.source=='FILE'}
    for path in sources:
        image=existing.get(path.name)
        if image is None: image=bpy.data.images.load(str(path),check_existing=True)
        image.use_fake_user=True
        if not image.packed_file: image.pack()
    return {p.name for p in sources}


def build():
    DELIVERY.mkdir(exist_ok=True); preserve_manifest()
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    for scene in bpy.data.scenes:
        bpy.context.window.scene=scene; bpy.context.view_layer.update()
    before=source_state()
    for o in list(bpy.data.objects):
        if o.type=='LIGHT': bpy.data.objects.remove(o,do_unlink=True)
    revise_materials()
    exterior,plan,interior=[bpy.data.scenes[SCENES[k]] for k in ('exterior','apartamento','sala')]
    bpy.context.window.scene=exterior; bpy.context.view_layer.update()
    count=exterior_foliage(exterior)
    world(exterior,.6, (.90,.89,.85))
    light(exterior,'Sol fim de tarde',(-70,-110,120),(0,0,0),2.8,1.8,(1,.95,.86),'SUN')
    world(plan,.17)
    light(plan,'Janela de estudio',(-5,-7,9),(0,0,0),2400,4.0)
    light(plan,'Preenchimento suave',(6,4,7),(0,0,0),650,5,(.9,.95,1))
    world(interior,.18)
    light(interior,'Janela varanda',(2.25,1.55,2),(1,-1.3,.7),480,2.0,(1,.94,.83))
    light(interior,'Rebatimento discreto',(.1,-2.8,2.5),(1.5,-.4,1),35,2,(.9,.95,1))
    light(interior,'Sol janela',(7,8,9),(1,-2,0),1.3,1.4,(1,.88,.68),'SUN')
    bpy.context.window.scene=interior; bpy.context.view_layer.update()
    stage_interior(interior,plan)
    dining=interior.copy(); dining.name=SCENES['jantar']
    old_camera=dining.camera
    new_camera=old_camera.copy(); new_camera.data=old_camera.data.copy()
    new_camera.name='R2 | Camera jantar'
    dining.collection.objects.link(new_camera); dining.camera=new_camera
    dining.collection.objects.unlink(old_camera)
    camera(dining,(1.2,-1.3,1.58),(2.6,.5,1.25),20)
    for key,name in SCENES.items():
        bpy.data.scenes[name].use_fake_user=True
        configure(bpy.data.scenes[name],key)
    camera(interior,(-.55,-.35,1.43),(1.0,-2.0,.93),20)
    bpy.context.window.scene=exterior
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D': area.spaces.active.region_3d.view_perspective='CAMERA'
    keep_source_textures()
    bpy.ops.file.pack_all()
    after=source_state()
    checked=[name for name in before if not bpy.data.objects[name].get('R2_foliage_replacement')]
    assert all(before[name]==after[name] for name in checked),'A geometria ou posicao de origem mudou'
    preservation={'unchanged_source_meshes_and_matrices':len(checked),'foliage_replacements':count,'architecture_check':'passed'}
    (ROOT/'fontes/preservacao.json').write_text(json.dumps(preservation,indent=2),encoding='utf-8')
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    bpy.ops.wm.open_mainfile(filepath=str(BLEND))
    assert all(name in bpy.data.scenes for name in SCENES.values()),'Cena ausente apos reabrir o arquivo'
    print('BUILD_OK',{'foliage_replacements':count,'blend':str(BLEND)},flush=True)


def gpu():
    prefs=bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type='CUDA'; prefs.refresh_devices()
    for d in prefs.devices: d.use=d.type=='CUDA'
    if not any(d.use for d in prefs.devices): raise RuntimeError('CUDA indisponivel')


CAMERAS={
    'a': ((0,-.90,1.45),(2,-.50,1.15),20),
    'b': ((0,-2.85,1.45),(2,0,1.2),21),
    'c': ((3.15,.95,1.45),(-.35,-1.8,1.15),23),
    'd': ((-.55,-.35,1.43),(1.0,-2.0,.93),20),
    'e': ((1.2,-1.3,1.58),(2.6,.5,1.25),20),
    'f': ((3.1,-.75,1.43),(-.45,-2.0,1.18),24),
}


def render(args):
    bpy.ops.wm.open_mainfile(filepath=str(BLEND)); gpu()
    output=ROOT/('previas/'+args.round if args.mode=='draft' else 'entrega'); output.mkdir(parents=True,exist_ok=True)
    keys=SCENES if args.shot=='all' else [args.shot]
    for key in keys:
        scene=bpy.data.scenes[SCENES[key]]; scene.cycles.device='GPU'
        if args.camera and key=='sala': camera(scene,*CAMERAS[args.camera][:2],CAMERAS[args.camera][2])
        if args.mode=='draft':
            scene.render.resolution_percentage=38; scene.cycles.samples=32
            scene.cycles.adaptive_min_samples=8; scene.cycles.adaptive_threshold=.06
            scene.render.image_settings.color_depth='8'
        suffix=('_'+args.camera) if args.camera and key=='sala' else ''
        scene.render.filepath=str(output/('LIV_'+key+suffix+'_revisado.png'))
        assert scene.camera is not None
        print('RENDER_BEGIN',key,scene.render.filepath,flush=True)
        bpy.ops.render.render(write_still=True,scene=scene.name)
        print('RENDER_OK',key,flush=True)


def finish():
    bpy.ops.wm.open_mainfile(filepath=str(BLEND))
    expected_textures=keep_source_textures()
    report={'technical_status':'passed','visual_status':'see_DIARIO_DE_QUALIDADE','images':[], 'packed_textures':0}
    for key,name in SCENES.items():
        s=bpy.data.scenes[name]; path=DELIVERY/('LIV_'+key+'_revisado.png')
        im=bpy.data.images.load(str(path),check_existing=False)
        assert tuple(im.size)==(s.render.resolution_x,s.render.resolution_y)
        report['images'].append({'name':path.name,'resolution':list(im.size),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
        bpy.data.images.remove(im); s.cycles.device='CPU'; s.render.filepath='//'+path.name
    textures=[i for i in bpy.data.images if i.source=='FILE']
    assert len(textures)>=29 and all(i.packed_file for i in textures)
    report['packed_textures']=len(textures)
    for m in bpy.data.materials:
        if any(k in m.name.lower() for k in ('carvalho','marcenaria','sofa_material','bed_material')):
            assert principled(m).inputs['Metallic'].default_value==0,m.name
    assert principled(bpy.data.materials['LIV | Interior-m4']).inputs['Transmission Weight'].default_value==0
    assert principled(bpy.data.materials['LIV | Interior-m5']).inputs['Transmission Weight'].default_value==1
    report['geometry_preservation']=json.loads((ROOT/'fontes/preservacao.json').read_text(encoding='utf-8'))
    baseline=json.loads((ROOT/'fontes/reference_manifest.json').read_text(encoding='utf-8'))
    for name,record in baseline['baseline'].items():
        assert hashlib.sha256((SOURCE.parent/name).read_bytes()).hexdigest()==record['sha256'],name
    report['baseline_preserved']=True
    scene=bpy.data.scenes[SCENES['sala']]
    bpy.context.window.scene=scene; bpy.context.view_layer.update()
    subjects=[o for o in scene.objects if o.type=='MESH' and ('| sofa |' in o.name or 'Quadro estar moldura' in o.name)]
    points=[world_to_camera_view(scene,scene.camera,o.matrix_world@Vector(v)) for o in subjects for v in o.bound_box]
    assert points and all(.02<=p.x<=.98 and .02<=p.y<=.98 and p.z>0 for p in points),'Corte de sofa/quadro na camera'
    report['composition_bounds']={'min':[min(p[i] for p in points) for i in range(2)],'max':[max(p[i] for p in points) for i in range(2)],'margin_ok':True}
    bpy.context.window.scene=bpy.data.scenes[SCENES['exterior']]
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    bpy.ops.wm.open_mainfile(filepath=str(BLEND))
    persisted={i.name:i for i in bpy.data.images if i.source=='FILE'}
    assert expected_textures<=persisted.keys() and all(persisted[n].packed_file for n in expected_textures)
    assert all(n in bpy.data.scenes for n in SCENES.values())
    report['reopened_file_check']=True
    report['packed_textures']=len(persisted)
    (DELIVERY/'validacao_tecnica.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
    print('TECHNICAL_OK',json.dumps(report,ensure_ascii=False),flush=True)


if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--mode',choices=['build','draft','final','finish'],default='draft')
    p.add_argument('--shot',choices=['all',*SCENES],default='all')
    p.add_argument('--camera',choices=CAMERAS)
    p.add_argument('--round',default='r01')
    a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if a.mode=='build': build()
    elif a.mode=='finish': finish()
    else: render(a)

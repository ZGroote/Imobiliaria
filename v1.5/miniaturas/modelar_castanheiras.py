"""Blender 5.x: fachada do Castanheiras, fonte editavel e exportacao web offline.
Executar com blender --background --factory-startup --python este_arquivo.py.
"""
import bpy, math, json, random
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'castanheiras_blender'
OUT.mkdir(exist_ok=True)
scene=bpy.context.scene
print('BLENDER',bpy.app.version_string,'SCENE',scene.name,len(scene.objects))
for obj in list(scene.objects):
    bpy.data.objects.remove(obj,do_unlink=True)
LV=3.15
MATS={}
def material(name, rgb, rough=.8, metal=0, emission=0):
    m=bpy.data.materials.new('MAT-'+name);m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    # Entrada em sRGB -> shader linear, assim Blender e web conservam a cor.
    col=tuple(((v/255+0.055)/1.055)**2.4 if v/255>.04045 else v/255/12.92 for v in rgb)
    p.inputs['Base Color'].default_value=(*col,1)
    p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    if emission:
        p.inputs['Emission Color'].default_value=(*col,1)
        p.inputs['Emission Strength'].default_value=emission
    m.diffuse_color=(*col,1);MATS[name]=m
    return m
material('reboco',(204,202,194),.92)
material('concreto',(221,219,210),.85)
material('esquadria',(63,64,61),.36,1)
material('vidro',(69,85,93),.18)
material('luz',(255,204,127),.75,emission=.7)
material('trelica',(117,86,60),.65)
material('recuo',(83,79,72),.94)
material('folhagem',(63,87,49),.94)
material('vaso',(139,128,111),.85)
material('cobertura',(111,116,114),.98)

# Geometria agrupada por acabamento por pavimento. Malhas compartilhadas nas copias.
buckets={}
def box(mat,x,z,y,w,h,d,angle=0):
    """Coordenadas arquitetonicas: x horizontal, y profundidade, z altura."""
    verts,faces=buckets.setdefault(mat,([],[])); base=len(verts)
    cs,sn=math.cos(angle),math.sin(angle)
    for a,b,c in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]:
        xx=a*w/2;zz=c*h/2
        verts.append((x+cs*xx-sn*zz,-y-b*d/2,z+sn*xx+cs*zz))
    # Transformacao y -> -y exige inverter enrolamento.
    for face in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]:
        faces.append(tuple(base+i for i in reversed(face)))

def flush(prefix, bevel=False):
    result=[]
    for key,(verts,faces) in buckets.items():
        mesh=bpy.data.meshes.new(prefix+'-'+key);mesh.from_pydata(verts,[],faces);mesh.update()
        obj=bpy.data.objects.new('GEO-'+prefix+'-'+key,mesh);scene.collection.objects.link(obj)
        mesh.materials.append(MATS[key]);obj['acabamento']=key
        if bevel and key in ('reboco','concreto'):
            bpy.context.view_layer.objects.active=obj
            mod=obj.modifiers.new('Arestas suavizadas','BEVEL');mod.width=.018;mod.segments=2
            bpy.ops.object.modifier_apply(modifier=mod.name)
            mesh=obj.data
        # UVs metricas por face para reboco/concreto quando usados na web.
        uv=mesh.uv_layers.new(name='UVMap')
        for poly in mesh.polygons:
            n=poly.normal;axis=max(range(3),key=lambda i:abs(n[i]))
            axes=[i for i in range(3) if i!=axis]
            for li in poly.loop_indices:
                co=mesh.vertices[mesh.loops[li].vertex_index].co
                uv.data[li].uv=(co[axes[0]],co[axes[1]])
        result.append(obj)
    buckets.clear()
    return result

def copies(template, floors, role):
    for tower,(dx,dy) in enumerate([(0,0),(21,-3.5)]):
        for f in floors:
            for src in template:
                obj=src.copy();obj.data=src.data;scene.collection.objects.link(obj)
                obj.name=f'GEO-T{tower+1}-{role}-{f:02d}-{src["acabamento"]}'
                obj.location=(dx,dy,f*LV);obj['tower']=tower;obj['floor']=f;obj['role']=role
    for obj in template:bpy.data.objects.remove(obj,do_unlink=True)

# Corpos laterais e fundo: vazios das sacadas tem 2 m de profundidade real.
box('reboco',-7.5,LV/2+.075,0,5,LV-.15,15)
box('reboco',7.5,LV/2+.075,0,5,LV-.15,15)
box('reboco',0,LV/2+.075,0,10,LV-.15,11)
copies(flush('paredes',True),range(22),'paredes')
box('concreto',0,.075,0,20,.15,15)
copies(flush('lajes',True),range(23),'lajes')

# Guarda-corpos, portas de correr, peitoris e duas trelicas centrais em cada face.
for sign in [-1,1]:
    face=sign*7.5;back=sign*5.54
    for dx in [-7.4,7.4]:
        box('esquadria',dx,1.68,face+sign*.03,1.45,1.3,.075)
        box('vidro',dx,1.68,face+sign*.078,1.3,1.15,.025)
        box('concreto',dx,1.68,face+sign*.102,.038,1.17,.045)
        box('concreto',dx,.98,face+sign*.1,1.55,.07,.21)
    box('recuo',0,LV/2,sign*6.6,1.25,LV-.15,1.8)
    for dx in [-2.95,2.95]:
        box('esquadria',dx,1.44,back,4.04,2.65,.085)
        box('vidro',dx,1.44,back+sign*.065,3.84,2.47,.035)
        for j in [-1,0,1]:box('esquadria',dx+j*1.27,1.44,back+sign*.10,.045,2.5,.055)
        for z in [.27,1.19]:box('esquadria',dx,z,face-sign*.15,4.12,.045,.055)
        for j in range(13):box('esquadria',dx-2.02+j*.337,.73,face-sign*.15,.032,.91,.032)
        for edge in [-2.05,2.05]:
            box('esquadria',dx+edge,1.19,face-sign*1.02,.045,.045,1.78)
            for j in range(5):box('esquadria',dx+edge,.73,face-sign*(.22+j*.36),.032,.91,.032)
    for dx in [-.38,.38]:
        for edge in [-.28,.28]:box('trelica',dx+edge,LV/2,face+sign*.025,.04,LV,.095)
        for j in range(6):
            for angle in [-.80,.80]:box('trelica',dx,.28+j*.51,face+sign*.06,.035,.70,.085,angle)
    for dz in [-3.8,3.8]:
        box('esquadria',sign*10.025,1.65,dz,.065,1.28,1.16)
        box('vidro',sign*10.07,1.65,dz,.04,1.14,1.02)
        box('concreto',sign*10.1,1.65,dz,.045,1.16,.036)
copies(flush('fachada'),range(22),'detalhes')

# Cortinas acesas em ritmo irregular. Lamelas suaves desenham as dobras em 3D.
for variant in range(4):
    for sign in [-1,1]:
        dx=(-2.95 if variant%2 else 2.95)
        for j in range(20):box('luz',dx-1.8+j*.188,1.44,sign*(5.64+.018*math.sin(j*1.8)),.19,2.43,.025)
        if variant!=2:
            wx=-7.4 if variant%2 else 7.4
            for j in range(8):box('luz',wx-.57+j*.163,1.68,sign*7.592,.165,1.12,.023)
    copies(flush('cortina'+str(variant)),range(variant,22,5),'luz')

# Vasos e folhagem organica em poucas sacadas, sem inventar grandes jardins.
folha_mesh=None
for tower,(dx,dy) in enumerate([(0,0),(21,-3.5)]):
    for f in [2,6,10,15,19]:
        x=dx+(4 if f%2 else -4);depth=6.55-dy
        box('vaso',x,f*LV+.38,depth,.64,.46,.56)
        rng=random.Random(tower*100+f)
        for j in range(4):
            if folha_mesh is None:
                bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1)
                ob=bpy.context.object;folha_mesh=ob.data;folha_mesh.materials.append(MATS['folhagem'])
            else:
                ob=bpy.data.objects.new('GEO-folha',folha_mesh);scene.collection.objects.link(ob)
            ob.location=(x+rng.uniform(-.25,.25),-depth+rng.uniform(-.2,.2),f*LV+.80+rng.uniform(0,.24))
            ob.name=f'GEO-planta-{tower}-{f}-{j}';ob.scale=(.28,.25,.4);ob['acabamento']='folhagem'
    # Platibandas, impermeabilizacao e caixa posterior de circulacao.
    height=22*LV
    box('cobertura',dx,height+.16,-dy,19.6,.025,14.6)
    for xx in [-9.9,9.9]:box('reboco',dx+xx,height+.47,-dy,.2,.65,15)
    for zz in [-7.4,7.4]:box('reboco',dx,height+.47,zz-dy,20,.65,.2)
    box('reboco',dx,height/2+.75,-5.5-dy,5,height+1.5,4)
    for f in range(1,23):box('concreto',dx,f*LV,-7.54-dy,5,.055,.035)
    box('concreto',dx,height+1.55,-5.5-dy,5.08,.10,4.08)
box('reboco',10.5,1.55,11,38,3.1,8)
box('vidro',10.5,1.55,15.025,35.8,2.7,.055)
box('concreto',10.5,3.22,14.8,38.4,.22,2.5)
for j in range(57):box('trelica',-7.5+j*.64,1.55,15.12,.095,2.85,.16)
flush('cobertura-portaria',True)

# Fonte de referencia incluida no .blend como Image Empty, fora de render/export.
img=bpy.data.images.load(str(ROOT/'referencias/castanheiras.png'));img.pack()
ref=bpy.data.objects.new('REF-perspectiva-fornecida',None);scene.collection.objects.link(ref)
ref.empty_display_type='IMAGE';ref.data=img;ref.empty_display_size=75;ref.location=(-65,0,37)
ref.hide_render=True

# Exportacao web dos meshes AVALIADOS do Blender, incluindo os bevels.
# Reusa geometria e matrizes, mantendo a pagina offline sem loader externo.
deps=bpy.context.evaluated_depsgraph_get();geos={};groups={};materials={}
for ob in list(scene.objects):
    if ob.type!='MESH':continue
    key=ob.data.name
    if key not in geos:
        ev=ob.evaluated_get(deps);me=ev.to_mesh();me.calc_loop_triangles()
        pos=[];norm=[];uv=[]
        for tri in me.loop_triangles:
            for li in tri.loops:
                v=me.vertices[me.loops[li].vertex_index].co
                n=me.corner_normals[li].vector
                pos.extend(round(t,5) for t in (v.x,v.z,-v.y));norm.extend(round(t,5) for t in (n.x,n.z,-n.y))
                uv.extend(round(t,5) for t in (me.uv_layers.active.data[li].uv if me.uv_layers.active else (0,0)))
        geos[key]={'position':pos,'normal':norm,'uv':uv};ev.to_mesh_clear()
    mat=ob.data.materials[0];mk=mat.name
    p=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    materials[mk]={'color':list(p.inputs['Base Color'].default_value)[:3],
        'roughness':p.inputs['Roughness'].default_value,'metalness':p.inputs['Metallic'].default_value,
        'emissive':list(p.inputs['Emission Color'].default_value)[:3],
        'emissiveIntensity':p.inputs['Emission Strength'].default_value}
    gkey=(key,ob.get('tower',-1))
    group=groups.setdefault(gkey,{'geometry':key,'material':mk,'tower':ob.get('tower',-1),
        'role':ob.get('role','acabamento'),'instances':[]})
    group['instances'].append({'p':[ob.location.x,ob.location.z,-ob.location.y],
        's':[ob.scale.x,ob.scale.z,ob.scale.y],'floor':ob.get('floor',-1)})
asset={'source':'Blender '+bpy.app.version_string,'geometries':geos,'materials':materials,'groups':list(groups.values())}
(OUT/'modelo.json').write_text(json.dumps(asset,separators=(',',':')),encoding='utf8')

# GLB editavel/interoperavel: apenas a geometria da maquete.
bpy.ops.object.select_all(action='DESELECT')
for ob in scene.objects:
    if ob.type=='MESH':ob.select_set(True)
props=bpy.ops.export_scene.gltf.get_rna_type().properties
print('GLTF_FORMATS',[i.identifier for i in props['export_format'].enum_items])
options=dict(filepath=str(OUT/'castanheiras.glb'),use_selection=True,export_format='GLB',export_apply=True)
if 'export_gpu_instances' in props:options['export_gpu_instances']=True
bpy.ops.export_scene.gltf(**options)

# Iluminacao de estudio no entardecer para inspecionar a referencia.
world=bpy.data.worlds.new('Entardecer');world.use_nodes=True;scene.world=world
bg=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs[0].default_value=(.13,.18,.25,1);bg.inputs[1].default_value=.55
def area(name,loc,power,color,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
    ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=loc
    ob.rotation_euler=(Vector((10,0,32))-ob.location).to_track_quat('-Z','Y').to_euler()
area('KEY-softbox',(-40,-65,100),85000,(1,.85,.67),65)
area('FILL-sky',(55,-20,70),45000,(.63,.76,1),55)
camera=bpy.data.cameras.new('CAM-referencia');cam=bpy.data.objects.new('CAM-referencia',camera);scene.collection.objects.link(cam)
cam.location=(-53,-120,26);target=Vector((10,-2,35))
cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();camera.lens=55;scene.camera=cam
scene.render.resolution_x=900;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
try:scene.render.engine='CYCLES'
except TypeError:pass
scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.film_transparent=True
formats=[i.identifier for i in scene.render.image_settings.bl_rna.properties['file_format'].enum_items]
scene.render.image_settings.file_format=next(v for v in formats if v=='PNG')
scene.render.filepath=str(OUT/'preview.png')
for screen in bpy.data.screens:
    for a in screen.areas:
        if a.type=='VIEW_3D':a.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'castanheiras.blend'))
report={'blender':bpy.app.version_string,'towers':2,'floors_per_tower':22,'balcony_depth_m':2,
        'reference':'../referencias/castanheiras.png','back':'aproximado por simetria',
        'objects':len(scene.objects),'shared_geometries':len(geos),'web_bytes':(OUT/'modelo.json').stat().st_size}
(OUT/'validacao.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('MODEL_READY',json.dumps(report),flush=True)
bpy.ops.render.render(write_still=True)

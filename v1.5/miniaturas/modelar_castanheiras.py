"""Blender 5.x: fachada Castanheiras a partir da fonte LEVE normalizada.
Executar com blender --background --factory-startup --python este_arquivo.py -- <propertyId>.
"""
import bpy, math, json, random, sys
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parent
REPO=ROOT.parent.parent
sys.path.insert(0,str(ROOT))
sys.path.insert(0,str(REPO))
from blender_maquete_base import material, box, flush, MATS
from pipeline.fonte_leve import normalizar, FonteLeveErro

if '--' not in sys.argv or sys.argv.index('--')+1 >= len(sys.argv):
    raise SystemExit('uso: blender --background --factory-startup --python modelar_castanheiras.py -- <propertyId>')
uid=sys.argv[sys.argv.index('--')+1]
try:
    fonte=normalizar(uid)
except FonteLeveErro as exc:
    raise SystemExit(str(exc))
style=fonte['style'];building=fonte['building'];render=fonte['render'];metadata=fonte['metadata']
if style['profile']!='castanheiras-ebm-v1':
    raise SystemExit('perfil LEVE nao suportado por modelar_castanheiras.py: '+style['profile'])
slug=style['slug']
OUT=ROOT/(slug+'_blender')
OUT.mkdir(exist_ok=True)
scene=bpy.context.scene
print('BLENDER',bpy.app.version_string,'SCENE',scene.name,len(scene.objects))
for obj in list(scene.objects):
    bpy.data.objects.remove(obj,do_unlink=True)
LV=building['floorHeight'];N=building['floors'];W=building['width'];D=building['depth']
towers=[(b.get('du',0),-b.get('dv',0)) for b in building['towers']]
facade=style['facade']
for name,spec in style['materials'].items():
    material(name,spec['color'],spec.get('roughness',.8),spec.get('metalness',0),
             emission=spec.get('emission',0))

# Geometria agrupada por acabamento por pavimento. material/box/flush vêm da base comum.
def copies(template, floors, role):
    for tower,(dx,dy) in enumerate(towers):
        for f in floors:
            for src in template:
                obj=src.copy();obj.data=src.data;scene.collection.objects.link(obj)
                obj.name=f'GEO-T{tower+1}-{role}-{f:02d}-{src["acabamento"]}'
                obj.location=(dx,dy,f*LV);obj['tower']=tower;obj['floor']=f;obj['role']=role
    for obj in template:bpy.data.objects.remove(obj,do_unlink=True)

# Corpos laterais e fundo: massa do cadastro, linguagem visual do perfil.
side_w=facade['sideBodyWidth'];side_x=(W-side_w)/2
box('reboco',-side_x,LV/2+.075,0,side_w,LV-.15,D)
box('reboco',side_x,LV/2+.075,0,side_w,LV-.15,D)
box('reboco',0,LV/2+.075,0,facade['centerBodyWidth'],LV-.15,facade['centerBodyDepth'])
copies(flush('paredes',True),range(N),'paredes')
box('concreto',0,.075,0,W,.15,D)
copies(flush('lajes',True),range(N+1),'lajes')

# Guarda-corpos, portas de correr, peitoris e duas trelicas centrais em cada face.
for sign in [-1,1]:
    face=sign*(D/2);back=sign*facade['backFaceOffset']
    for dx in facade['sideWindowX']:
        box('esquadria',dx,1.68,face+sign*.03,1.45,1.3,.075)
        box('vidro',dx,1.68,face+sign*.078,1.3,1.15,.025)
        box('concreto',dx,1.68,face+sign*.102,.038,1.17,.045)
        box('concreto',dx,.98,face+sign*.1,1.55,.07,.21)
    box('recuo',0,LV/2,sign*6.6,1.25,LV-.15,1.8)
    for dx in facade['balconyCenters']:
        box('esquadria',dx,1.44,back,4.04,2.65,.085)
        box('vidro',dx,1.44,back+sign*.065,3.84,2.47,.035)
        for j in [-1,0,1]:box('esquadria',dx+j*1.27,1.44,back+sign*.10,.045,2.5,.055)
        for z in [.27,1.19]:box('esquadria',dx,z,face-sign*.15,4.12,.045,.055)
        for j in range(13):box('esquadria',dx-2.02+j*.337,.73,face-sign*.15,.032,.91,.032)
        for edge in [-2.05,2.05]:
            box('esquadria',dx+edge,1.19,face-sign*1.02,.045,.045,1.78)
            for j in range(5):box('esquadria',dx+edge,.73,face-sign*(.22+j*.36),.032,.91,.032)
    for dx in facade['trellisCenters']:
        for edge in [-.28,.28]:box('trelica',dx+edge,LV/2,face+sign*.025,.04,LV,.095)
        for j in range(6):
            for angle in [-.80,.80]:box('trelica',dx,.28+j*.51,face+sign*.06,.035,.70,.085,angle)
    for dz in [-3.8,3.8]:
        box('esquadria',sign*10.025,1.65,dz,.065,1.28,1.16)
        box('vidro',sign*10.07,1.65,dz,.04,1.14,1.02)
        box('concreto',sign*10.1,1.65,dz,.045,1.16,.036)
copies(flush('fachada'),range(N),'detalhes')

# Cortinas acesas em ritmo irregular. Lamelas suaves desenham as dobras em 3D.
for variant in range(facade['curtainVariants']):
    for sign in [-1,1]:
        dx=(facade['balconyCenters'][0] if variant%2 else facade['balconyCenters'][1])
        for j in range(20):box('luz',dx-1.8+j*.188,1.44,sign*(5.64+.018*math.sin(j*1.8)),.19,2.43,.025)
        if variant!=2:
            wx=facade['sideWindowX'][0] if variant%2 else facade['sideWindowX'][1]
            for j in range(8):box('luz',wx-.57+j*.163,1.68,sign*7.592,.165,1.12,.023)
    copies(flush('cortina'+str(variant)),range(variant,N,facade['curtainCycle']),'luz')

# Vasos e folhagem organica em poucas sacadas, sem inventar grandes jardins.
folha_mesh=None
for tower,(dx,dy) in enumerate(towers):
    for f in facade['plantingFloors']:
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
    height=N*LV
    box('cobertura',dx,height+.16,-dy,19.6,.025,14.6)
    for xx in [-9.9,9.9]:box('reboco',dx+xx,height+.47,-dy,.2,.65,15)
    for zz in [-7.4,7.4]:box('reboco',dx,height+.47,zz-dy,20,.65,.2)
    box('reboco',dx,height/2+.75,-5.5-dy,5,height+1.5,4)
    for f in range(1,N+1):box('concreto',dx,f*LV,-7.54-dy,5,.055,.035)
    box('concreto',dx,height+1.55,-5.5-dy,5.08,.10,4.08)
portaria=building['portaria'];px=portaria['du'];py=portaria['dv'];pw=portaria['largura_m'];pd=portaria['profundidade_m']
box('reboco',px,1.55,py,pw,3.1,pd)
box('vidro',px,1.55,py+pd/2+.025,pw-2.2,2.7,.055)
box('concreto',px,3.22,py+pd/2-.2,pw+.4,.22,2.5)
for j in range(57):box('trelica',px-pw/2+1+j*.64,1.55,py+pd/2+.12,.095,2.85,.16)
flush('cobertura-portaria',True)

# Fonte de referencia só afeta o .blend de autoria; não entra no export/render.
ref_path=ROOT/style['referenceImage']
ref=bpy.data.objects.new('REF-perspectiva-fornecida',None);scene.collection.objects.link(ref)
ref.empty_display_size=render['referenceEmpty']['size'];ref.location=render['referenceEmpty']['location'];ref.hide_render=True
if ref_path.is_file():
    img=bpy.data.images.load(str(ref_path));img.pack()
    ref.empty_display_type='IMAGE';ref.data=img
else:
    ref.empty_display_type='PLAIN_AXES'
    print('REFERENCE_OPTIONAL_MISSING',str(ref_path),flush=True)

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
options=dict(filepath=str(OUT/(slug+'.glb')),use_selection=True,export_format='GLB',export_apply=True)
if 'export_gpu_instances' in props:options['export_gpu_instances']=True
bpy.ops.export_scene.gltf(**options)

# Iluminacao de estudio no entardecer para inspecionar a referencia.
world=bpy.data.worlds.new('Entardecer');world.use_nodes=True;scene.world=world
bg=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs[0].default_value=(*render['worldColor'],1);bg.inputs[1].default_value=render['worldStrength']
def area(name,loc,power,color,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
    ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=loc
    ob.rotation_euler=(Vector((10,0,32))-ob.location).to_track_quat('-Z','Y').to_euler()
for name,key in [('KEY-softbox','key'),('FILL-sky','fill')]:
    luz=render[key];area(name,luz['location'],luz['power'],luz['color'],luz['size'])
camera=bpy.data.cameras.new('CAM-referencia');cam=bpy.data.objects.new('CAM-referencia',camera);scene.collection.objects.link(cam)
cam.location=render['camera']['location'];target=Vector(render['camera']['target'])
cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();camera.lens=render['camera']['lens'];scene.camera=cam
scene.render.resolution_x=render['resolution'][0];scene.render.resolution_y=render['resolution'][1];scene.render.resolution_percentage=100
try:scene.render.engine='CYCLES'
except TypeError:pass
scene.cycles.samples=render['samples'];scene.cycles.use_denoising=True
scene.render.film_transparent=True
formats=[i.identifier for i in scene.render.image_settings.bl_rna.properties['file_format'].enum_items]
scene.render.image_settings.file_format=next(v for v in formats if v=='PNG')
scene.render.filepath=str(OUT/'preview.png')
for screen in bpy.data.screens:
    for a in screen.areas:
        if a.type=='VIEW_3D':a.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'castanheiras.blend'))
pavimentos_e_lajes_duas_torres=all(
    len([g for g in groups.values() if g['tower']==tower and g['role']==role])==1
    and len([g for g in groups.values() if g['tower']==tower and g['role']==role][0]['instances'])==n
    for tower in range(len(towers)) for role,n in (('paredes',N),('lajes',N+1))
)
geometria_finita=all(
    math.isfinite(v)
    for geo in geos.values()
    for key in ('position','normal','uv')
    for v in geo[key]
)
normais_e_uv=all(
    len(geo['position'])%3==0
    and len(geo['normal'])==len(geo['position'])
    and len(geo['uv'])==(len(geo['position'])//3)*2
    for geo in geos.values()
)
glb_path=OUT/(slug+'.glb')
glb_valido=glb_path.stat().st_size>=12 and glb_path.read_bytes()[:4]==b'glTF'
assert pavimentos_e_lajes_duas_torres,'pavimentos/lajes invalidos'
assert geometria_finita,'geometria nao finita'
assert normais_e_uv,'normais/UV invalidos'
assert glb_valido,'cabecalho GLB invalido'
report={'blender':bpy.app.version_string,'towers':len(towers),'floors_per_tower':N,'balcony_depth_m':style['visualBalconyDepth'],
        'reference':metadata['reference'],'back':metadata['back'],
        'objects':len(scene.objects),'shared_geometries':len(geos),'web_bytes':(OUT/'modelo.json').stat().st_size,
        'checks':{'pavimentos_e_lajes_duas_torres':pavimentos_e_lajes_duas_torres,
                  'geometria_finita':geometria_finita,
                  'normais_e_uv':normais_e_uv,
                  'glb_valido':glb_valido}}
(OUT/'validacao.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('MODEL_READY',json.dumps(report),flush=True)
bpy.ops.render.render(write_still=True)

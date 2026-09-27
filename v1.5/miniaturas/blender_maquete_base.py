"""Ferramentas de autoria e exportacao Blender para as miniaturas MRV."""
import bpy, math, json
from pathlib import Path
from mathutils import Vector, Matrix
scene=bpy.context.scene
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

def repetir(template, torres, pisos, role, lv=3.15):
    for torre,(x,depth,rot) in enumerate(torres):
        for piso in pisos:
            for src in template:
                ob=src.copy();ob.data=src.data;scene.collection.objects.link(ob)
                ob.name=f'GEO-T{torre+1:02d}-{role}-{piso:02d}-{src["acabamento"]}'
                ob.location=(x,-depth,piso*lv);ob.rotation_euler.z=rot
                ob['tower']=torre;ob['floor']=piso;ob['role']=role
    for ob in template:bpy.data.objects.remove(ob,do_unlink=True)

def exportar(out,slug,metadata):
    out=Path(out);out.mkdir(parents=True,exist_ok=True)
    deps=bpy.context.evaluated_depsgraph_get();geos={};groups={};materials={}
    basis=Matrix(((1,0,0,0),(0,0,1,0),(0,-1,0,0),(0,0,0,1)))
    for ob in list(scene.objects):
        if ob.type!='MESH':continue
        key=ob.data.name
        if key not in geos:
            ev=ob.evaluated_get(deps);me=ev.to_mesh();me.calc_loop_triangles()
            pos=[];norm=[];uv=[];indices=[];lookup={}
            for tri in me.loop_triangles:
                for li in tri.loops:
                    v=me.vertices[me.loops[li].vertex_index].co;n=me.corner_normals[li].vector
                    tex=me.uv_layers.active.data[li].uv if me.uv_layers.active else (0,0)
                    vertex=tuple(round(t,5) for t in (v.x,v.z,-v.y,n.x,n.z,-n.y,*tex))
                    if vertex not in lookup:
                        lookup[vertex]=len(pos)//3;pos.extend(vertex[:3]);norm.extend(vertex[3:6]);uv.extend(vertex[6:])
                    indices.append(lookup[vertex])
            geos[key]={'position':pos,'normal':norm,'uv':uv,'index':indices};ev.to_mesh_clear()
        mat=ob.data.materials[0];mk=mat.name
        p=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
        materials[mk]={'color':list(p.inputs['Base Color'].default_value)[:3],
            'roughness':p.inputs['Roughness'].default_value,'metalness':p.inputs['Metallic'].default_value,
            'emissive':list(p.inputs['Emission Color'].default_value)[:3],
            'emissiveIntensity':p.inputs['Emission Strength'].default_value}
        gkey=(key,ob.get('tower',-1))
        group=groups.setdefault(gkey,{'geometry':key,'material':mk,'tower':ob.get('tower',-1),
            'role':ob.get('role','acabamento'),'instances':[]})
        mx=basis@ob.matrix_world@basis.inverted()
        group['instances'].append({'matrix':[round(mx[r][c],6) for c in range(4) for r in range(4)],'floor':ob.get('floor',-1)})
    asset={'source':'Blender '+bpy.app.version_string,'geometries':geos,'materials':materials,'groups':list(groups.values()),'metadata':metadata}
    (out/'modelo.json').write_text(json.dumps(asset,separators=(',',':')),encoding='utf8')
    for tower in range(metadata['towers']):
        for role,num in [('paredes',metadata['floors']),('lajes',metadata['floors']+1)]:
            found=[g for g in groups.values() if g['tower']==tower and g['role']==role]
            assert len(found)==1,(tower,role,len(found))
            assert sorted(i['floor'] for i in found[0]['instances'])==list(range(num))
    bpy.ops.object.select_all(action='DESELECT')
    for ob in scene.objects:
        if ob.type=='MESH':ob.select_set(True)
    props=bpy.ops.export_scene.gltf.get_rna_type().properties
    print('GLTF enum', [i.identifier for i in props['export_format'].enum_items])
    opts=dict(filepath=str(out/(slug+'.glb')),use_selection=True,export_format='GLB',export_apply=True)
    if 'export_gpu_instances' in props:opts['export_gpu_instances']=True
    bpy.ops.export_scene.gltf(**opts)
    # Checks historicamente versionados passam a ser calculados no caminho reproduzivel.
    finite_geometry=all(
        math.isfinite(v)
        for geo in geos.values()
        for key in ('position','normal','uv')
        for v in geo[key]
    )
    normals_uv_indices=all(
        len(geo['position'])%3==0
        and len(geo['normal'])==len(geo['position'])
        and len(geo['uv'])==(len(geo['position'])//3)*2
        and len(geo['index'])%3==0
        and all(isinstance(i,int) and 0<=i<len(geo['position'])//3 for i in geo['index'])
        for geo in geos.values()
    )
    glb_path=out/(slug+'.glb')
    glb_header=glb_path.stat().st_size>=12 and glb_path.read_bytes()[:4]==b'glTF'
    assert finite_geometry,'geometria nao finita'
    assert normals_uv_indices,'normais/UV/indices invalidos'
    assert glb_header,'cabecalho GLB invalido'
    report=dict(metadata,blender=bpy.app.version_string,geometries=len(geos),groups=len(groups),
                web_bytes=(out/'modelo.json').stat().st_size,glb_bytes=glb_path.stat().st_size,
                checks={'pavimentos_e_lajes':True,'exportacao':True,
                        'finite_geometry':finite_geometry,
                        'normals_uv_indices':normals_uv_indices,
                        'glb_header':glb_header})
    (out/'validacao.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    print('MODEL_READY',json.dumps(report),flush=True)

def renderizar(out,slug,reference,target,distance,ortho,detalhe):
    out=Path(out)
    if reference:
        reference=Path(reference)
        if reference.is_file():
            img=bpy.data.images.load(str(reference));img.pack()
            ref=bpy.data.objects.new('REF-fachada-MRV',None);scene.collection.objects.link(ref)
            ref.empty_display_type='IMAGE';ref.data=img;ref.empty_display_size=50;ref.location=(-120,0,30);ref.hide_render=True
        else:
            print('REFERENCE_OPTIONAL_MISSING',str(reference),flush=True)
    world=bpy.data.worlds.new('Ceu-estudio');world.use_nodes=True;scene.world=world
    bg=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND')
    bg.inputs[0].default_value=(.20,.26,.34,1);bg.inputs[1].default_value=.6
    def area(name,loc,power,color,size):
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.size=size
        ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=loc
        ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
    area('KEY',(-60,-90,115),110000,(1,.88,.72),70)
    area('FILL',(90,40,90),75000,(.70,.80,1),65)
    data=bpy.data.cameras.new('CAM-maquete');cam=bpy.data.objects.new('CAM-maquete',data);scene.collection.objects.link(cam)
    cam.location=Vector(target)+Vector(distance);cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    data.type='ORTHO';data.ortho_scale=ortho;scene.camera=cam
    scene.render.resolution_x=1200;scene.render.resolution_y=950;scene.render.resolution_percentage=100
    try:scene.render.engine='CYCLES'
    except TypeError:pass
    scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.render.film_transparent=True
    formats=scene.render.image_settings.bl_rna.properties['file_format'].enum_items
    assert 'PNG' in [i.identifier for i in formats];scene.render.image_settings.file_format='PNG'
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA'
    scene.render.filepath=str(out/'preview.png')
    bpy.ops.wm.save_as_mainfile(filepath=str(out/(slug+'.blend')))
    bpy.ops.render.render(write_still=True)
    # Vista de detalhe do bloco principal, preservando a mesma geometria.
    for ob in scene.objects:
        if ob.type=='MESH' and ob.get('tower',-1)!=0:ob.hide_render=True
    detail_target=Vector(detalhe['target'])
    cam.location=detail_target+Vector(detalhe['distance'])
    cam.rotation_euler=(detail_target-cam.location).to_track_quat('-Z','Y').to_euler()
    data.ortho_scale=detalhe['ortho']
    scene.render.filepath=str(out/'detalhe.png');bpy.ops.render.render(write_still=True)


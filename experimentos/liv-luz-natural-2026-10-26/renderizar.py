"""LIV: luz diurna motivada, ativos locais e validação de persistência."""
import argparse
import bmesh
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import random
import sys
import bpy
import numpy as np
from mathutils import Matrix,Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT=Path(__file__).resolve().parent
PREVIOUS=ROOT.parent/'liv-render-revisao-2026-10-26'
SOURCE=PREVIOUS/'entrega/LIV_Revisado.blend'
DELIVERY=ROOT/'entrega'
BLEND=DELIVERY/'LIV_Luz_Natural.blend'
LIB=ROOT.parent/'moveis-referencia'
SCENES={'exterior':'01 | Condominio LIV','apartamento':'02 | Apartamento decorado','estar':'03 | Sala e jantar','jantar':'04 | Jantar e cozinha'}
spec=importlib.util.spec_from_file_location('liv_helpers',PREVIOUS/'revisar_liv.py')
H=importlib.util.module_from_spec(spec); spec.loader.exec_module(H)
_original_cube=H.cube
def outward_cube(*args,**kwargs):
    o=_original_cube(*args,**kwargs)
    bm=bmesh.new(); bm.from_mesh(o.data)
    if bm.calc_volume(signed=True)<0: bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
    bm.to_mesh(o.data); bm.free(); o.data.update()
    return o
H.cube=outward_cube
RNG=random.Random(261027)
ASSET_LOG=[]


def update(scene=None):
    if scene: bpy.context.window.scene=scene
    bpy.context.view_layer.update()


def collection(name,scene):
    c=bpy.data.collections.new('R3 | '+name); scene.collection.children.link(c); return c


def append_asset(path,names,col,label):
    requested=tuple(names)
    with bpy.data.libraries.load(str(path),link=False) as (src,dst):
        assert all(n in src.objects for n in requested),(label,'objetos ausentes')
        dst.objects=list(requested)
    mapping=dict(zip(requested,dst.objects))
    pending=list(mapping.values()); linked=set()
    while pending:
        o=pending.pop()
        if o is None or o in linked: continue
        assert o.type in ('MESH','EMPTY'),(label,o.name,o.type)
        if o.name not in col.objects: col.objects.link(o)
        linked.add(o)
        if o.parent: pending.append(o.parent)
    update()
    matrices={o:o.matrix_world.copy() for o in linked}
    for o in linked:
        o.parent=None; o.matrix_world=matrices[o]
    for original,o in mapping.items():
        o.name='R3 | '+label+' | '+original
        o['R3_asset']=label
    for o in linked:
        if o.type=='EMPTY': bpy.data.objects.remove(o,do_unlink=True)
    objects=[o for o in mapping.values() if o.type=='MESH']
    ASSET_LOG.append({'label':label,'source':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'objects':len(objects)})
    return mapping,objects


def fit(objects,lo,hi,rotation=0):
    turn=Matrix.Rotation(rotation,4,'Z')
    for o in objects: o.matrix_world=turn@o.matrix_world
    update()
    points=[o.matrix_world@Vector(v) for o in objects for v in o.bound_box]
    low=Vector([min(p[i] for p in points) for i in range(3)])
    high=Vector([max(p[i] for p in points) for i in range(3)])
    destlow,desthigh=Vector(lo),Vector(hi)
    scale=Vector([(desthigh[i]-destlow[i])/(high[i]-low[i]) for i in range(3)])
    transform=Matrix.Translation(destlow)@Matrix.Diagonal((*scale,1))@Matrix.Translation(-low)
    for o in objects: o.matrix_world=transform@o.matrix_world
    update()


def share_in_plan(objects,plan):
    col=collection('Moveis novos em corte',plan)
    cutter=next(o for o in plan.objects if o.name.startswith('AUX | Corte'))
    update()
    for original in objects:
        lo,hi=H.bounds(original)
        if hi.z<=1.15:
            col.objects.link(original)
        elif lo.z<1.15:
            o=original.copy(); o.name='CORTE | '+original.name; col.objects.link(o)
            mod=o.modifiers.new('Corte de apresentacao','BOOLEAN'); mod.operation='INTERSECT'; mod.solver='EXACT'; mod.object=cutter
    return col


def hide_old(scene,slots=(),terms=()):
    for o in scene.objects:
        if o.get('LIV_source_slot') in slots or any(t in o.name for t in terms): o.hide_render=True


def close_entry(scene):
    meshes={o.data for o in scene.objects if o.type=='MESH' and o.get('LIV_source_slot')==3}
    for mesh in meshes:
        bm=bmesh.new(); bm.from_mesh(mesh)
        bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001)
        groups=[]; seen=set()
        for v in bm.verts:
            if v in seen: continue
            stack=[v]; group={v}; seen.add(v)
            while stack:
                cur=stack.pop()
                for e in cur.link_edges:
                    nxt=e.other_vert(cur)
                    if nxt not in seen: seen.add(nxt); group.add(nxt); stack.append(nxt)
            ps=[v.co for v in group]
            lo=Vector([min(p[i] for p in ps) for i in range(3)])
            hi=Vector([max(p[i] for p in ps) for i in range(3)])
            c=(lo+hi)/2
            if c.x>2.55 and -2.19<c.y<-1.3 and lo.z>.005 and hi.z<2.1: groups.append((group,lo,hi))
        leaf=next((g for g,lo,hi in groups if hi.z-lo.z>1.8),None)
        if leaf:
            coords=np.asarray([[v.co.x,v.co.y] for v in leaf]); center=coords.mean(axis=0)
            _,vectors=np.linalg.eigh(np.cov(coords.T)); axis=vectors[:,-1]
            if axis[0]<0: axis=-axis
            angle=-math.atan2(axis[1],axis[0]); rot=Matrix.Rotation(angle,4,'Z')
            old=Vector((center[0],center[1],0)); target=Vector((2.5,-2.275,0))
            for group,_,_ in groups:
                for v in group: v.co=target+(rot@(v.co-old))
            bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
            bm.to_mesh(mesh); mesh.update()
            mesh.normals_split_custom_set([(0,0,0)]*len(mesh.loops))
            for p in mesh.polygons: p.use_smooth=False
        bm.free()


def new_furniture(interior,plan):
    inv=json.loads((ROOT/'fontes/inventario.json').read_text(encoding='utf-8'))
    col=collection('Moveis com referencia',interior)
    hide_old(interior,(69,74,75,76),('| sofa |','| chair |','R2 | Almofada','R2 | Assento estofado','R2 | Queimador','R2 | Vidro frontal forno','R2 | Puxador forno','R2 | Puxador geladeira'))
    hide_old(plan,(69,74,75,76),('| sofa |','| chair |','R2 | Almofada','R2 | Assento estofado','R2 | Queimador','R2 | Vidro frontal forno','R2 | Puxador forno','R2 | Puxador geladeira'))
    sofa_names=[r['name'] for r in inv['sofa'] if r['type']=='MESH' and r['name'] not in ('parede','piso','tapete') and not r['name'].startswith('rolo')]
    mapping,sofa=append_asset(LIB/'sofa/render_r7.blend',sofa_names,col,'Sofa linho')
    # Keep simulated cloth; straighten the old rolled-arm design without using
    # its studio, camera, or lights. The source file remains untouched.
    for side in ('esq','dir'):
        sign=-1 if side=='esq' else 1
        o=mapping['braco_'+side]; o.data=o.data.copy()
        for v in o.data.vertices:
            if v.co.x*sign>0: v.co.x-=sign*.10*(v.co.z+.25)/.50
            v.co.z*=1.32
        o.location.z=.33
        mapping['almofada_'+side].scale*=.72
    update(); fit(sofa,(.75,-3.0,.025),(1.65,-1.05,.84),-math.pi/2)
    share_in_plan(sofa,plan)
    # Table and upholstered chairs from the existing local reference library.
    table_names=[r['name'] for r in inv['jantar'] if r['type']=='MESH' and (r['name']=='tampo' or r['name'].startswith(('saia','pe_mesa')))]
    _,table=append_asset(LIB/'jantar/render_r3.blend',table_names,col,'Mesa jantar')
    fit(table,(1.35,-.125,.03),(2.75,.775,.79),math.pi/2); share_in_plan(table,plan)
    chair_names=[r['name'] for r in inv['jantar'] if r['type']=='MESH' and r['name'].startswith('cad_e0_')]
    mapping,prototype=append_asset(LIB/'jantar/render_r3.blend',chair_names,col,'Cadeira 1')
    # cad_e0 is facing +X in its original assembly; normalize to +Y.
    center=Vector((-.56,-.30,0))
    normalize=Matrix.Rotation(math.pi/2,4,'Z')@Matrix.Translation(-center)
    for o in prototype: o.matrix_world=normalize@o.matrix_world
    update()
    template=[(o,o.matrix_world.copy()) for o in prototype]
    positions=[(1.55,.925,math.pi),(2.30,.925,math.pi),(1.55,-.225,0),(2.30,-.225,0),(2.1,2.925,math.pi),(1.9,2.225,-math.pi/2)]
    for i,(x,y,angle) in enumerate(positions):
        group=[]
        for original,matrix in template:
            o=original if i==0 else original.copy()
            if i: col.objects.link(o)
            o.name='R3 | Cadeira '+str(i+1)+' | '+original.name.split('|')[-1].strip()
            o.matrix_world=matrix.copy(); group.append(o)
        fit(group,(x-.225,y-.245,.03),(x+.225,y+.245,.91),angle)
        share_in_plan(group,plan)
    for label,filename,exclude,lo,hi in [
        ('Geladeira','geladeira/render_r6.blend',('softbox','teto_estudio'),(3.45,-2.075,.03),(4.15,-1.375,1.81)),
        ('Fogao','fogao-4b/render_r10.blend',('chao','fundo_estudio'),(3.57,.945,.03),(4.15,1.405,.95)),
    ]:
        key='geladeira' if label=='Geladeira' else 'fogao'
        names=[r['name'] for r in inv[key] if r['type']=='MESH' and r['name'] not in exclude]
        _,objects=append_asset(LIB/filename,names,col,label)
        fit(objects,lo,hi,-math.pi/2); share_in_plan(objects,plan)
    for m in bpy.data.materials:
        if m.name.startswith('inox_preto'):
            p=H.principled(m); H.value(p,'Base Color',(.47,.49,.5,1)); H.value(p,'Metallic',1); H.value(p,'Roughness',.28)
    return col


def curve_tube(name,points,radius,col,mat):
    data=bpy.data.curves.new('R3 | '+name,'CURVE'); data.dimensions='3D'; data.resolution_u=16; data.bevel_depth=radius; data.bevel_resolution=4
    spline=data.splines.new('BEZIER'); spline.bezier_points.add(len(points)-1)
    for p,co in zip(spline.bezier_points,points): p.co=co; p.handle_left_type='AUTO'; p.handle_right_type='AUTO'
    o=bpy.data.objects.new('R3 | '+name,data); col.objects.link(o); data.materials.append(mat); return o


def rounded_rect(w,d,r,n=8):
    result=[]
    for cx,cy,start in [(w/2-r,d/2-r,0),(-w/2+r,d/2-r,90),(-w/2+r,-d/2+r,180),(w/2-r,-d/2+r,270)]:
        for i in range(n):
            angle=math.radians(start+i*90/(n-1)); result.append((cx+r*math.cos(angle),cy+r*math.sin(angle)))
    return result


def kitchen(interior,plan):
    col=collection('Cozinha detalhada',interior)
    cabinet=H.material('R3 Laca greige',(.26,.29,.25),.42)
    quartz=H.material('R3 Quartzo',(.62,.60,.55),.28,texture=180)
    steel=H.material('R3 Inox pia',(.5,.52,.53),.26,1)
    dark=H.material('R3 Rodape e ralos',(.023,.025,.022),.58)
    wood=next(m for m in bpy.data.materials if m.name.startswith('madeira_escura'))
    # Hollow carcass: a solid block would fill the sink from below.
    H.cube('R3 Fundo gabinete',(4.128,-.275,.45),(.018,2.09,.83),col,cabinet,.002)
    for y in (-1.31,.76): H.cube('R3 Lateral gabinete',(3.87,y,.45),(.55,.018,.83),col,cabinet,.002)
    H.cube('R3 Piso gabinete',(3.87,-.275,.15),(.52,2.05,.018),col,cabinet,.002)
    for x in (3.60,4.11): H.cube('R3 Travessa gabinete',(x,-.275,.875),(.035,2.05,.025),col,cabinet,.002)
    H.cube('R3 Rodape recuado',(3.77,-.275,.095),(.30,2.05,.13),col,dark,.001)
    for i in range(3):
        y=-.275+(i-1)*.694
        H.cube('R3 Porta gabinete',(3.575,y,.50),(.025,.688,.714),col,cabinet,.002)
        H.stem('R3 Puxador gabinete',(3.553,y-.19,.80),(3.553,y+.19,.80),.006,col,steel)
    counter=H.cube('R3 Bancada quartzo',(3.84,-.275,.918),(.62,2.10,.036),col,quartz,.004)
    cutter=H.cube('R3 AUX abertura pia',(3.81,-.62,.94),(.39,.57,.28),col,dark,.035)
    cutter.hide_render=True; cutter.display_type='WIRE'
    mod=counter.modifiers.new('Recorte real da cuba','BOOLEAN'); mod.operation='DIFFERENCE'; mod.solver='EXACT'; mod.object=cutter
    # A sloping, rounded bowl rather than a solid white box.
    verts=[]; faces=[]
    for z,w,d,r in [(.94,.39,.57,.055),(.79,.30,.46,.05),(.775,.28,.44,.06)]:
        verts.extend([(3.81+x,-.62+y,z) for x,y in rounded_rect(w,d,r)])
    steps=32
    for ring in range(2):
        for i in range(steps): faces.append((ring*steps+i,ring*steps+(i+1)%steps,(ring+1)*steps+(i+1)%steps,(ring+1)*steps+i))
    faces.append(tuple(2*steps+i for i in range(steps)))
    bowl=H.mesh_obj('R3 Cuba inox',verts,faces,col,steel)
    for p in bowl.data.polygons: p.use_smooth=True
    H.lathe('R3 Ralo',(3.81,-.62,.777),[(0,.024),(.001,.024)],col,dark)
    curve_tube('Torneira',[(4.04,-.62,.94),(4.04,-.62,1.20),(4.00,-.62,1.27),(3.88,-.62,1.26),(3.85,-.62,1.13)],.010,col,steel)
    H.lathe('R3 Base torneira',(4.04,-.62,.94),[(0,.024),(.035,.022)],col,steel)
    H.stem('R3 Alavanca torneira',(4.04,-.58,1.03),(4.04,-.52,1.09),.005,col,steel)
    tile=H.material('R3 Ceramica acetinada',(.57,.56,.51),.48,texture=120)
    grout=H.material('R3 Rejunte',(.36,.35,.31),.85)
    H.cube('R3 Fundo backsplash',(4.17,-.275,1.2),(.012,2.1,.53),col,grout,.001)
    for j in range(10):
        for k in range(3):
            H.cube('R3 Azulejo',(4.157,-1.22+j*.21,1.026+k*.174),(.010,.208,.171),col,tile,.001)
    H.cube('R3 Prateleira',(4.02,.15,1.68),(.26,1.1,.027),col,wood,.004)
    share_in_plan([o for o in col.objects if o.type=='MESH' and o!=cutter],plan)
    # The cutaway keeps the original cutter reference through the counter copy.
    if cutter.name not in plan.collection.objects: plan.collection.objects.link(cutter)


def plant(interior,plan):
    for s in (interior,plan):
        hide_old(s,terms=('R2 | Cachepo planta','R2 | Haste planta','R2 | Folha tropical','R2 | Vaso jantar','R2 | Ramo jantar','R2 | Folha eucalyptus'))
    col=collection('Plantas Poly Haven',interior)
    path=ROOT/'fontes/polyhaven/potted_plant_01_1k.blend'
    with bpy.data.libraries.load(str(path),link=False) as (src,dst): names=list(src.objects)
    mapping,objects=append_asset(path,names,col,'Planta Poly Haven')
    fit(objects,(1.17,.99,.03),(1.67,1.45,1.08))
    # Whole plant in the diagram is intentional; it does not cover any room.
    pc=collection('Planta em corte',plan)
    for o in objects: pc.objects.link(o)
    return objects


def artwork(interior):
    hide_old(interior,terms=('R2 | Quadro estar','R2 | Arte '))
    col=collection('Arte impressa',interior)
    oak=next(m for m in bpy.data.materials if 'Carvalho painel' in m.name)
    H.cube('R3 Moldura arte',(.30,-3.022,1.66),(1.12,.032,.72),col,oak,.004)
    mat=H.material('R3 Aquarela impressa',(.68,.64,.55),.92)
    n,l=mat.node_tree.nodes,mat.node_tree.links; p=H.principled(mat)
    uv=n.new('ShaderNodeTexCoord'); noise=n.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value=6; noise.inputs['Detail'].default_value=3
    l.new(uv.outputs['UV'],noise.inputs['Vector'])
    color=None
    for center,scale,radius,ink in [((.37,.43,0),(1,1.3,0),.26,(.43,.26,.15,1)),((.66,.60,0),(1.1,1.0,0),.24,(.31,.35,.23,1))]:
        sub=n.new('ShaderNodeVectorMath'); sub.operation='SUBTRACT'; sub.inputs[1].default_value=center
        mul=n.new('ShaderNodeVectorMath'); mul.operation='MULTIPLY'; mul.inputs[1].default_value=scale
        length=n.new('ShaderNodeVectorMath'); length.operation='LENGTH'
        mask=n.new('ShaderNodeMapRange'); mask.clamp=True; mask.interpolation_type='SMOOTHERSTEP'
        mask.inputs['From Min'].default_value=radius-.018; mask.inputs['From Max'].default_value=radius+.018
        mask.inputs['To Min'].default_value=.72; mask.inputs['To Max'].default_value=0
        l.new(uv.outputs['UV'],sub.inputs[0]); l.new(sub.outputs[0],mul.inputs[0]); l.new(mul.outputs[0],length.inputs[0]); l.new(length.outputs['Value'],mask.inputs['Value'])
        mix=n.new('ShaderNodeMixRGB'); mix.inputs[1].default_value=(.73,.69,.60,1); mix.inputs[2].default_value=ink
        if color: l.new(color,mix.inputs[1])
        l.new(mask.outputs[0],mix.inputs[0]); color=mix.outputs[0]
    l.new(color,p.inputs['Base Color'])
    o=H.mesh_obj('R3 Papel arte',[(-.22,-2.999,1.34),(.82,-2.999,1.34),(.82,-2.999,1.98),(-.22,-2.999,1.98)],[(0,1,2,3)],col,mat)
    uv_layer=o.data.uv_layers.new(name='UV arte')
    for loop,co in zip(uv_layer.data,[(0,0),(1,0),(1,1),(0,1)]): loop.uv=co
    ink=H.material('R3 Tinta arte',(.045,.052,.038),.98)
    curve_tube('Traco impresso',[(-.01,-2.998,1.45),(-.04,-2.998,1.65),(.10,-2.998,1.84),(.32,-2.998,1.88),(.51,-2.998,1.73),(.61,-2.998,1.52)],.0007,col,ink)


def daylight_world(scene):
    w=bpy.data.worlds.new('R3 | Ceu fisico e um unico sol'); w.use_nodes=True
    n,l=w.node_tree.nodes,w.node_tree.links; n.clear()
    out=n.new('ShaderNodeOutputWorld'); bg=n.new('ShaderNodeBackground'); bg.name='Daylight strength'; bg.inputs['Strength'].default_value=1
    sky=n.new('ShaderNodeTexSky'); sky.name='Daylight sky'; sky.sky_type='MULTIPLE_SCATTERING'
    sky.sun_disc=True; sky.sun_elevation=math.radians(35); sky.sun_rotation=math.radians(10); sky.sun_size=math.radians(.545)
    l.new(sky.outputs['Color'],bg.inputs['Color']); l.new(bg.outputs[0],out.inputs[0]); scene.world=w
    return w


def daylight_sampling_portal(interior,dining):
    existing=[o for o in interior.objects if o.get('R3_sampling_portal')]
    assert len(existing)<=1,'Portal de amostragem duplicado'
    if existing:
        assert existing[0].data.cycles.is_portal and existing[0].data.energy==0
        return existing[0]
    col=collection('Portal de amostragem sem emissao',interior)
    dining.collection.children.link(col)
    data=bpy.data.lights.new('R3 | Portal da abertura | potencia zero','AREA')
    data.energy=0; data.shape='RECTANGLE'; data.size=.73; data.size_y=2.02; data.cycles.is_portal=True
    obj=bpy.data.objects.new(data.name,data); col.objects.link(obj)
    obj.location=(2.07,1.59,1.085); obj.rotation_euler=Vector((0,-1,0)).to_track_quat('-Z','Y').to_euler()
    obj['R3_sampling_portal']=True
    assert data.energy==0 and data.cycles.is_portal
    return obj


def flat_table_caps(scene):
    corrected=[]
    for obj in scene.objects:
        if obj.type!='MESH' or 'Tampo carvalho mesa de apoio' not in obj.name: continue
        caps=[p for p in obj.data.polygons if abs(p.normal.z)>.999 and len(p.vertices)>4]
        assert len(caps)==2,('Tampas planas inesperadas',obj.name,len(caps))
        for polygon in caps: polygon.use_smooth=False
        obj.data.update()
        corrected.append({'object':obj.name,'flat_caps':len(caps)})
    assert corrected,'Tampo da mesa de apoio ausente'
    return corrected


def silence_artificial(interior,dining):
    lights={o for s in (interior,dining) for o in s.objects if o.type=='LIGHT'}
    for o in lights: bpy.data.objects.remove(o,do_unlink=True)
    for m in bpy.data.materials:
        if not m.use_nodes: continue
        for n in m.node_tree.nodes:
            if n.type=='BSDF_PRINCIPLED': H.value(n,'Emission Strength',0)
            if n.type=='EMISSION': n.inputs['Strength'].default_value=0


def glazing_and_finishes():
    # Thin flat windows: retain refraction/reflection for camera rays, while
    # shadow rays transmit with attenuation. No new light or emission is added.
    for m in bpy.data.materials:
        if not m.use_nodes: continue
        if m.name=='LIV | Interior-m5':
            n,l=m.node_tree.nodes,m.node_tree.links
            out=next(x for x in n if x.type=='OUTPUT_MATERIAL')
            surface=out.inputs['Surface'].links[0].from_socket
            path=n.new('ShaderNodeLightPath'); transparent=n.new('ShaderNodeBsdfTransparent')
            transparent.inputs['Color'].default_value=(.96,.96,.96,1)
            mix=n.new('ShaderNodeMixShader'); mix.label='Janela fina: sombra transmitida, sem caustica'
            l.new(path.outputs['Is Shadow Ray'],mix.inputs[0]); l.new(surface,mix.inputs[1]); l.new(transparent.outputs[0],mix.inputs[2]); l.new(mix.outputs[0],out.inputs['Surface'])
        if m.name=='LIV | Interior-m0': H.value(H.principled(m),'Base Color',(.72,.72,.69,1))


def exterior_refinement(scene):
    foliage=next(m for m in bpy.data.materials if m.name=='R2 | Folhagem externa')
    p=H.principled(foliage); H.value(p,'Subsurface Weight',0); H.value(p,'Specular IOR Level',.18)
    variants=[H.leaf_mesh('R3 | Copa variada '+str(i),RNG.randint(730,1100),700+i,foliage) for i in range(12)]
    for o in scene.objects:
        if o.type!='MESH': continue
        if o.get('R2_foliage_replacement'):
            o.data=RNG.choice(variants)
            o.matrix_world=o.matrix_world@Matrix.Rotation(RNG.uniform(-math.pi,math.pi),4,'Z')@Matrix.Diagonal((RNG.uniform(.92,1.03),RNG.uniform(.92,1.03),RNG.uniform(.94,1.03),1))
        if any('site-car-' in m.name for m in o.data.materials if m):
            weld=o.modifiers.new('Solda carro','WELD'); weld.merge_threshold=.0001
            bevel=o.modifiers.new('Bordas carro','BEVEL'); bevel.width=.035; bevel.segments=3; bevel.limit_method='ANGLE'; bevel.angle_limit=math.radians(28)


def pack_images():
    for image in bpy.data.images:
        if image.source!='FILE': continue
        if not image.packed_file:
            path=Path(bpy.path.abspath(image.filepath))
            if not path.exists():
                candidates=[LIB/'materiais'/path.name,ROOT/'fontes/polyhaven/textures'/path.name]
                resolved=next((p for p in candidates if p.exists()),None)
                if resolved: image.filepath=str(resolved)
            image.pack()
        image.use_fake_user=True


def repair_prop_normals():
    repaired=[]
    for mesh in bpy.data.meshes:
        if not mesh.name.startswith('R2 |'): continue
        bm=bmesh.new(); bm.from_mesh(mesh)
        closed=bool(bm.edges) and all(len(e.link_faces)==2 for e in bm.edges)
        if closed and bm.calc_volume(signed=True)<-.000000001:
            bmesh.ops.reverse_faces(bm,faces=list(bm.faces)); bm.to_mesh(mesh); mesh.update(); repaired.append(mesh.name)
        bm.free()
    return repaired


def visible_ray(scene,origin,direction):
    deps=bpy.context.evaluated_depsgraph_get(); start=Vector(origin)
    for _ in range(30):
        result=scene.ray_cast(deps,start,Vector(direction),distance=100)
        if not result[0]: return None
        if not result[4].hide_render: return result
        start=result[1]+Vector(direction)*.002
    return None


def audit(scene):
    update(scene)
    portals=[o for o in scene.objects if o.type=='LIGHT' and not o.hide_render and o.data.type=='AREA' and o.data.cycles.is_portal]
    assert len(portals)<=1,'Portal de amostragem duplicado nesta abertura'
    assert all(o.data.energy==0 for o in portals),'Portal de amostragem deve ter potencia zero'
    lights=[o.name for o in scene.objects if o.type=='LIGHT' and not o.hide_render and o not in portals]
    assert not lights,lights
    emissions=[]
    for o in scene.objects:
        if o.type!='MESH' or o.hide_render: continue
        for m in o.data.materials:
            if not m or not m.use_nodes: continue
            for n in m.node_tree.nodes:
                if n.type=='EMISSION' and n.inputs['Strength'].default_value>0: emissions.append(m.name)
                if n.type=='BSDF_PRINCIPLED' and n.inputs['Emission Strength'].default_value>0 and max(n.inputs['Emission Color'].default_value[:3])>0: emissions.append(m.name)
    assert not emissions,emissions
    sky=scene.world.node_tree.nodes['Daylight sky']
    # Cycles normalizes the public rotation to 2*pi-rotation before the OSL/SVM
    # shader adds pi/2. Verified against official shader_nodes.cpp.
    az=math.pi/2-sky.sun_rotation; el=sky.sun_elevation
    direction=Vector((math.cos(el)*math.cos(az),math.cos(el)*math.sin(az),math.sin(el)))
    deps=bpy.context.evaluated_depsgraph_get()
    samples={'mesa':(2.05,.3,.80),'piso estar':(1.1,-1.8,.06),'parede arte':(.3,-2.98,1.66),'teto':(1.9,-.5,2.69)}
    rays={}
    for label,origin in samples.items():
        start=Vector(origin); hits=[]; visible=False
        for _ in range(20):
            hit,loc,normal,index,obj,_=scene.ray_cast(deps,start,direction,distance=100)
            if not hit: visible=True; break
            if obj.hide_render:
                start=loc+direction*.006
                continue
            glass=False
            if obj.type=='MESH' and index<len(obj.data.polygons):
                mid=obj.data.polygons[index].material_index
                if mid<len(obj.data.materials):
                    m=obj.data.materials[mid]
                    p=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None) if m and m.use_nodes else None
                    glass=bool(p and p.inputs['Transmission Weight'].default_value>.5)
            hits.append({'object':obj.name,'position':[round(x,3) for x in loc],'transparent':glass})
            if not glass: break
            start=loc+direction*.006
        rays[label]={'sun_visible':visible,'hits':hits}
    roof=[]
    for origin in [(1,-2,1.5),(2,-.5,1.5),(2.7,.4,1.5)]:
        result=scene.ray_cast(deps,Vector(origin),Vector((0,0,1)),distance=10)
        assert result[0],('Teto aberto',origin)
        roof.append({'origin':origin,'hit':result[4].name,'height':round(result[1].z,3)})
    sink=visible_ray(scene,(3.75,-.62,1.5),(0,0,-1))
    assert sink and 'Cuba inox' in sink[4].name and sink[1].z<.8,('Cuba fechada',sink[4].name if sink else None,tuple(sink[1]) if sink else None)
    return {'artificial_lights':lights,'emissive_materials':emissions,'sampling_portals':[{'object':o.name,'power_w':o.data.energy,'cycles_is_portal':True,'position':list(o.location),'size_m':[o.data.size,o.data.size_y]} for o in portals],'source':'Sky Texture Multiple Scattering, sun disc included once','sun_elevation_deg':math.degrees(el),'sun_azimuth_deg':math.degrees(az),'sun_direction':list(direction),'rays':rays,'roof':roof,'sink_depth_check':{'hit':sink[4].name,'height':round(sink[1].z,3)}}


def settings(scene,key):
    scene.render.engine='CYCLES'; scene.cycles.device='GPU'; scene.cycles.samples=256 if key in ('estar','jantar') else 160
    scene.cycles.use_denoising=True; scene.cycles.denoiser='OPENIMAGEDENOISE'; scene.cycles.use_adaptive_sampling=True; scene.cycles.adaptive_threshold=.02; scene.cycles.adaptive_min_samples=32
    scene.cycles.max_bounces=10; scene.cycles.diffuse_bounces=6; scene.cycles.transmission_bounces=10
    scene.view_settings.view_transform='AgX'; scene.view_settings.look='AgX - Medium Low Contrast' if key in ('estar','jantar') else 'AgX - Medium High Contrast'
    scene.view_settings.exposure=-2.6 if key=='exterior' else (3.0 if key in ('estar','jantar') else .15)
    scene.render.resolution_percentage=100; scene.render.image_settings.color_depth='16'; scene.render.image_settings.color_mode='RGB'; scene.render.image_settings.file_format='PNG'
    scene.use_fake_user=True; scene.render.filepath='//LIV_'+key+'_dia.png'


def build():
    DELIVERY.mkdir(exist_ok=True); (ROOT/'fontes').mkdir(exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    interior=bpy.data.scenes[SCENES['estar']]; dining=bpy.data.scenes[SCENES['jantar']]; plan=bpy.data.scenes[SCENES['apartamento']]
    update(interior)
    new_furniture(interior,plan); kitchen(interior,plan); plant(interior,plan); artwork(interior)
    close_entry(interior); close_entry(plan)
    # New collections are shared by the two full interior scenes, not their lights.
    for c in interior.collection.children:
        if c.name.startswith('R3 |') and c.name not in dining.collection.children: dining.collection.children.link(c)
    silence_artificial(interior,dining)
    glazing_and_finishes()
    day=daylight_world(interior); dining.world=day
    daylight_sampling_portal(interior,dining)
    daylight_world(bpy.data.scenes[SCENES['exterior']])
    exterior_refinement(bpy.data.scenes[SCENES['exterior']])
    repaired=repair_prop_normals()
    caps=flat_table_caps(interior)
    for key,name in SCENES.items(): settings(bpy.data.scenes[name],key)
    pack_images()
    report=audit(interior)
    report['repaired_closed_prop_normals']=repaired
    report['corrected_table_caps']=caps
    (ROOT/'fontes/origem_da_luz.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
    (ROOT/'fontes/ativos.json').write_text(json.dumps(ASSET_LOG,indent=2,ensure_ascii=False),encoding='utf-8')
    bpy.context.window.scene=interior
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    bpy.ops.wm.open_mainfile(filepath=str(BLEND))
    assert all(name in bpy.data.scenes for name in SCENES.values())
    print('BUILD_OK',json.dumps(report,ensure_ascii=False),flush=True)


def render(args):
    bpy.ops.wm.open_mainfile(filepath=str(BLEND)); H.gpu()
    keys=SCENES if args.shot=='all' else [args.shot]
    output=ROOT/('previas/'+args.round if args.mode=='draft' else 'entrega'); output.mkdir(parents=True,exist_ok=True)
    for key in keys:
        scene=bpy.data.scenes[SCENES[key]]; scene.cycles.device='GPU'
        if args.mode=='draft':
            scene.render.resolution_percentage=args.scale; scene.cycles.samples=args.samples; scene.cycles.adaptive_min_samples=16 if args.samples>32 else 8; scene.cycles.adaptive_threshold=.035 if args.samples>32 else .07; scene.render.image_settings.color_depth='8'
        if args.variant!='dia':
            assert key in ('estar','jantar')
            nodes=scene.world.node_tree.nodes
            if args.variant=='ceu': nodes['Daylight sky'].sun_disc=False
            if args.variant=='apagado': nodes['Daylight strength'].inputs['Strength'].default_value=0
        scene.render.filepath=str(output/('LIV_'+key+'_'+args.variant+'.png'))
        print('RENDER_BEGIN',key,args.variant,flush=True)
        bpy.ops.render.render(write_still=True,scene=scene.name)
        print('RENDER_OK',scene.render.filepath,flush=True)
        if args.variant=='apagado':
            scene.render.image_settings.media_type='IMAGE'; scene.render.image_settings.file_format='OPEN_EXR'; scene.render.image_settings.color_depth='32'
            path=output/('LIV_'+key+'_apagado.exr')
            bpy.data.images['Render Result'].save_render(str(path),scene=scene)
            print('BLACKOUT_EXR_OK',str(path),flush=True)


def finish():
    bpy.ops.wm.open_mainfile(filepath=str(BLEND))
    report={'technical_status':'passed','visual_status':'see_DIARIO','images':[]}
    for key,name in SCENES.items():
        s=bpy.data.scenes[name]; path=DELIVERY/('LIV_'+key+'_dia.png')
        im=bpy.data.images.load(str(path),check_existing=False); assert tuple(im.size)==(s.render.resolution_x,s.render.resolution_y)
        report['images'].append({'file':path.name,'resolution':list(im.size),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}); bpy.data.images.remove(im)
        s.cycles.device='CPU'; s.render.filepath='//'+path.name
    report['lighting']=audit(bpy.data.scenes[SCENES['estar']])
    # Radiance is checked before the display transform and PNG quantization.
    blackout=ROOT/'previas/diagnostico/LIV_estar_apagado.exr'
    im=bpy.data.images.load(str(blackout),check_existing=False)
    pixels=np.empty(len(im.pixels),dtype=np.float32); im.pixels.foreach_get(pixels)
    maximum=float(pixels.reshape(-1,4)[:,:3].max()); bpy.data.images.remove(im)
    assert maximum<.001,('Emissao residual no teste apagado',maximum)
    report['blackout_max_linear_rgb']=maximum
    report['blackout_source']=str(blackout.relative_to(ROOT))
    measured=json.loads((ROOT/'fontes/sol_medido.json').read_text(encoding='utf-8'))['sun']['direction']
    angle=math.degrees(Vector(measured).angle(Vector(report['lighting']['sun_direction'])))
    assert angle<1,('Direcao solar divergente',angle)
    report['sun_direction_error_degrees']=angle
    scene=bpy.data.scenes[SCENES['estar']]; update(scene)
    subjects=[o for o in scene.objects if o.type=='MESH' and not o.hide_render and (o.get('R3_asset')=='Sofa linho' or 'R3 Moldura arte' in o.name)]
    points=[world_to_camera_view(scene,scene.camera,o.matrix_world@Vector(v)) for o in subjects for v in o.bound_box]
    assert points and all(.015<=p.x<=.985 and .015<=p.y<=.985 and p.z>0 for p in points),'Assunto principal cortado'
    report['composition_bounds']={'min':[min(p[i] for p in points) for i in range(2)],'max':[max(p[i] for p in points) for i in range(2)]}
    pack_images(); bpy.context.window.scene=bpy.data.scenes[SCENES['estar']]
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND)); bpy.ops.wm.open_mainfile(filepath=str(BLEND))
    images=[i for i in bpy.data.images if i.source=='FILE']; assert len(images)>=29 and all(i.packed_file for i in images)
    report['packed_textures']=len(images); report['reopened']=True
    interior=bpy.data.scenes[SCENES['estar']]
    table=next(o for o in interior.objects if o.type=='MESH' and 'Tampo carvalho mesa de apoio' in o.name)
    caps=[p for p in table.data.polygons if abs(p.normal.z)>.999 and len(p.vertices)>4]
    assert len(caps)==2 and all(not p.use_smooth for p in caps),'Normais planas do tampo nao persistiram'
    report['persisted_flat_table_caps']=len(caps)
    assert interior.world==bpy.data.scenes[SCENES['jantar']].world,'Interiores com World divergente'
    report['same_world_interior_views']=True
    report['blend_sha256']=hashlib.sha256(BLEND.read_bytes()).hexdigest()
    sums=[row['sha256']+'  '+row['file'] for row in report['images']]
    sums.append(report['blend_sha256']+'  '+BLEND.name)
    (DELIVERY/'SHA256SUMS.txt').write_text('\n'.join(sums)+'\n',encoding='utf-8')
    (DELIVERY/'validacao.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
    print('TECHNICAL_OK',json.dumps(report,ensure_ascii=False),flush=True)


if __name__=='__main__':
    p=argparse.ArgumentParser(); p.add_argument('--mode',choices=['build','draft','final','finish'],default='draft'); p.add_argument('--shot',choices=['all',*SCENES],default='all'); p.add_argument('--round',default='r01'); p.add_argument('--variant',choices=['dia','ceu','apagado'],default='dia'); p.add_argument('--samples',type=int,default=32); p.add_argument('--scale',type=int,default=38)
    a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if a.mode=='build': build()
    elif a.mode=='finish': finish()
    else: render(a)

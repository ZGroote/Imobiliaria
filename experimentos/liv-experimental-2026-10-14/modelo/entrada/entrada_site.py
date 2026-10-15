"""Entrada inferida do render oficial, em eixos locais alinhados à rua.

Volumes estruturais são unidos antes de separar materiais; janelas ocupam vãos
reais. Não altera os arquivos da implantação canônica.
"""
import math

import bpy
from mathutils import Vector

import modelar_implantacao as site
from blender_maquete_base import MATS,material
from unir_paredes import unite

_length=math.hypot(552,96)
T=(552/_length,-96/_length)
IN=(-96/_length,-552/_length)
_v=646
_u=560+(_v-132)*96/552
_x,_z=site.xy(_u,_v)
ORIGIN=(_x+IN[0]*.45,_z+IN[1]*.45)
STATS={'dimensionsAreInferred':True,'streetTangent':T,'inward':IN,'originXZ':ORIGIN,
       'portalClearWidth':4.06,'portalClearHeight':4.06,'guardhouseWindowWidth':2.76,
       'lowCanopyWidth':9.0,'lowCanopyDepth':5.0,'unions':{},'objects':[]}


def point(s,d,h):
    x=ORIGIN[0]+T[0]*s+IN[0]*d
    z=ORIGIN[1]+T[1]*s+IN[1]*d
    return (x,-z,h)


def box(groups,mat,s,d,h,w,depth,height):
    verts,faces=groups.setdefault(mat,([],[]));offset=len(verts)
    for a,b,c in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]:
        # Union close to the local origin. Rotated world coordinates lose
        # precision at small slat/frame intersections in Blender float32 meshes.
        verts.append((s+a*w/2,d+b*depth/2,h+c*height/2))
    faces.extend(tuple(offset+i for i in face) for face in
                 [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])


def emit(label,groups,join=True):
    if join:STATS['unions'][label]=unite(groups,MATS,'entrada-'+label)
    for mat,(verts,faces) in groups.items():
        mesh=bpy.data.meshes.new('entrada-'+label+'-'+mat);mesh.from_pydata([point(*v) for v in verts],[],faces);mesh.update()
        mesh.materials.append(MATS[mat]);layer=mesh.uv_layers.new(name='UVMap')
        for face in mesh.polygons:
            axis=max(range(3),key=lambda i:abs(face.normal[i]))
            for index in face.loop_indices:
                v=mesh.vertices[mesh.loops[index].vertex_index].co
                layer.data[index].uv=((v.y,v.z) if axis==0 else (v.x,v.z) if axis==1 else (v.x,v.y))
        ob=bpy.data.objects.new('GEO-SITE-entrada-'+label+'-'+mat,mesh);bpy.context.scene.collection.objects.link(ob)
        ob['acabamento']=mat;site._tag(ob,'entrada-'+label);STATS['objects'].append(ob.name)


def slab(groups,mat,points,bottom,top):
    from contorno import triangulate
    verts,faces=groups.setdefault(mat,([],[]));base=len(verts);n=len(points)
    verts.extend((s,d,h) for h in [bottom,top] for s,d in points)
    for ids in triangulate(points):
        faces.append(tuple(base+i for i in reversed(ids)));faces.append(tuple(base+n+i for i in ids))
    for i in range(n):j=(i+1)%n;faces.append((base+i,base+j,base+n+j,base+n+i))


def gate(label,left,right,d,height=2.3):
    groups={};mat='entrada-metal';width=right-left
    for z in [.35,1.45,height]:box(groups,mat,(left+right)/2,d,z,width,.055,.055)
    count=max(1,math.ceil(width/.14))
    for i in range(count+1):box(groups,mat,left+i*width/count,d,(.22+height)/2,.032,.045,height-.22)
    emit(label,groups)


def lettering():
    # Legible model lettering, without inventing price/status or a sales identity.
    curve=bpy.data.curves.new('entrada-LIV-IPANEMA','FONT');curve.body='LIV IPANEMA'
    curve.align_x='CENTER';curve.align_y='CENTER';curve.size=.28;curve.extrude=.002;curve.resolution_u=3
    ob=bpy.data.objects.new('GEO-SITE-entrada-letreiro',curve);bpy.context.scene.collection.objects.link(ob)
    curve.materials.append(MATS['entrada-metal']);ob.location=point(2.6,.637,.86)
    # Local font X follows the curb; local Z points out of the lot.
    normal=Vector((-IN[0],IN[1],0));up=Vector((0,0,1))
    from mathutils import Matrix
    ob.rotation_euler=Matrix((Vector((T[0],-T[1],0)),up,normal)).transposed().to_euler()
    bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
    bpy.ops.object.convert(target='MESH');ob=bpy.context.object
    ob['acabamento']='entrada-metal';site._tag(ob,'entrada-letreiro');STATS['objects'].append(ob.name);ob.select_set(False)


def build_entry():
    for name,rgb,rough,metal in [
      ('entrada-carbono',(49,60,57),.83,0),('entrada-reboco',(216,215,200),.88,0),
      ('entrada-metal',(54,65,61),.42,.5),('entrada-vidro',(70,107,99),.22,0)]:
        material(name,rgb,rough,metal)
    # Taller vehicle portal at the left, with a single connected frame/pergola.
    portal={};mat='entrada-carbono'
    for s in [-4.54,-.16]:box(portal,mat,s,.20,2.39,.32,.40,4.38)
    box(portal,mat,-2.35,.20,4.42,4.7,.40,.32)
    for s in [-4.54,-.16]:box(portal,mat,s,4.27,2.225,.24,.24,4.05)
    box(portal,mat,-2.35,4.27,4.25,4.7,.24,.18)
    for i in range(12):box(portal,mat,-2.35,.36+i*(4.27-.36)/11,4.25,4.7,.075,.14)
    emit('portal',portal)
    # The low roof covers the glazed guardhouse and a separate right vehicle lane.
    guard={};wall='entrada-reboco'
    box(guard,mat,4.5,2.5,3.45,9.0,5.0,.30)
    for d in [.20,4.80]:box(guard,mat,8.80,d,1.80,.20,.20,3.20)
    # Two side walls, back wall and front bands. No opaque wall behind glazing.
    for s in [1.16,4.14]:box(guard,wall,s,3.35,1.775,.22,3.06,3.15)
    box(guard,wall,2.65,4.77,1.775,3.20,.22,3.15)
    box(guard,wall,2.65,1.93,.56,3.20,.22,.72)
    box(guard,wall,2.65,1.93,3.0,3.20,.22,.70)
    emit('guarita-marquise',guard)
    pane={};box(pane,'entrada-vidro',2.65,1.93,1.785,2.76,.08,1.73);emit('janela',pane)
    frames={}
    for s in [1.30,2.65,4.0]:box(frames,'entrada-metal',s,1.875,1.785,.045,.09,1.75)
    for h in [.93,2.64]:box(frames,'entrada-metal',2.65,1.875,h,2.78,.09,.045)
    emit('caixilho',frames)
    # Gates remain behind the roof fronts, leaving both approaches legible.
    gate('portao-entrada',-4.15,-.55,2.35)
    gate('portao-saida',4.52,8.52,2.35)
    gate('pedestres',.08,.98,1.9,2.2)
    floor={}
    # Chamfer the back-left corner to stay inside the illustrated lot boundary.
    slab(floor,'site-piso',[(-5.0,-.4),(9.27,-.4),(9.27,5.9),(-4.4,5.9),(-5.0,2.7)],.12,.20)
    emit('piso',floor)
    sign={};box(sign,wall,2.6,.77,.72,2.8,.26,1.04);emit('placa',sign);lettering()
    garden={}
    box(garden,'site-grama',2.5,.94,.215,3.62,1.30,.03)
    emit('jardim',garden)
    for i,(s,d) in enumerate([(1.0,.80),(1.30,1.25),(4.20,1.10),(4.42,.72),(-4.9,1.1),(-4.9,2.3)]):
        x,minus_z,_=point(s,d,0)
        site.sphere('site-folha-escura' if i%2 else 'site-folha-media',x,-minus_z,.58,.42,.38,.40,detail='entrada-arbusto')
    return STATS

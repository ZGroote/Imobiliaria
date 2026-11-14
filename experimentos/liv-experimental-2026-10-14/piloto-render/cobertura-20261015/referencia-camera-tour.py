"""Reproduz no Cycles a câmera inicial observada no navegador, sem alterar a fonte."""
import bpy
import math
import sys
import json
from mathutils import Matrix,Quaternion,Vector

scene=bpy.context.scene
scene.render.resolution_x,scene.render.resolution_y=1265,468
scene.render.resolution_percentage=100
scene.render.pixel_aspect_x=scene.render.pixel_aspect_y=1
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGB'
scene.cycles.samples=128
scene.cycles.use_denoising=True
data=bpy.data.cameras.new('referencia-tour')
data.sensor_fit='HORIZONTAL'; data.sensor_width=36
data.lens=36/(2*math.tan(math.radians(48)/2)*2.702991452991453)
data.dof.use_dof=False; data.clip_start=.05
cam=bpy.data.objects.new('referencia-tour',data)
scene.collection.objects.link(cam); scene.camera=cam
q=Quaternion((.10501673075224097,-.02963032517767816,-.9566784973500052,-.2699255134293759))
to_blender=Matrix.Rotation(math.pi/2,4,'X')
cam.matrix_world=to_blender@q.to_matrix().to_4x4()
cam.location=to_blender@Vector((-1.475,1.62,.7500000000000004))
bpy.context.view_layer.update()
scene.render.filepath='/root/liv-global/referencia-tour.png'
if '--diagnosticar' in sys.argv:
    fx=1265/(2*math.tan(math.radians(48)/2)*2.702991452991453)
    result=[]
    for x,y in ((1100,250),(1120,350),(1050,120)):
        direction=cam.matrix_world.to_3x3()@Vector(((x-632.5)/fx,(234-y)/fx,-1)).normalized()
        hit,point,normal,index,obj,_=scene.ray_cast(bpy.context.evaluated_depsgraph_get(),cam.location,direction)
        row={'pixel':[x,y],'object':obj.name if hit else None}
        if hit and obj.type=='MESH':
            slot=obj.data.polygons[index].material_index
            mat=obj.data.materials[slot] if slot<len(obj.data.materials) else None
            row['material']=mat.name if mat else None
            row['point']=list(point)
            if mat and mat.use_nodes:
                row['nodes']=[{'type':n.type,'name':n.name,'inputs':{i.name:list(i.default_value) if hasattr(i.default_value,'__len__') else i.default_value for i in n.inputs if hasattr(i,'default_value') and i.type in ('RGBA','VALUE')}} for n in mat.node_tree.nodes if n.type in ('BSDF_PRINCIPLED','BSDF_GLASS','BSDF_GLOSSY')]
        result.append(row)
    print('RAIOS-REFERENCIA',json.dumps(result,ensure_ascii=False))
    print('MUNDO-REFERENCIA',json.dumps({'film_transparent':scene.render.film_transparent,'world':scene.world.name if scene.world else None,
      'nodes':[{'type':n.type,'name':n.name,'inputs':{i.name:list(i.default_value) if hasattr(i.default_value,'__len__') else i.default_value for i in n.inputs if hasattr(i,'default_value') and i.type in ('RGBA','VALUE')}} for n in scene.world.node_tree.nodes] if scene.world and scene.world.use_nodes else []},ensure_ascii=False))
else:
    bpy.ops.render.render(write_still=True)

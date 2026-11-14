import bpy,collections
counts=collections.Counter()
for o in bpy.context.scene.objects:
 if o.type!='MESH':continue
 for p in o.data.polygons:
  if p.material_index<len(o.material_slots):
   m=o.material_slots[p.material_index].material
   if m:counts[m.name]+=1
for m in bpy.data.materials:
 if not m.use_nodes:continue
 for p in m.node_tree.nodes:
  if p.type=='BSDF_PRINCIPLED' and p.inputs['Emission Strength'].default_value>0 and (p.inputs['Emission Color'].is_linked or max(p.inputs['Emission Color'].default_value[:3])>0):
   print('EMITTER',m.name,counts[m.name],p.inputs['Emission Strength'].default_value,tuple(p.inputs['Emission Color'].default_value[:3]),p.inputs['Emission Color'].is_linked,flush=True)

import bpy
import bmesh
from pathlib import Path
from mathutils import Vector
import json

ROOT=Path(__file__).resolve().parent
REPO=ROOT.parent.parent
paths={
 'liv':ROOT.parent/'liv-render-revisao-2026-10-26/entrega/LIV_Revisado.blend',
 'sofa':ROOT.parent/'moveis-referencia/sofa/render_r7.blend',
 'jantar':ROOT.parent/'moveis-referencia/jantar/render_r3.blend',
 'geladeira':ROOT.parent/'moveis-referencia/geladeira/render_r6.blend',
 'fogao':ROOT.parent/'moveis-referencia/fogao-4b/render_r10.blend',
}
report={}
for label,path in paths.items():
 bpy.ops.wm.open_mainfile(filepath=str(path))
 if label=='liv': bpy.context.window.scene=bpy.data.scenes['03 | Sala e jantar']
 bpy.context.view_layer.update()
 records=[]
 for o in bpy.context.scene.objects:
  r={'name':o.name,'type':o.type,'props':{k:o[k] for k in o.keys() if k!='_RNA_UI'},'parent':o.parent.name if o.parent else None}
  if o.type=='MESH':
   pts=[o.matrix_world@Vector(v) for v in o.bound_box]
   r.update({'min':[round(min(p[i] for p in pts),4) for i in range(3)],'max':[round(max(p[i] for p in pts),4) for i in range(3)],'verts':len(o.data.vertices),'mats':[m.name for m in o.data.materials if m]})
  if o.type=='LIGHT': r.update({'kind':o.data.type,'power':o.data.energy,'position':list(o.location)})
  records.append(r)
 report[label]=records
 if label=='liv':
  # Inspect the separate connected parts of the generic door mesh.
  o=next(o for o in bpy.context.scene.objects if o.get('LIV_source_slot')==3)
  bm=bmesh.new(); bm.from_mesh(o.data); bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001)
  seen=set(); pieces=[]
  for v in bm.verts:
   if v in seen: continue
   group={v}; stack=[v]; seen.add(v)
   while stack:
    cur=stack.pop()
    for e in cur.link_edges:
     nxt=e.other_vert(cur)
     if nxt not in seen: seen.add(nxt); group.add(nxt); stack.append(nxt)
   ps=[o.matrix_world@v.co for v in group]
   lo=[min(p[i] for p in ps) for i in range(3)]; hi=[max(p[i] for p in ps) for i in range(3)]
   if hi[2]-lo[2]>.8: pieces.append({'min':lo,'max':hi,'vertices':len(group)})
  bm.free(); report['door_parts']=pieces
(ROOT/'fontes').mkdir(exist_ok=True)
(ROOT/'fontes/inventario.json').write_text(json.dumps(report,indent=2,ensure_ascii=False,default=str),encoding='utf-8')
print('INVENTORY_OK',{k:len(v) for k,v in report.items()},flush=True)

"""Orient architectural surface normals away from wall solids before baking."""
import json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
H=Path(__file__).resolve().parent;O=H/'piloto-v3';p=O/'source.json';d=json.loads(p.read_text())
backup=O/'source-before-normal-repair.json'
if not backup.exists():backup.write_text(p.read_text())
else:d=json.loads(backup.read_text())
g=d['geometries'][d['objects'][0]['geometry']];verts=[Vector(g['position'][i:i+3]) for i in range(0,len(g['position']),3)]
ix=g['index'] or list(range(len(verts)));faces=[ix[i:i+3] for i in range(0,len(ix),3)]
bvh=BVHTree.FromPolygons(verts,faces,all_triangles=True);flipped=0
for face in faces:
 n=Vector(g['normal'][face[0]*3:face[0]*3+3]);c=sum((verts[i] for i in face),Vector())/3
 if n.length<.9:continue
 dp=bvh.ray_cast(c+n*.001,n,.35)[3];dm=bvh.ray_cast(c-n*.001,-n,.35)[3]
 dp=dp if dp is not None else 10;dm=dm if dm is not None else 10
 if dp+.01<dm:
  for vi in face:
   for j in range(3):g['normal'][vi*3+j]*=-1
  flipped+=1
# Coplanar wall tessellation must keep a consistent outward direction. Trim
# intersections can fool a short ray on isolated triangles near the edges.
from collections import defaultdict
planes=defaultdict(list)
for face in faces:
 n=Vector(g['normal'][face[0]*3:face[0]*3+3]);axis=max(range(3),key=lambda j:abs(n[j]))
 plane=round(sum(verts[i][axis] for i in face)/3,4)
 area=(verts[face[1]]-verts[face[0]]).cross(verts[face[2]]-verts[face[0]]).length/2
 planes[(axis,plane)].append((face,n[axis],area))
consistent=0
for (axis,plane),items in planes.items():
 vote=sum(sign*area for _,sign,area in items);total=sum(area for _,_,area in items)
 if total==0 or abs(vote)/total<.5:continue
 direction=1 if vote>0 else -1
 for face,sign,area in items:
  if sign*direction<0:
   for vi in face:
    for j in range(3):g['normal'][vi*3+j]*=-1
   consistent+=1
print('Coplanar corrections',consistent,flush=True)
p.write_text(json.dumps(d,separators=(',',':')))
(O/'normal-repair.json').write_text(json.dumps({'architecturalTrianglesReoriented':flipped,'coplanarCorrections':consistent,'total':len(faces),'method':'Compare empty space on each side using ray intersections with the wall mesh; do not move vertices.'},indent=2))
print('Corrected',flipped,'of',len(faces),'architectural triangles',flush=True)

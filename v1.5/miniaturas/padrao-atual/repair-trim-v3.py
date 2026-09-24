"""Remove coplanar overlaps in collinear molding runs, keeping their union."""
from pathlib import Path
from collections import defaultdict
import json
import numpy as np
H=Path(__file__).resolve().parent;O=H/'piloto-v3';p=O/'source.json'
d=json.loads(p.read_text());groups=defaultdict(list);changed=[]
for i,r in enumerate(d['objects']):
 if r['name']!='rodateto':continue
 a=np.array(r['matrix']).reshape(4,4).T;axis=int(np.argmax(abs(a[:3,2])));length=np.linalg.norm(a[:3,2]);other=2 if axis==0 else 0
 groups[(axis,round(a[other,3],4),round(a[1,3],4))].append([i,a[axis,3]-length/2,a[axis,3]+length/2,a])
for (axis,_,_),items in groups.items():
 items.sort(key=lambda x:x[1])
 for left,right in zip(items,items[1:]):
  if left[2]>right[1]+1e-5:
   boundary=(left[2]+right[1])/2;left[2]=boundary;right[1]=boundary
 for i,start,end,a in items:
  old=a.copy();a[axis,3]=(start+end)/2;a[:3,2]*=(end-start)/np.linalg.norm(a[:3,2])
  if not np.allclose(old,a):
   d['objects'][i]['matrix']=a.T.reshape(-1).tolist();changed.append(i)
p.write_text(json.dumps(d,separators=(',',':')))
print('Updated molding transforms:',len(changed),'; rerun unwrap, bake, denoise and build.')

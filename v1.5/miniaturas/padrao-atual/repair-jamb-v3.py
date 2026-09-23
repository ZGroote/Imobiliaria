"""Trim vertical door posts at header underside; preserve face/vertex ordering."""
from pathlib import Path
import json
import numpy as np
p=Path(__file__).resolve().parent/'piloto-v3/source.json'
d=json.loads(p.read_text());obj=next(o for o in d['objects'] if o['slot']==3);g=d['geometries'][obj['geometry']]
a=np.array(g['position']).reshape(-1,3)
assert len(a)==1224 and not g['index'], 'Door frame source topology changed'
changed=0
for header in [2,5,8,13,16,19,22,25,28]:
 bottom=a[header*36:(header+1)*36,1].min()
 for post in [header-2,header-1]:
  block=a[post*36:(post+1)*36];top=block[:,1].max()
  assert block[:,1].min()<bottom and top>=bottom-1e-6
  if top>bottom+1e-6:
   block[np.isclose(block[:,1],top),1]=bottom;changed+=1
g['position']=a.reshape(-1).tolist();g['correctedPosition']=True
p.write_text(json.dumps(d,separators=(',',':')))
print('Jamb posts trimmed:',changed)

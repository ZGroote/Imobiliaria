"""Global non-overlapping UV atlas without Blender edit-mode conversion."""
from pathlib import Path
import json,time
import numpy as np
import xatlas
H=Path(__file__).resolve().parent;O=H/'piloto-v3';d=json.loads((O/'source.json').read_text())
atlas=xatlas.Atlas();records=[];t=time.perf_counter()
for oi,o in enumerate(d['objects']):
 if o['name']=='plafon' or any(d['materials'][m]['opacity']<.5 for m in o['materials']):continue
 g=d['geometries'][o['geometry']];p=np.array(g['position'],dtype=np.float32).reshape(-1,3);n=np.array(g['normal'],dtype=np.float32).reshape(-1,3)
 ix=np.array(g['index'] or list(range(len(p))),dtype=np.uint32).reshape(-1,3)
 flip=np.sum(np.cross(p[ix[:,1]]-p[ix[:,0]],p[ix[:,2]]-p[ix[:,0]])*n[ix[:,0]],axis=1)<0;ix[flip]=ix[flip][:,[0,2,1]]
 # Weld coincident input vertices for chart topology; mapping is retained per corner.
 _,first,inverse=np.unique(np.round(p,6),axis=0,return_index=True,return_inverse=True)
 a=np.array(o['matrix']).reshape(4,4).T;pw=(np.c_[p[first],np.ones(len(first))]@a.T)[:,:3]
 atlas.add_mesh(np.asarray(pw,dtype=np.float32),np.asarray(inverse[ix],dtype=np.uint32))
 records.append((oi,o,g,ix,inverse,first,p))
print('UNWRAP',len(records),'meshes',flush=True)
pack=xatlas.PackOptions();pack.resolution=2048;pack.padding=8;pack.bilinear=True
charts=xatlas.ChartOptions();charts.max_iterations=2
atlas.generate(chart_options=charts,pack_options=pack)
uvs={};compact=[]
for i,(oi,o,g,ix,inverse,first,p) in enumerate(records):
 mapping,tri,uv=atlas[i]
 assert np.allclose(p[first][mapping[tri]],p[ix],atol=2e-6),'Xatlas changed face ordering'
 uvflat=uv[tri].reshape(-1,2);uvs[str(oi)]=uvflat.tolist()
 groups=g['groups'] or [{'start':0,'count':int(ix.size),'materialIndex':0}]
 compact.append({'slot':o['slot'],'instance':o['instance'],'uv1':np.round(uvflat.reshape(-1),7).tolist(),'indices':ix.reshape(-1).tolist(),'groups':groups,'sourceVertexCount':len(p),**({'correctedPosition':g['position']} if g.get('correctedPosition') else {}),**({'correctedWorldMatrix':o['matrix']} if o['name']=='rodateto' else {})})
assert atlas.atlas_count==1,atlas.atlas_count
(O/'uv.json').write_text(json.dumps(uvs,separators=(',',':')))
(O/'geometry-compact.json').write_text(json.dumps(compact,separators=(',',':')))
(O/'unwrap.json').write_text(json.dumps({'seconds':time.perf_counter()-t,'width':atlas.width,'height':atlas.height,'utilization':atlas.utilization,'meshes':len(records),'atlasCount':atlas.atlas_count},indent=2))
print('UNWRAP COMPLETE',time.perf_counter()-t,atlas.width,atlas.height,atlas.utilization,flush=True)

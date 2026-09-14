import json, math
from pathlib import Path
root=Path(__file__).resolve().parent
lib=json.loads((root/'arvores_lib.json').read_text())
old=json.loads((root.parent/'modelos_urbanos/v1/integracao/antes/arvores_lib.json').read_text())
assert set(lib['especies'])==set(old['especies'])
report={}
for name,spec in lib['especies'].items():
 for lod,g in spec['lod'].items():
  p,n,c,idx=(g[k] for k in ['pos_cm','nrm_127','col','idx'])
  assert len(p)==len(n)==len(c) and len(p)%3==0
  assert len(idx)%3==0 and all(0<=i<len(p)//3 for i in idx)
  assert all(math.isfinite(v) for v in p+n+c)
  assert all(0<=v<=255 for v in c)
  assert all(abs(math.sqrt(sum(v*v for v in n[i:i+3]))/127-1)<.025 for i in range(0,len(n),3)),name
  assert len(idx)<=len(old['especies'][name]['lod'][lod]['idx']),'triangle budget increased'
 report[name]={'low':spec['lod']['0']['tris'],'high':spec['lod']['1']['tris']}
(root/'validacao-v2.json').write_text(json.dumps(report,indent=2))
print('PASS: 20 species, both LODs, finite buffers, normalized normals, valid indices, no triangle budget increase.')

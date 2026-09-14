"""Export the authored amenities separately, without miniature parcel bases."""
import importlib.util,json,sys,hashlib
from pathlib import Path
import bpy
OUT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('yard_library',OUT/'gerar.py')
G=importlib.util.module_from_spec(spec);spec.loader.exec_module(G)
G.U.setup();assets=[];layouts=[];shared={}
for i,(name,w,d,surface,*kinds) in enumerate(G.YARDS):
    parts=[]
    for slot,kind in enumerate(kinds):
        m=G.Mesh();G.detail(m,kind,0,0,w/2-.2,d/2-.2)
        cx=(min(v[0] for v in m.v)+max(v[0] for v in m.v))/2
        cy=(min(v[1] for v in m.v)+max(v[1] for v in m.v))/2
        m.v=[(x-cx,y-cy,z) for x,y,z in m.v]
        obj=m.make(f'GEO-quintal-{i+1:02}-{kind}-{slot}');bpy.context.view_layer.update()
        a=G.pack_mesh(obj,f'quintal-{i+1:02}-{slot}','componentes',kind)
        digest=hashlib.sha256(''.join(a[k] for k in ('p','n','c','i')).encode()).hexdigest()
        a['shared']=shared.setdefault(digest,65+len(assets))
        parts.append(len(assets));assets.append(a)
        obj.asset_mark();obj['tipo_quintal']=name;obj['escala_metros']=True
        obj.location=(i%8*8+slot%2*3,i//8*10+slot//2*4,0)
    layouts.append(dict(name=name,surface=surface,parts=parts,kinds=kinds))
(OUT/'componentes.json').write_text(json.dumps(dict(assets=assets,layouts=layouts),separators=(',',':')))
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'componentes_quintais.blend'))
print('COMPONENTS',len(assets),flush=True)

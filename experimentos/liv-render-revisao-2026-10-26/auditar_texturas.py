import bpy
from pathlib import Path
import json

root=Path(__file__).resolve().parent
files={'baseline':root.parent/'liv-render-blender-2026-10-26/entrega/LIV_Ipanema_Render.blend','revisao':root/'entrega/LIV_Revisado.blend'}
data={}
for key,path in files.items():
    bpy.ops.wm.open_mainfile(filepath=str(path))
    data[key]=[{'name':i.name,'packed':bool(i.packed_file),'users':i.users,'fake_user':i.use_fake_user} for i in bpy.data.images if i.source=='FILE']
(root/'fontes/texturas_auditadas.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
before={i['name'] for i in data['baseline']}; after={i['name'] for i in data['revisao']}
print('TEXTURE_AUDIT',json.dumps({'counts':{k:len(v) for k,v in data.items()},'missing':sorted(before-after),'unpacked':[i['name'] for i in data['revisao'] if not i['packed']]}),flush=True)

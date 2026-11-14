"""Aquisição rastreável de um ativo CC0 pela API pública do Poly Haven."""
from pathlib import Path
import json
import urllib.request
import sys
import hashlib
from pathlib import PurePosixPath

ROOT=Path(__file__).resolve().parent
UA='Conecta-LIV-Render/1.0 (local Blender scene authoring)'
def get(url):
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':UA}),timeout=90) as r: return r.read()

folder=ROOT/'fontes/polyhaven'; folder.mkdir(parents=True,exist_ok=True)
cache=folder/'files.json'
data=json.loads(cache.read_text(encoding='utf-8')) if cache.exists() else json.loads(get('https://api.polyhaven.com/files/potted_plant_01'))
(folder/'files.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
entry=data['blend']['1k']['blend']
entries={'potted_plant_01_1k.blend':entry,**entry['include']}
records=[]
for name,record in entries.items():
 relative=PurePosixPath(name)
 assert not relative.is_absolute() and '..' not in relative.parts
 target=folder.joinpath(*relative.parts); target.parent.mkdir(parents=True,exist_ok=True)
 blob=target.read_bytes() if target.exists() else get(record['url'])
 assert len(blob)==record['size'] and hashlib.md5(blob).hexdigest()==record['md5'],name
 if not target.exists(): target.write_bytes(blob)
 records.append({'path':name,'url':record['url'],'sha256':hashlib.sha256(blob).hexdigest(),'bytes':len(blob)})
 print('ASSET_FILE',name,len(blob),flush=True)
manifest={'asset':'Potted Plant 01','author':'Rico Cilliers','source':'https://polyhaven.com/a/potted_plant_01','license':'CC0','credit':'Powered by Poly Haven','files':records}
(folder/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')

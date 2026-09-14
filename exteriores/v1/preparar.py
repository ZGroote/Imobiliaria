"""Prepare one immutable Hosting asset. Deployment is a separate explicit command."""
import json,hashlib,re
from pathlib import Path
root=Path(__file__).resolve().parents[2];out=Path(__file__).resolve().parent
content=(root/'v16-moveis/sao-carlos-v16-moveis.html').read_text(encoding='utf-8-sig')
content,n=re.subn(r'<title>[^<]*</title>','<title>São Carlos 3D</title>',content,count=1);assert n==1
payload=content.encode('utf-8');digest=hashlib.sha256(payload).hexdigest();name=f'sao-carlos-exteriores-{digest[:12]}.html'
pub=root/'v16-moveis/publicado';(pub/'mapa').mkdir(exist_ok=True)
if not (out/'index-local-anterior.html').exists():(out/'index-local-anterior.html').write_bytes((pub/'index.html').read_bytes())
(pub/'mapa'/name).write_bytes(payload)
url='/mapa/'+name
(pub/'index.html').write_text('<!doctype html><meta charset="utf-8"><title>São Carlos 3D</title><meta name="viewport" content="width=device-width,initial-scale=1">'+f'<meta http-equiv="refresh" content="0;url={url}"><script>location.replace({json.dumps(url)})</script><a href="{url}">Abrir mapa</a>',encoding='utf-8')
data=dict(name=name,sha256=digest,bytes=len(payload),localUrl='/v16-moveis/publicado'+url,liveUrl='https://imobilaria-deccb.web.app'+url)
(out/'build.json').write_text(json.dumps(data,indent=2))
# Existing mobile flow test follows the exact same final artifact.
(root/'relatorios/mobile/build.json').write_text(json.dumps({'url':data['localUrl'],'bytes':len(payload),'deployed':False},indent=2))
print(json.dumps(data))

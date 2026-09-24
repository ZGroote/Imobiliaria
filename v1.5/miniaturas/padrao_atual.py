"""Padrão aprovado do Cedros: montagem determinística, sem depender de experimentos."""
from pathlib import Path
import base64,hashlib,json,re,shutil
ROOT=Path(__file__).resolve().parent
SOURCE=ROOT/'padrao-atual'
UID='monte-dos-cedros-37'
ASSETS={'interior-uv.json':'piloto-v3/geometry-compact.json','interior-luz.rgbm.gz':'piloto-v3/lightmap.rgbm.gz',
        'exterior-uv.json':'exterior-v3/geometry-compact.json','exterior-luz.rgbm.gz':'exterior-v3/lightmap.rgbm.gz',
        'miniatura.webp':'renders/v3/miniatura.webp','planta3d.webp':'renders/v3/planta3d.webp'}
def source_manifest():
 paths=['anterior/v2.html','lightmap-v3.js','exterior-v3.js','interruptores.js',*ASSETS.values()]
 hashes={p:hashlib.sha256((SOURCE/p).read_bytes()).hexdigest() for p in paths}
 release=hashlib.sha256(json.dumps(hashes,sort_keys=True).encode()).hexdigest()[:16]
 return {'standard':'cedros-luz-calculada-2026-09-23','release':release,'sources':hashes}
def render(offline=True,map_href=None):
 manifest=source_manifest();prefix=f'assets/cedros/{manifest["release"]}/'
 page=(SOURCE/'anterior/v2.html').read_text(encoding='utf8')
 hooks=(SOURCE/'lightmap-v3.js').read_text(encoding='utf8')+'\n'+(SOURCE/'interruptores.js').read_text(encoding='utf8')+'\n'+(SOURCE/'exterior-v3.js').read_text(encoding='utf8')
 page=page.replace('window.__maq = {',hooks+'\nwindow.__maq = {',1)
 blocks=[]
 for tag,kind,folder in [('v3-data','interior','piloto-v3'),('exterior-data','exterior','exterior-v3')]:
  data={'range':16}
  if offline:
   data.update(geometry=json.loads((SOURCE/folder/'geometry-compact.json').read_text()),texture='data:application/gzip;base64,'+base64.b64encode((SOURCE/folder/'lightmap.rgbm.gz').read_bytes()).decode())
  else:data.update(geometryURL=prefix+kind+'-uv.json',texture=prefix+kind+'-luz.rgbm.gz')
  blocks.append(f'<script id="{tag}" type="application/json">'+json.dumps(data,separators=(',',':'))+'</script>')
 page=page.replace('<script id="__imovel"','\n'.join(blocks)+'\n<script id="__imovel"',1)
 page=re.sub(r'<title>.*?</title>','<title>Monte dos Cedros · maquete, planta e visita 3D</title>',page,count=1)
 # The archived pilot had a relative map link that does not exist on this site.
 from html import escape
 href=map_href or 'https://imobilaria-deccb.web.app/'
 page=re.sub(r'(<a\b[^>]*\bid="verMapa"[^>]*\bhref=")[^"]*',lambda m:m[1]+escape(href,quote=True),page)
 page=page.replace('</head>',f'<meta name="maquete-release" content="{manifest["release"]}"></head>',1)
 assert page.count('id="v3-data"')==1 and page.count('id="exterior-data"')==1
 return page
def publish(out):
 out=Path(out);out.mkdir(parents=True,exist_ok=True);manifest=source_manifest();prefix=Path('assets/cedros')/manifest['release'];files=[]
 for name,source in ASSETS.items():
  dest=out/prefix/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(SOURCE/source,dest);files.append(str(prefix/name).replace('\\','/'))
 for name,offline in [(f'maquete-{UID}.html',False),(f'maquete-{UID}-offline.html',True)]:
  (out/name).write_text(render(offline),encoding='utf8');files.append(name)
 manifest['files']=files
 (SOURCE/'release.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
 return manifest

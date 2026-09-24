"""Lista pública explícita; Cedros aprovado e demais modelos preservados."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import hashlib,json,shutil
from padrao_atual import publish,SOURCE
ROOT=Path(__file__).resolve().parent;OUT=ROOT/'publicado-atual'
manifest=publish(OUT);files=set(manifest['files'])
legacy=['maquete-monte-das-colinas-39.html','maquete-wish-castanheiras-58.html']
for folder,name,preview in [('monte-dos-cedros_blender','monte-dos-cedros','detalhe.png'),('monte-das-colinas_blender','monte-das-colinas','detalhe.png'),('castanheiras_blender','castanheiras','preview.png')]:
 legacy.extend(f'{folder}/{name}.{ext}' for ext in ['blend','glb']);legacy.append(f'{folder}/{preview}')
for rel in legacy:
 dest=OUT/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/rel,dest);files.add(rel)
gallery=(ROOT/'index.html').read_text(encoding='utf8').replace('miniatura-cedros.webp',f'assets/cedros/{manifest["release"]}/miniatura.webp')
(OUT/'index.html').write_text(gallery,encoding='utf8');files.add('index.html')
class Links(HTMLParser):
 def handle_starttag(self,tag,attrs):
  for key,value in attrs:
   if key not in ('href','src') or not value or value.startswith(('data:','#','http')):continue
   path=unquote(urlsplit(value).path)
   assert path in files, f'Link não publicado: {value}'
for rel in files:
 if rel.endswith('.html'):
  page=(OUT/rel).read_text(encoding='utf8');assert '@@' not in page;Links().feed(page)
record=SOURCE/'publication-files.json'
if record.exists():
 for rel in set(json.loads(record.read_text()))-files:
  target=(OUT/rel).resolve();assert target.is_relative_to(OUT.resolve())
  if target.is_file():target.unlink()
actual={p.relative_to(OUT).as_posix() for p in OUT.rglob('*') if p.is_file()}
assert actual==files,'Unexpected publication files: '+str(actual-files)
record.write_text(json.dumps(sorted(files),indent=2))
checks={rel:hashlib.sha256((OUT/rel).read_bytes()).hexdigest() for rel in sorted(files)}
(SOURCE/'publication-hashes.json').write_text(json.dumps(checks,indent=2))
print(f'Release {manifest["release"]}: {len(files)} arquivos, {sum((OUT/f).stat().st_size for f in files)/1e6:.2f} MB; links conferidos')

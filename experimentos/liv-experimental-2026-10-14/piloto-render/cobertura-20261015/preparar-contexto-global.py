"""Combina o piloto novo com capturas anteriores dos demais cômodos, sem misturar lentes."""
from collections import defaultdict
import copy
import hashlib
import json
import math
from pathlib import Path
import sys
import tarfile

base = Path(__file__).resolve().parent
sys.path.insert(0, str(base.parent))
import planta
old = base.parent/'nuvem/captura-apto'
new = base/'piloto-2h/dataset'
out = base/'global-contexto'
out.mkdir(exist_ok=True)
unit = planta.carregar(str(base.parent.parent/'interiores/meio/unidade.json'))
meta = json.loads((new/'transforms.json').read_text(encoding='utf-8'))
original = json.loads((old/'transforms.json').read_text(encoding='utf-8'))
intrinsics = ('w','h','fl_x','fl_y','cx','cy','k1','k2','p1','p2')
frames = []
for f in meta['frames']:
    f = copy.deepcopy(f)
    for key in intrinsics: f[key] = meta.get(key,0)
    frames.append(f)
groups = defaultdict(dict)
extras = []
for f in original['frames']:
    m = f['transform_matrix']
    room = (unit.comodo((m[0][3],m[1][3])) or {}).get('nome')
    if not room or room in ('Sala integrada','Varanda / serviço'): continue
    f = copy.deepcopy(f)
    old_name = f['file_path']
    f['file_path'] = 'images/contexto-'+Path(old_name).name
    f['comodo'] = room
    f['pitch'] = math.degrees(math.asin(max(-1,min(1,-m[2][2]))))
    for key in intrinsics: f[key] = original.get(key,0)
    position = tuple(round(m[k][3],5) for k in range(3))
    groups[room].setdefault(position, []).append(f['file_path'])
    extras.append((old_name,f))
    frames.append(f)
train = list(meta['train_filenames'])
val = list(meta['val_filenames'])
for room, positions in groups.items():
    for i, (_, names) in enumerate(sorted(positions.items())):
        (val if i % 10 == 0 else train).extend(names)
data = {k:v for k,v in meta.items() if k not in intrinsics}
data.update(frames=sorted(frames,key=lambda f:f['file_path']),train_filenames=train,val_filenames=val,test_filenames=val)
(out/'transforms.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
checks = []
for room in groups:
    pair = next((x for x in extras if x[1]['comodo'] == room),None)
    if pair:
        name,f = pair
        checks.append({'reference':f['file_path'],'frame':f})
        if len(checks) == 2: break
(out/'comparacao.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf-8')
archive = out/'contexto.tgz'
with tarfile.open(archive,'w:gz',compresslevel=1) as tar:
    tar.add(out/'transforms.json',arcname='dataset/transforms.json')
    tar.add(out/'comparacao.json',arcname='comparacao.json')
    tar.add(old/'pontos.ply',arcname='dataset/pontos.ply')
    for name,f in extras: tar.add(old/name,arcname='dataset/'+f['file_path'])
report = {'frames':len(frames),'train':len(train),'val':len(val),'new':len(meta['frames']),
          'context':len(extras),'rooms':{k:sum(map(len,v.values())) for k,v in groups.items()},
          'archive_sha256':hashlib.file_digest(archive.open('rb'),'sha256').hexdigest(),
          'status':'Capturas antigas: comparar duas vistas com a cena atual antes de treinar.'}
(out/'preparacao.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))

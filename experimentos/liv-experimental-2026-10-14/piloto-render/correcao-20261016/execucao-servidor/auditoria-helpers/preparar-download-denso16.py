from pathlib import Path
import json,time,datetime,hashlib,tarfile,zipfile,traceback,re,unicodedata
from PIL import Image,ImageDraw
import torch
root=Path('/root/liv-corrigido-20261016')
limit=datetime.datetime(2026,10,17,7,35,tzinfo=datetime.timezone.utc).timestamp()
def digest(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for block in iter(lambda:f.read(8*1024*1024),b''): h.update(block)
 return h.hexdigest()
def package(name,paths):
 target=root/(name+'.tgz'); temp=root/(name+'.partial.tgz')
 with tarfile.open(temp,'w:gz',compresslevel=1) as tar:
  for p in paths: tar.add(p,arcname=p.relative_to(root))
 temp.replace(target)
 data={'bytes':target.stat().st_size,'sha256':digest(target),'download_authorized':True,'visual_review':'pending'}
 (root/(name+'.json')).write_text(json.dumps(data,indent=2))
 print('PACKAGE_READY',name,data['bytes'],flush=True)
try:
 while not (root/'denso16-concluido').exists():
  if (root/'falha-denso16.txt').exists(): raise RuntimeError('Dense pipeline failed; inspect its logs')
  if time.time()>limit: raise TimeoutError('Rental reserve deadline reached')
  time.sleep(20)
 cp=sorted((root/'treino-denso16').glob('**/step-*.ckpt'))[-1]
 state=torch.load(cp,map_location='cpu',weights_only=False)
 values={k:{'shape':list(v.shape),'finite':bool(torch.isfinite(v).all())} for k,v in state['pipeline'].items() if torch.is_tensor(v) and 'gauss_params' in k}
 assert values and all(v['finite'] for v in values.values())
 sog=root/'resultado-denso16/apartamento-denso16.sog'
 with zipfile.ZipFile(sog) as z:
  assert z.testzip() is None
  meta=json.loads(z.read('meta.json')); assert meta['count']>1000
 (root/'resultado-denso16/validacao-numerica.json').write_text(json.dumps({'checkpoint':str(cp),'parameters':values,'sog_count':meta['count'],'sog_sha256':digest(sog),'visual_review':'pending'},indent=2))
 reports={label:json.loads((root/folder/'analise-ambientes/metricas-por-ambiente.json').read_text()) for label,folder in [('30k','resultado'),('60k','resultado-refino60k'),('denso16','resultado-denso16')]}
 summary={label:{'global':json.loads((root/folder/'eval.json').read_text())['results'],'rooms':reports[label]['rooms'],'room_pitch':reports[label]['room_pitch']} for label,folder in [('30k','resultado'),('60k','resultado-refino60k'),('denso16','resultado-denso16')]}
 (root/'comparacao-tres-rodadas.json').write_text(json.dumps({'results':summary,'visual_review':'pending','held_out_views':377},ensure_ascii=False,indent=2))
 out=root/'comparacao-visual-denso16'; out.mkdir(exist_ok=True)
 ref={v['file']:v for v in reports['60k']['views']}; new={v['file']:v for v in reports['denso16']['views']}
 for room in reports['30k']['rooms']:
  canvas=Image.new('RGB',(1920,1170),(240,240,240)); draw=ImageDraw.Draw(canvas)
  for row,pitch in enumerate([-60,0,60]):
   group=sorted([v for v in reports['30k']['views'] if v['comodo']==room and v['pitch']==pitch],key=lambda v:v['psnr'])
   v=group[len(group)//2]; a=Image.open(root/ref[v['file']]['eval_file']).convert('RGB'); b=Image.open(root/new[v['file']]['eval_file']).convert('RGB')
   assert a.size==b.size
   w,h=a.size; half=w//2
   parts=[a.crop((0,0,half,h)),a.crop((half,0,w,h)),b.crop((half,0,w,h))]
   for col,(part,label) in enumerate(zip(parts,['Referencia','60 mil anterior','Novas posicoes'])):
    draw.text((col*640+8,row*390+7),f"{room} | {pitch} | {v['file']} | {label}",fill=(0,0,0))
    canvas.paste(part.resize((640,360)),(col*640,row*390+30))
  slug=re.sub(r'[^a-z0-9]+','-',unicodedata.normalize('NFKD',room).encode('ascii','ignore').decode().lower()).strip('-')
  canvas.save(out/(slug+'.jpg'),quality=94)
 preview=[sog,root/'resultado-denso16/eval.json',root/'resultado-denso16/validacao-numerica.json',root/'resultado-denso16/analise-ambientes/metricas-por-ambiente.json',root/'comparacao-tres-rodadas.json',root/'densificacao-plano-16rumos.json']+list(out.glob('*.jpg'))
 package('denso16-preview',preview)
 package('denso16-modelo',[root/'resultado-denso16/splat.ply',cp,cp.parent.parent/'config.yml',root/'dataset-denso/plano-captura.json',root/'dataset-denso/transforms.json',root/'dataset-denso/pontos.ply',root/'dataset-denso/seed-limpeza.json',root/'estado-execucao.json'])
except Exception:
 text=traceback.format_exc(); (root/'falha-download-denso16.txt').write_text(text); print(text,flush=True); raise


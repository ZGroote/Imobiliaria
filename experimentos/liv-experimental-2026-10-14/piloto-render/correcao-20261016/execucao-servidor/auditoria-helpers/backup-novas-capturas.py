from pathlib import Path
import time,json,datetime,tarfile,hashlib,traceback,os
root=Path('/root/liv-corrigido-20261016')
limit=datetime.datetime(2026,10,17,7,25,tzinfo=datetime.timezone.utc).timestamp()
def wait(marker,failure):
 while not (root/marker).exists():
  if (root/failure).exists(): raise RuntimeError((root/failure).read_text())
  if time.time()>limit: raise TimeoutError('Download reserve reached')
  time.sleep(20)
def package(name,paths):
 target=root/(name+'.tgz'); temp=root/(name+'.partial.tgz')
 with tarfile.open(temp,'w:gz',compresslevel=1) as tar:
  for p in paths: tar.add(p,arcname=p.relative_to(root),recursive=False)
 temp.replace(target)
 h=hashlib.sha256()
 with target.open('rb') as f:
  for block in iter(lambda:f.read(8388608),b''): h.update(block)
 (root/(name+'.json')).write_text(json.dumps({'bytes':target.stat().st_size,'sha256':h.hexdigest(),'base_backup':'entrega-servidor.tgz','download_authorized':True},indent=2))
 print('PACKAGE_READY',name,target.stat().st_size,flush=True)
try:
 os.nice(10)
 wait('denso16-render-completo','falha-denso16.txt')
 dataset=root/'dataset-denso'
 images=sorted((dataset/'images').glob('n*.png'))
 assert len(images)==2225
 files=[dataset/x for x in ['plano-captura.json','transforms.json','pontos.ply','seed-limpeza.json']]
 files+=list(root.glob('*.py'))+[root/'densificacao-plano-16rumos.json',root/'poligonos-comodos.json',root/'proveniencia-seed.tgz']
 package('denso16-capturas',files+images)
 wait('ensaios-comodos/concluido','ensaios-comodos/falha.txt')
 files=[root/'ensaios-comodos/manifesto.json']
 result=root/'ensaios-comodos/resultados.json'
 if result.exists(): files.append(result)
 for item in json.loads((root/'ensaios-comodos/manifesto.json').read_text()):
  p=Path(item['directory'])
  files+=list((p/'dataset').glob('*.json'))
  files+=list((p/'treino').glob('**/config.yml'))
  checkpoints=sorted((p/'treino').glob('**/step-*.ckpt'))
  if checkpoints: files.append(checkpoints[-1])
  for name in ['resultado/eval.json','resultado/analise-ambientes/metricas-por-ambiente.json','falha.txt']:
   if (p/name).exists(): files.append(p/name)
 package('ensaios-comodos-modelos',files)
 (root/'backups-extras-concluidos').touch()
except Exception:
 text=traceback.format_exc(); (root/'falha-backups-extras.txt').write_text(text); print(text,flush=True); raise


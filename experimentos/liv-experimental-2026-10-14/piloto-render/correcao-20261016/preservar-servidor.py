"""Lotes imutáveis e checkpoints completos desta execução autorizada."""
import json
from pathlib import Path
import tarfile
import time

base = Path('/root/liv-corrigido-20261016')
frames = json.loads((base/'dataset/plano-captura.json').read_text())['dataset']['frames']
for directory in ('backups','model-backups'): (base/directory).mkdir(exist_ok=True)
saved = set()
while True:
    for start in range(0,len(frames),100):
        archive = base/'backups'/f'capturas-{start:04d}.tgz'
        paths = [base/'dataset'/f['file_path'] for f in frames[start:start+100]]
        if archive.exists() or not all(p.is_file() for p in paths): continue
        temp = archive.with_suffix('.partial')
        with tarfile.open(temp,'w:gz',compresslevel=1) as tar:
            for p in paths: tar.add(p,arcname=p.relative_to(base))
            for name in ('plano-captura.json','pontos.ply'):
                tar.add(base/'dataset'/name,arcname='dataset/'+name)
        temp.replace(archive)
        print('CAPTURAS',archive.name,archive.stat().st_size,flush=True)
    checkpoints = sorted((base/'treino').glob('**/step-*.ckpt'))
    if checkpoints:
        latest = checkpoints[-1]
        step = int(latest.stem.split('-')[-1])
        bucket = (step+1)//5000
        if bucket and bucket not in saved and latest.exists() and time.time()-latest.stat().st_mtime > 15:
            archive = base/'model-backups'/f'modelo-{step:09d}.tgz'
            try:
                with tarfile.open(archive.with_suffix('.partial'),'w:gz',compresslevel=1) as tar:
                    for p in (latest,latest.parent.parent/'config.yml',base/'dataset/transforms.json',base/'dataset/plano-captura.json'):
                        tar.add(p,arcname=p.relative_to(base))
                archive.with_suffix('.partial').replace(archive)
                saved.add(bucket)
                print('MODELO',archive.name,archive.stat().st_size,flush=True)
            except FileNotFoundError: pass
    if (base/'pipeline-concluido').exists() and any((base/'model-backups').glob('modelo-000029999.tgz')): break
    time.sleep(25)

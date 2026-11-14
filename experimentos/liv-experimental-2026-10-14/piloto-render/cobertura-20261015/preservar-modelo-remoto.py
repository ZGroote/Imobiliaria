"""Preserva checkpoints completos nos marcos de 10k/20k/final e perto do fim do aluguel."""
import datetime
from pathlib import Path
import tarfile
import time

base = Path('/root/liv-2h')
out = base/'model-backups'
out.mkdir(exist_ok=True)
salvos = set()
while True:
    files = sorted((base/'treino').glob('**/step-*.ckpt'))
    if files:
        latest = files[-1]
        step = int(latest.stem.split('-')[-1])
        agora = datetime.datetime.now(datetime.timezone.utc)
        urgente = agora >= datetime.datetime(2026,10,15,22,0,tzinfo=datetime.timezone.utc)
        bucket = 30000 if step >= 29999 else step//10000*10000
        if urgente: bucket = step
        if bucket and bucket not in salvos and time.time()-latest.stat().st_mtime > 10:
            path = out/f'modelo-{step:09d}.tgz'
            tmp = path.with_suffix('.partial')
            with tarfile.open(tmp,'w:gz',compresslevel=1) as tar:
                tar.add(latest,arcname=latest.relative_to(base))
                config = latest.parent.parent/'config.yml'
                tar.add(config,arcname=config.relative_to(base))
                tar.add(base/'dataset/transforms.json',arcname='dataset/transforms.json')
                tar.add(base/'dataset/plano-captura.json',arcname='dataset/plano-captura.json')
            tmp.replace(path)
            salvos.add(bucket)
            print('MODELO-SALVO',path.name,path.stat().st_size,flush=True)
            if step >= 29999: break
    time.sleep(15)

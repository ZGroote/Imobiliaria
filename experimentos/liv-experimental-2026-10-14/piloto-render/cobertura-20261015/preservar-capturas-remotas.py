"""Cria lotes imutáveis de PNGs concluídos para baixar durante o render."""
import json
from pathlib import Path
import tarfile
import time

pasta = Path('/root/liv-2h')
data = json.loads((pasta/'dataset/plano-captura.json').read_text())['dataset']
out = pasta/'backups'
out.mkdir(exist_ok=True)
while True:
    completos = 0
    for start in range(0,len(data['frames']),100):
        frames = data['frames'][start:start+100]
        arquivo = out/f'capturas-{start:04d}.tgz'
        if arquivo.exists(): completos += len(frames); continue
        paths = [pasta/'dataset'/f['file_path'] for f in frames]
        if not all(p.is_file() for p in paths): continue
        tmp = arquivo.with_suffix('.partial')
        with tarfile.open(tmp,'w:gz',compresslevel=1) as tar:
            for path in paths: tar.add(path,arcname=path.relative_to(pasta))
            for name in ('plano-captura.json','pontos.ply'):
                tar.add(pasta/'dataset'/name,arcname='dataset/'+name)
        tmp.replace(arquivo)
        completos += len(frames)
        print('BACKUP',arquivo.name,arquivo.stat().st_size,flush=True)
    if completos == len(data['frames']): break
    time.sleep(20)

"""Exporta uma cópia do último checkpoint às 22:02 UTC, antes do fim do aluguel."""
import datetime
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import time
import yaml

base = Path('/root/liv-2h')
os.chdir(base)
while datetime.datetime.now(datetime.timezone.utc) < datetime.datetime(2026, 10, 15, 22, 2, tzinfo=datetime.timezone.utc):
    time.sleep(15)
if (base/'treino-completo').exists():
    raise SystemExit('Treino final já exportado.')
while True:
    files = sorted((base/'treino').glob('**/step-*.ckpt'))
    if files and time.time()-files[-1].stat().st_mtime > 10:
        checkpoint = files[-1]
        break
    time.sleep(5)
config = yaml.load((checkpoint.parent.parent/'config.yml').read_text(), Loader=yaml.Loader)
config.output_dir = base/'limite-checkpoint'
destino = config.get_checkpoint_dir()
destino.mkdir(parents=True, exist_ok=True)
shutil.copy2(checkpoint, destino/checkpoint.name)
config_path = destino.parent/'config.yml'
config_path.write_text(yaml.dump(config), encoding='utf-8')
out = base/'limite-resultado'
env = dict(os.environ, CUDA_VISIBLE_DEVICES='1', TORCHDYNAMO_DISABLE='1', TORCH_COMPILE_DISABLE='1')
subprocess.run(['/root/liv-ns/bin/ns-export', 'gaussian-splat', '--load-config', str(config_path), '--output-dir', str(out)], env=env, check=True)
# Preserva primeiro o modelo utilizável; avaliação pode terminar depois.
def preservar(nome):
    path = base/'model-backups'/nome
    tmp = path.with_suffix('.partial')
    with tarfile.open(tmp, 'w:gz', compresslevel=1) as tar:
        tar.add(out, arcname='limite-resultado')
    tmp.replace(path)
    print('EXPORTADO', checkpoint.name, path.name, flush=True)
preservar('limite-exportado.tgz')
subprocess.run(['/root/liv-ns/bin/ns-eval', '--load-config', str(config_path), '--output-path', str(out/'eval.json'), '--render-output-path', str(out/'eval')], env=env, check=True)
preservar('limite-avaliado.tgz')

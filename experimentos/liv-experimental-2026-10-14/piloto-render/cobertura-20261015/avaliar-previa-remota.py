"""Avalia uma cópia estável do checkpoint na GPU livre, sem interromper o treino."""
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import time
import yaml

base = Path('/root/liv-2h')
os.chdir(base)
while True:
    files = sorted((base/'treino').glob('**/step-*.ckpt'))
    if files and int(files[-1].stem.split('-')[-1]) >= 9999 and time.time()-files[-1].stat().st_mtime > 10:
        checkpoint = files[-1]
        break
    time.sleep(15)
config = yaml.load((checkpoint.parent.parent/'config.yml').read_text(),Loader=yaml.Loader)
config.output_dir = base/'previa-checkpoint'
destino = config.get_checkpoint_dir()
destino.mkdir(parents=True,exist_ok=True)
shutil.copy2(checkpoint,destino/checkpoint.name)
config_path = destino.parent/'config.yml'
config_path.write_text(yaml.dump(config),encoding='utf-8')
out = base/'previa-resultado'
env = dict(os.environ,CUDA_VISIBLE_DEVICES='1',TORCHDYNAMO_DISABLE='1',TORCH_COMPILE_DISABLE='1')
for cmd in (
    ['/root/liv-ns/bin/ns-export','gaussian-splat','--load-config',str(config_path),'--output-dir',str(out)],
    ['/root/liv-ns/bin/ns-eval','--load-config',str(config_path),'--output-path',str(out/'eval.json'),'--render-output-path',str(out/'eval')]
):
    subprocess.run(cmd,env=env,check=True)
path = base/'model-backups/previa-avaliada.tgz'
tmp = path.with_suffix('.partial')
with tarfile.open(tmp,'w:gz',compresslevel=1) as tar:
    tar.add(out,arcname='previa-resultado')
tmp.replace(path)
print('PREVIA-AVALIADA',checkpoint.name,flush=True)

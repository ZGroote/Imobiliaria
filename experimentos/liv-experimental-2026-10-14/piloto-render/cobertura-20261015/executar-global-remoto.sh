#!/usr/bin/env bash
set -euo pipefail
export PATH=/root/liv-ns/bin:$PATH
while ! echo '23569ccba359843f2ff1818ce0af019da252640bb708b5f245271d110f96cf89  /root/liv-contexto.tgz' | sha256sum -c - >/dev/null 2>&1; do sleep 10; done
mkdir -p /root/liv-global
cd /root/liv-global
tar -xzf /root/liv-contexto.tgz
python - <<'PY'
from pathlib import Path
import json,os
p=Path('dataset')
for f in json.loads(Path('/root/liv-2h/dataset/transforms.json').read_text())['frames']:
    path=p/f['file_path']
    if not path.exists(): os.link(Path('/root/liv-2h/dataset')/f['file_path'],path)
PY
CUDA_VISIBLE_DEVICES=1 /root/liv-blender/blender -b /root/liv-2h/apartamento.blend -t 8 --python-exit-code 1 --python /root/liv-2h/gpu.py --python /root/conferir-contexto-blender.py > comparacao-render.log 2>&1
python - <<'PY'
import json
from pathlib import Path
import numpy as np
from PIL import Image
from skimage.metrics import structural_similarity
checks=json.loads(Path('comparacao.json').read_text())
result=[]
for i,c in enumerate(checks):
    a=np.asarray(Image.open(Path('dataset')/c['reference']).convert('RGB'),dtype=np.float32)/255
    b=np.asarray(Image.open(f'comparacao-{i}.png').convert('RGB'),dtype=np.float32)/255
    score=float(structural_similarity(a,b,channel_axis=2,data_range=1.0))
    result.append({'room':c['frame']['comodo'],'ssim':score})
Path('comparacao-resultado.json').write_text(json.dumps(result,indent=2))
print('COMPATIBILIDADE',result,flush=True)
assert min(r['ssim'] for r in result) >= .97,'Capturas antigas incompatíveis: treino recusado'
meta=json.loads(Path('dataset/transforms.json').read_text())
assert len(meta['frames'])==1156
assert not set(meta['train_filenames']) & set(meta['val_filenames'])
assert all((Path('dataset')/f['file_path']).is_file() for f in meta['frames'])
PY
export CUDA_VISIBLE_DEVICES=0 TORCHDYNAMO_DISABLE=1 TORCH_COMPILE_DISABLE=1
ns-train splatfacto --vis tensorboard --output-dir treino --experiment-name apartamento-contexto \
  --viewer.quit-on-train-completion True --max-num-iterations 30000 \
  --steps-per-eval-all-images 0 --steps-per-eval-image 1000 \
  --pipeline.datamanager.cache-images cpu --pipeline.model.cull-alpha-thresh 0.005 \
  nerfstudio-data --data dataset --downscale-factor 1 --auto-scale-poses False \
  --center-method none --orientation-method none --scene-scale 6 --load-3D-points True > treino.log 2>&1
CFG=$(find treino -name config.yml -print -quit)
test -n "$CFG"
ns-export gaussian-splat --load-config "$CFG" --output-dir resultado
# Preserva um PLY antes da avaliação mais demorada.
tar -czf exportado.partial resultado dataset/transforms.json comparacao-resultado.json treino.log "$CFG"
mv exportado.partial exportado.tgz
ns-eval --load-config "$CFG" --output-path resultado/eval.json --render-output-path resultado/eval
tar -czf resultado.partial resultado dataset/transforms.json comparacao-resultado.json treino.log "$CFG"
mv resultado.partial resultado.tgz
tar -czf checkpoint.partial treino dataset/transforms.json
mv checkpoint.partial checkpoint.tgz
echo GLOBAL-CONCLUIDO

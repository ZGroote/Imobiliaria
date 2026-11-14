#!/usr/bin/env bash
set -euo pipefail
cd /root/liv-corrigido-20261016
trap 'date -u > falha-pipeline.txt' ERR
while [ ! -f /root/liv-blender-pronto ]; do sleep 5; done
printf '%s  %s\n' 32ac7093d617be03d0676cd9d581e36e3bb1bf8bf4969735fec9c27bc0d2d1bd dataset/pontos.ply | sha256sum -c -
python3.11 validar_captura.py dataset --fonte apartamento.blend
date -u
CUDA_VISIBLE_DEVICES=0 /root/liv-blender/blender -b apartamento.blend -t 8 --python-exit-code 1 --python gpu.py --python renderizar_plano.py -- --parte 0 --partes 2 > render-0.log 2>&1 &
PID0=$!
CUDA_VISIBLE_DEVICES=1 /root/liv-blender/blender -b apartamento.blend -t 8 --python-exit-code 1 --python gpu.py --python renderizar_plano.py -- --parte 1 --partes 2 > render-1.log 2>&1 &
PID1=$!
wait "$PID0"
wait "$PID1"
python3.11 - <<'PY'
import json
from pathlib import Path
p=Path('dataset')
data=json.loads((p/'plano-captura.json').read_text())['dataset']
assert all((p/f['file_path']).is_file() for f in data['frames'])
(p/'transforms.json').write_text(json.dumps(data,ensure_ascii=False,indent=1),encoding='utf-8')
PY
python3.11 validar_captura.py dataset --completo --fonte apartamento.blend
touch render-completo
date -u
while [ ! -f /root/liv-treino-instalado ]; do sleep 10; done
export PATH=/root/liv-ns/bin:$PATH
export TORCHDYNAMO_DISABLE=1 TORCH_COMPILE_DISABLE=1 CUDA_VISIBLE_DEVICES=0
grep -q -- '--steps-per-save' /root/liv-train-help.txt
CACHE_ARGS=()
if grep -q -- '--pipeline.datamanager.cache-images-type' /root/liv-train-help.txt; then
  CACHE_ARGS=(--pipeline.datamanager.cache-images-type uint8)
fi
ns-train splatfacto --vis tensorboard --output-dir treino --experiment-name apartamento-corrigido \
  --viewer.quit-on-train-completion True --max-num-iterations 30000 --steps-per-save 5000 \
  --steps-per-eval-all-images 0 --steps-per-eval-image 1000 \
  --pipeline.datamanager.cache-images cpu "${CACHE_ARGS[@]}" \
  --pipeline.model.camera-optimizer.mode off --pipeline.model.cull-alpha-thresh 0.005 \
  nerfstudio-data --data dataset --downscale-factor 1 --auto-scale-poses False \
  --center-method none --orientation-method none --scene-scale 6 --load-3D-points True > treino.log 2>&1
touch treino-completo
date -u
CFG=$(find treino -name config.yml -print -quit)
test -n "$CFG"
ns-export gaussian-splat --load-config "$CFG" --output-dir resultado > export.log 2>&1
ns-eval --load-config "$CFG" --output-path resultado/eval.json --render-output-path resultado/eval > avaliacao.log 2>&1
touch avaliacao-completa
tar -czf resultado-final.partial.tgz resultado treino.log export.log avaliacao.log render-0.log render-1.log dataset/plano-captura.json dataset/transforms.json
mv resultado-final.partial.tgz resultado-final.tgz
touch pipeline-concluido
date -u

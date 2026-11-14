#!/usr/bin/env bash
# Só o treino em diante (as 521 imagens já estão em dataset/): treino, PLY, ns-eval, métricas por cômodo e
# render nas poses do Tour. Ambiente Python 3.10 (/root/ns310): a roda do gsplat com CUDA só existe para cp310.
#   nohup bash treinar.sh > treinar.log 2>&1 &
set -uo pipefail
cd /root/jateado
NS=/root/ns310/bin; ITER=${ITER:-30000}
marca() { echo "[$(date -u +%H:%M:%S)] $*"; }
export TORCHDYNAMO_DISABLE=1 TORCH_COMPILE_DISABLE=1
rm -rf treino resultado
marca "treino iniciado ($ITER etapas)"
CUDA_VISIBLE_DEVICES=0 $NS/ns-train splatfacto --output-dir treino --experiment-name jateado \
  --viewer.quit-on-train-completion True --max-num-iterations $ITER --steps-per-save 5000 \
  --pipeline.datamanager.cache-images gpu --pipeline.model.camera-optimizer.mode off \
  --pipeline.model.cull-alpha-thresh 0.005 \
  nerfstudio-data --data dataset --auto-scale-poses False --center-method none --orientation-method none \
  --load-3D-points True > treino.log 2>&1
CFG=$(ls -t treino/jateado/splatfacto/*/config.yml | head -1)
marca "exportando ($CFG)"
$NS/ns-export gaussian-splat --load-config "$CFG" --output-dir resultado > export.log 2>&1
$NS/python render_poses_tour.py "$CFG" resultado/tour > tour.log 2>&1
$NS/ns-eval --load-config "$CFG" --output-path resultado/eval.json --render-output-path resultado/eval > avaliacao.log 2>&1
$NS/python avaliar-por-ambiente.py --dataset dataset --eval resultado/eval --out resultado/analise-ambientes > ambientes.log 2>&1
marca "FIM"

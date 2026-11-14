#!/usr/bin/env bash
set -euo pipefail
cd /root/liv-2h
export PATH=/root/liv-ns/bin:$PATH
export TORCHDYNAMO_DISABLE=1 TORCH_COMPILE_DISABLE=1
python - <<'PY'
import json
from pathlib import Path
p=Path('teste-ambiente');p.mkdir(exist_ok=True)
(p/'images').symlink_to(Path('dataset/images').resolve(),target_is_directory=True)
(p/'pontos.ply').symlink_to(Path('dataset/pontos.ply').resolve())
data=json.loads(Path('dataset/plano-captura.json').read_text())['dataset']
frames=[f for f in data['frames'] if Path('dataset',f['file_path']).is_file()][:8]
data['frames']=frames
data.update(train_filenames=[f['file_path'] for f in frames[:6]],val_filenames=[f['file_path'] for f in frames[6:]],test_filenames=[f['file_path'] for f in frames[6:]])
(p/'transforms.json').write_text(json.dumps(data))
PY
CUDA_VISIBLE_DEVICES=0 ns-train splatfacto --vis tensorboard --output-dir teste-ambiente-saida --experiment-name smoke \
  --max-num-iterations 3 --pipeline.datamanager.cache-images cpu \
  --pipeline.model.camera-optimizer.mode off \
  nerfstudio-data --data teste-ambiente --downscale-factor 1 --auto-scale-poses False \
  --center-method none --orientation-method none --scene-scale 6 --load-3D-points True
echo TREINO-SMOKE-PASS

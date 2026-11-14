#!/usr/bin/env bash
set -euo pipefail
cd /root/liv-corrigido-20261016
export PATH=/root/liv-ns/bin:$PATH
export CUDA_VISIBLE_DEVICES=0 TORCHDYNAMO_DISABLE=1 TORCH_COMPILE_DISABLE=1
python testar-gpu-remota.py
python - <<'PY'
import json
from pathlib import Path
root=Path('smoke-dataset')
root.mkdir(exist_ok=False)
(root/'images').symlink_to(Path('dataset/images').resolve(),target_is_directory=True)
(root/'pontos.ply').symlink_to(Path('dataset/pontos.ply').resolve())
data=json.loads(Path('dataset/plano-captura.json').read_text())['dataset']
frames=[]; used=set()
for frame in data['frames']:
    if frame['position_id'] in used or not Path('dataset',frame['file_path']).is_file(): continue
    frames.append(frame); used.add(frame['position_id'])
    if len(frames)==10: break
assert len(frames)==10
data['frames']=frames
data.update(train_filenames=[f['file_path'] for f in frames[:8]],
            val_filenames=[f['file_path'] for f in frames[8:]],
            test_filenames=[f['file_path'] for f in frames[8:]])
(root/'transforms.json').write_text(json.dumps(data))
PY
ns-train splatfacto --vis tensorboard --output-dir smoke-treino --experiment-name ambiente \
  --viewer.quit-on-train-completion True --max-num-iterations 3 \
  --steps-per-eval-all-images 0 --steps-per-eval-image 0 \
  --pipeline.datamanager.cache-images cpu --pipeline.datamanager.cache-images-type uint8 \
  --pipeline.model.camera-optimizer.mode off \
  nerfstudio-data --data smoke-dataset --downscale-factor 1 --auto-scale-poses False \
  --center-method none --orientation-method none --scene-scale 6 --load-3D-points True
CFG=$(find smoke-treino -name config.yml -print -quit)
ns-export gaussian-splat --load-config "$CFG" --output-dir smoke-export
touch smoke-pass
date -u

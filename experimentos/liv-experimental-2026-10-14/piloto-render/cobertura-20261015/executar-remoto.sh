#!/usr/bin/env bash
set -euo pipefail
cd /root/liv
while ! grep -q '^Blender 5.2.2' /root/liv-blender-install.log || pgrep -x dnf >/dev/null; do sleep 5; done
test -s dataset/pontos.ply
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
meta=json.loads((p/'plano-captura.json').read_text())['dataset']
assert all((p/f['file_path']).is_file() for f in meta['frames'])
(p/'transforms.json').write_text(json.dumps(meta,ensure_ascii=False,indent=1),encoding='utf-8')
PY
python3.11 validar_captura.py dataset --completo --fonte apartamento.blend
touch render-completo
date -u
while [ ! -f /root/liv-treino-instalado ]; do sleep 10; done
export PATH=/root/liv-ns/bin:$PATH
bash executar.sh treino
touch treino-completo
date -u
tar -czf /root/liv-resultado.tgz resultado treino.log render-0.log render-1.log dataset/plano-captura.json dataset/transforms.json
echo PIPELINE-CONCLUIDO

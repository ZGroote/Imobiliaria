#!/usr/bin/env bash
# Regenera tudo que não vai para o git (arquivos > 1 MiB): texturas, GLBs e o detector de pose.
# Requer: pip install bpy==5.2.3 numpy pillow
set -euo pipefail
cd "$(dirname "$0")"
(cd blender && python3 construir.py ../build ../site/modelos && python3 glb_para_json.py ../site/modelos/*.glb)
mkdir -p site/mp
V=0.10.20
for f in vision_wasm_internal.wasm vision_wasm_internal.js; do
  curl -sSfL -o "site/mp/$f" "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@$V/wasm/$f"
done
curl -sSfL -o site/mp/pose_landmarker_lite.task \
  https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task
base64 -w0 site/mp/pose_landmarker_lite.task > site/mp/pose_landmarker_lite.task.b64.txt
echo "pronto: python3 -m http.server -d site 8765  ->  http://localhost:8765"

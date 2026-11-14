#!/usr/bin/env bash
# Render das vistas (todas as GPUs no Cycles) -> treino splatfacto -> exporta o .ply do splat.
# Uso: bash rodar.sh [vistas=300] [amostras=128]
set -euo pipefail
VISTAS=${1:-300}; AMOSTRAS=${2:-128}
cd ~/piloto
cat > gpu.py <<'EOF'
import bpy
p = bpy.context.preferences.addons["cycles"].preferences
for t in ("CUDA", "OPTIX"):   # OptiX derruba o Blender 5.2 em Tesla V100 (sem RT core); CUDA primeiro
    try:
        p.compute_device_type = t; p.get_devices()
        if any(d.type == t for d in p.devices):
            for d in p.devices: d.use = d.type == t
            bpy.context.scene.cycles.device = "GPU"; print("GPU", t, [d.name for d in p.devices if d.use]); break
    except TypeError: pass
EOF
date; ~/blender/blender -b piloto-empacotado.blend --python gpu.py --python capturar_splat.py -- \
  --saida captura --amostras "$AMOSTRAS" --res 1280x720 --limite "$VISTAS" 2>&1 | grep -E "GPU|PONTOS|VISTA|PLY|Error"
date
~/ns/bin/ns-train splatfacto --output-dir saida --viewer.quit-on-train-completion True \
  --max-num-iterations 30000 nerfstudio-data --data captura --auto-scale-poses False \
  --center-method none --orientation-method none 2>&1 | tail -20
CFG=$(ls -t saida/*/splatfacto/*/config.yml | head -1)
~/ns/bin/ns-export gaussian-splat --load-config "$CFG" --output-dir splat
ls -la splat; date; echo "PRONTO"

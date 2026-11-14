#!/usr/bin/env bash
# Recaptura sem reflexo (variante jateado) só nos cômodos molhados (Banho, Banho suíte, Varanda): 521 vistas
# do plano de 16/10 (mesmas poses e divisão). Instala, renderiza nas 2 GPUs, treina, exporta e avalia.
# Em /root/jateado com pacote-jateado-64.zip, renderizar_plano.py e molhados/ (plano, transforms, pontos.ply):
#   nohup bash servidor.sh > pipeline.log 2>&1 &
set -uo pipefail
cd /root/jateado
ITER=${ITER:-30000}
marca() { echo "[$(date -u +%H:%M:%S)] $*"; }

# nerfstudio em segundo plano desde já (as mesmas versões do modelo de 16/10)
(
  if [ ! -x /root/ns/bin/ns-train ]; then
    python3 -m venv /root/ns && /root/ns/bin/pip install -q --upgrade pip &&
    /root/ns/bin/pip install -q torch==2.4.1 torchvision==0.19.1 --index-url https://download.pytorch.org/whl/cu124 &&
    /root/ns/bin/pip install -q "numpy==1.26.4" gsplat==1.4.0 --extra-index-url https://docs.gsplat.studio/whl/pt24cu124 &&
    /root/ns/bin/pip install -q nerfstudio==1.1.5
  fi
  /root/ns/bin/ns-train --help > /dev/null && echo pronto > ns.ok
) > ns-install.log 2>&1 &

# Blender
if [ ! -x /root/blender/blender ]; then
  marca "baixando Blender"
  curl -fsSL --retry 3 --connect-timeout 20 -o /root/blender.tar.xz https://mirror.tuna.tsinghua.edu.cn/blender/release/Blender5.2/blender-5.2.2-linux-x64.tar.xz ||
    curl -fsSL --retry 3 --connect-timeout 20 -o /root/blender.tar.xz https://download.blender.org/release/Blender5.2/blender-5.2.2-linux-x64.tar.xz
  mkdir -p /root/blender && tar -xf /root/blender.tar.xz -C /root/blender --strip-components=1
fi
/root/blender/blender -b --version | head -1 || { marca "Blender não abre"; exit 1; }
[ -f apartamento.blend ] || unzip -oq pacote-jateado-64.zip
cp molhados/plano-captura.json dataset/plano-captura.json

marca "render iniciado (521 vistas)"
for g in 0 1; do
  CUDA_VISIBLE_DEVICES=$g /root/blender/blender -b apartamento.blend -t 8 --python-exit-code 1 --python gpu.py \
    --python renderizar_plano.py -- --parte $g --partes 2 > render-$g.log 2>&1 &
done
wait $(jobs -p | tail -2)
grep -q "PARTE-FIM" render-0.log && grep -q "PARTE-FIM" render-1.log || { marca "ERRO no render"; tail -5 render-*.log; exit 1; }
marca "render concluído: $(ls dataset/images | wc -l) imagens"

cp molhados/transforms.json dataset/transforms.json
python3 - <<'PY'
# 16/10: pontos duplicados na semente deram escala log(0) no treino
linhas = open("molhados/pontos.ply").read().splitlines(); fim = linhas.index("end_header")
pts = linhas[fim + 1:]; vistos = set(); uni = []
for l in pts:
    k = tuple(l.split()[:3])
    if k not in vistos: vistos.add(k); uni.append(l)
cab = [("element vertex %d" % len(uni)) if l.startswith("element vertex") else l for l in linhas[:fim + 1]]
open("dataset/pontos.ply", "w").write("\n".join(cab + uni) + "\n"); print("semente", len(pts), "->", len(uni))
PY

marca "esperando nerfstudio"; while [ ! -f ns.ok ]; do sleep 10; done
marca "treino iniciado ($ITER etapas)"
export TORCHDYNAMO_DISABLE=1 TORCH_COMPILE_DISABLE=1
CUDA_VISIBLE_DEVICES=0 /root/ns/bin/ns-train splatfacto --output-dir treino --experiment-name jateado \
  --viewer.quit-on-train-completion True --max-num-iterations $ITER --steps-per-save 5000 \
  --pipeline.datamanager.cache-images gpu --pipeline.model.camera-optimizer.mode off \
  --pipeline.model.cull-alpha-thresh 0.005 \
  nerfstudio-data --data dataset --auto-scale-poses False --center-method none --orientation-method none \
  --load-3D-points True > treino.log 2>&1
CFG=$(ls -t treino/jateado/splatfacto/*/config.yml | head -1)
marca "exportando"
/root/ns/bin/ns-export gaussian-splat --load-config "$CFG" --output-dir resultado > export.log 2>&1
/root/ns/bin/ns-eval --load-config "$CFG" --output-path resultado/eval.json --render-output-path resultado/eval > avaliacao.log 2>&1
marca "FIM"

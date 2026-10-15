#!/usr/bin/env bash
# Recaptura densa só dos dois banheiros do Meio (os splats da captura geral tinham 22 e 25 vistas, PSNR 28-29).
# Grade de 0,20 m, folga de 0,12 m das paredes, 8 rumos por ponto, vista descartada só a menos de 0,35 m:
# ~350 vistas por banheiro (conferido com --sem-render). Metade das GPUs renderiza cada banheiro, depois
# treina um por GPU, exporta e avalia como o comodos.sh.
# Sobe para ~/piloto: apto-empacotado.blend, gpu.py, ../capturar_splat.py, ../planta.py, ../../interiores/meio/unidade.json.
set -euo pipefail
cd ~/piloto
export TORCHDYNAMO_DISABLE=1 TORCH_COMPILE_DISABLE=1
N=$(nvidia-smi -L | wc -l); M=$((N / 2)); [ "$M" -ge 1 ] || M=1
A=$(seq -s, 0 $((M - 1))); B=$(seq -s, $((N > 1 ? M : 0)) $((N > 1 ? N - 1 : 0)))

capturar() {  # nome zona gpus
  CUDA_VISIBLE_DEVICES=$3 ~/blender/blender -b apto-empacotado.blend --python gpu.py --python capturar_splat.py -- \
    --saida "captura-$1" --zona "$2" --unidade unidade.json --passo 0.2 --folga 0.12 --colado 0.35 --rumos 8 \
    --amostras 128 --res 1280x720 > "render-$1.log" 2>&1
  grep -q FIM "render-$1.log"
}
date
( capturar banho-suite "Banho suíte" "$A" ) & ( capturar banho-social "Banho" "$B" ) & wait
date; grep -h "GPU\|PONTOS\|FIM" render-banho-*.log

treinar() {  # nome gpu
  local nome=$1 gpu=$2 ini=$(date +%s)
  CUDA_VISIBLE_DEVICES=$gpu ~/ns/bin/ns-train splatfacto --output-dir comodo --experiment-name "$nome" \
    --viewer.quit-on-train-completion True --max-num-iterations 30000 --pipeline.datamanager.cache-images gpu \
    nerfstudio-data --data "captura-$nome" --auto-scale-poses False --center-method none \
    --orientation-method none --load-3D-points True > "comodo-$nome.log" 2>&1
  local cfg=$(ls -t comodo/$nome/splatfacto/*/config.yml | head -1)
  CUDA_VISIBLE_DEVICES=$gpu ~/ns/bin/ns-export gaussian-splat --load-config "$cfg" --output-dir "splat-comodo-$nome" >> "comodo-$nome.log" 2>&1
  CUDA_VISIBLE_DEVICES=$gpu ~/ns/bin/ns-eval --load-config "$cfg" --output-path "eval-comodo-$nome.json" >> "comodo-$nome.log" 2>&1
  local n=$(head -c 400 "splat-comodo-$nome/splat.ply" | grep -a "element vertex" | awk '{print $3}')
  python3 -c "import json;r=json.load(open('eval-comodo-$nome.json'))['results'];print(json.dumps({'nome':'$nome','vistas':len(json.load(open('captura-$nome/transforms.json'))['frames']),'gaussianas':$n,'minutos':round(($(date +%s)-$ini)/60,1),'psnr':round(r['psnr'],2),'ssim':round(r['ssim'],4),'lpips':round(r['lpips'],4)}))" >> resumo-banheiros.jsonl
}
( treinar banho-suite 0 ) & ( treinar banho-social $((N > 1 ? 1 : 0)) ) & wait
cat resumo-banheiros.jsonl
tar -czf banheiros.tgz splat-comodo-banho-*/splat.ply eval-comodo-banho-*.json resumo-banheiros.jsonl render-banho-*.log
echo BANHEIROS-FIM

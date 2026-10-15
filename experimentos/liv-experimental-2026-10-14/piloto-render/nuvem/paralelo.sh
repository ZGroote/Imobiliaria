#!/usr/bin/env bash
# Variantes leves para celular, em paralelo com o treino completo (encadear.sh, GPU 0).
cd ~/piloto
export TORCHDYNAMO_DISABLE=1 TORCH_COMPILE_DISABLE=1
grep -q "FIM" render-apto.log || { echo "render sem FIM"; exit 1; }

treinar() {  # nome gpu args...
  local nome=$1 gpu=$2; shift 2
  local ini=$(date +%s)
  CUDA_VISIBLE_DEVICES=$gpu ~/ns/bin/ns-train splatfacto --output-dir var --experiment-name "$nome" \
    --viewer.quit-on-train-completion True --max-num-iterations 30000 --pipeline.datamanager.cache-images gpu \
    "$@" nerfstudio-data --data captura-apto --auto-scale-poses False --center-method none \
    --orientation-method none --load-3D-points True > "var-$nome.log" 2>&1
  local cfg=$(ls -t var/$nome/splatfacto/*/config.yml | head -1)
  CUDA_VISIBLE_DEVICES=$gpu ~/ns/bin/ns-export gaussian-splat --load-config "$cfg" --output-dir "splat-$nome" >> "var-$nome.log" 2>&1
  CUDA_VISIBLE_DEVICES=$gpu ~/ns/bin/ns-eval --load-config "$cfg" --output-path "eval-$nome.json" >> "var-$nome.log" 2>&1
  local n=$(head -c 400 "splat-$nome/splat.ply" | grep -a "element vertex" | awk '{print $3}')
  python3 -c "import json,sys;r=json.load(open('eval-$nome.json'))['results'];print(json.dumps({'nome':'$nome','gaussianas':$n,'minutos':round(($(date +%s)-$ini)/60,1),'psnr':round(r['psnr'],2),'ssim':round(r['ssim'],4),'lpips':round(r['lpips'],4)}))" >> resumo.jsonl
}

M="--pipeline.model.sh-degree 1"
( treinar completo 0
  treinar media 0 $M --pipeline.model.densify-grad-thresh 0.0012 ) &
( treinar leve 1 $M --pipeline.model.densify-grad-thresh 0.0016
  treinar muito-leve 1 $M --pipeline.model.densify-grad-thresh 0.0025 --pipeline.model.stop-split-at 10000 ) &
wait
echo PARALELO-FIM

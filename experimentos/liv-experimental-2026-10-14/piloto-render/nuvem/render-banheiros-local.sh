#!/usr/bin/env bash
# Render dos banheiros na GPU local (GTX 1650: ~50 s/vista, ~10 h); o treino vai para a nuvem (banheiros.sh pula o render se já houver FIM).
B="/c/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe"
cd "$(dirname "$0")/.."
for par in "banho-suite:Banho suíte" "banho-social:Banho"; do
  nome=${par%%:*}; zona=${par#*:}
  "$B" -b nuvem/apto-empacotado.blend --python nuvem/gpu.py --python capturar_splat.py -- \
    --saida "nuvem/captura-$nome" --zona "$zona" --unidade ../interiores/meio/unidade.json \
    --passo 0.2 --folga 0.12 --colado 0.35 --rumos 8 --amostras 128 --res 1280x720 > "nuvem/render-$nome.log" 2>&1
done
echo RENDER-LOCAL-FIM

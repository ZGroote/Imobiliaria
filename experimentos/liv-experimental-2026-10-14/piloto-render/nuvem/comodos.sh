#!/usr/bin/env bash
# Um splat por cômodo: separa as vistas pela posição da câmera e treina dois por vez (uma GPU cada).
cd ~/piloto
export TORCHDYNAMO_DISABLE=1 TORCH_COMPILE_DISABLE=1
python3 - <<'PY'
import json, os
t = json.load(open("captura-apto/transforms.json"))
zonas = {   # espaço do Blender, Z para cima
  "sala":         lambda x, y: x < -0.3 and y < 1.25 and not (x > -1.9 and y > -0.26),
  "varanda":      lambda x, y: x < -1.9 and y >= 1.25,
  "quarto":       lambda x, y: -1.9 <= x < 0.35 and y > -0.26,
  "banho-suite":  lambda x, y: 0.9 <= x < 2.18 and y > -0.15,
  "banho-social": lambda x, y: -0.1 <= x < 2.18 and y < -1.3,
  "suite":        lambda x, y: x >= 2.18,
}
for nome, dentro in zonas.items():
    fr = [f for f in t["frames"] if dentro(f["transform_matrix"][0][3], f["transform_matrix"][1][3])]
    d = f"captura-{nome}"; os.makedirs(d, exist_ok=True)
    if not os.path.exists(f"{d}/images"): os.symlink(os.path.abspath("captura-apto/images"), f"{d}/images")
    if not os.path.exists(f"{d}/pontos.ply"): os.symlink(os.path.abspath("captura-apto/pontos.ply"), f"{d}/pontos.ply")
    json.dump({**t, "frames": fr}, open(f"{d}/transforms.json", "w"))
    print(nome, len(fr))
PY

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
  python3 -c "import json;r=json.load(open('eval-comodo-$nome.json'))['results'];print(json.dumps({'nome':'$nome','gaussianas':$n,'minutos':round(($(date +%s)-$ini)/60,1),'psnr':round(r['psnr'],2),'ssim':round(r['ssim'],4),'lpips':round(r['lpips'],4)}))" >> resumo-comodos.jsonl
}
( treinar suite 0;  treinar banho-suite 0;  treinar sala 0 ) &
( treinar quarto 1; treinar banho-social 1; treinar varanda 1 ) &
wait
echo COMODOS-FIM

#!/usr/bin/env bash
set -euo pipefail
while pgrep -x dnf >/dev/null; do sleep 5; done
python3.11 -m pip install --disable-pip-version-check uv
python3.11 -m uv python install 3.10
if [ ! -x /root/liv-ns/bin/python ]; then python3.11 -m uv venv --python 3.10 /root/liv-ns; fi
python3.11 -m uv pip install --python /root/liv-ns/bin/python pip
/root/liv-ns/bin/pip install --disable-pip-version-check torch==2.4.1 torchvision==0.19.1 --index-url https://download.pytorch.org/whl/cu124
/root/liv-ns/bin/pip install --disable-pip-version-check ninja
/root/liv-ns/bin/pip install --disable-pip-version-check gsplat==1.4.0 --no-deps --index-url https://docs.gsplat.studio/whl/pt24cu124
/root/liv-ns/bin/pip install --disable-pip-version-check nerfstudio==1.1.5 numpy==1.26.4 torch==2.4.1 torchvision==0.19.1
/root/liv-ns/bin/python -c 'import torch,gsplat; print("TORCH",torch.__version__,"GPUS",torch.cuda.device_count(),"GSPLAT",gsplat.__version__)'
/root/liv-ns/bin/ns-train splatfacto --help >/root/liv-train-help.txt
touch /root/liv-treino-instalado

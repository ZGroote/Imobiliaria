#!/usr/bin/env bash
# Prepara a máquina de GPU alugada (Ubuntu + driver NVIDIA): Blender 5.2.2 e nerfstudio (splatfacto).
set -euo pipefail
cd ~
nvidia-smi
command -v nvcc || echo "AVISO: sem nvcc; o gsplat usa roda pré-compilada"

apt-get update -qq && apt-get install -y -qq curl xz-utils libxi6 libxxf86vm1 libxfixes3 libxrender1 libgl1 libxkbcommon0 libsm6 python3-venv git >/dev/null

if [ ! -x ~/blender/blender ]; then
  # download.blender.org responde 403 em alguns hosts; o espelho da Tsinghua tem o mesmo arquivo
  curl -fsSL -o blender.tar.xz https://download.blender.org/release/Blender5.2/blender-5.2.2-linux-x64.tar.xz ||
    curl -fsSL -o blender.tar.xz https://mirror.tuna.tsinghua.edu.cn/blender/release/Blender5.2/blender-5.2.2-linux-x64.tar.xz
  mkdir -p blender && tar -xf blender.tar.xz -C blender --strip-components=1 && rm blender.tar.xz
fi
~/blender/blender -b --version | head -1

if [ ! -d ~/ns ]; then
  python3 -m venv ~/ns
  ~/ns/bin/pip install -q --upgrade pip
  ~/ns/bin/pip install -q torch==2.4.1 torchvision==0.19.1 --index-url https://download.pytorch.org/whl/cu124
  ~/ns/bin/pip install -q gsplat --index-url https://docs.gsplat.studio/whl/pt24cu124 || ~/ns/bin/pip install -q gsplat
  ~/ns/bin/pip install -q nerfstudio
fi
~/ns/bin/ns-train --help >/dev/null && echo "INSTALADO"

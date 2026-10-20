#!/usr/bin/env bash
set -euo pipefail
dnf install -y python3.11 python3.11-pip libX11 libXi libXxf86vm libXfixes libXrender libSM libxkbcommon mesa-libGL xz tar unzip git gcc gcc-c++ make
touch /root/liv-base-pronta
mkdir -p /root/liv-blender
curl -fL --retry 3 --connect-timeout 25 -o /root/liv-blender.tar.xz https://download.blender.org/release/Blender5.2/blender-5.2.2-linux-x64.tar.xz || \
curl -fL --retry 3 --connect-timeout 25 -o /root/liv-blender.tar.xz https://mirror.tuna.tsinghua.edu.cn/blender/release/Blender5.2/blender-5.2.2-linux-x64.tar.xz
tar -xf /root/liv-blender.tar.xz -C /root/liv-blender --strip-components=1
/root/liv-blender/blender -b --version | head -1
touch /root/liv-blender-pronto

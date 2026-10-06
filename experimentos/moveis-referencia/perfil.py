"""Perfil de luminancia da foto ao longo de uma linha 3D (camera.json da peca): acha fresta
(vale escuro) e borda (degrau) sem ler grade a olho.
   python perfil.py peca eixo fixo1 fixo2 a b [passo_cm]
   eixo z: x=fixo1 y=fixo2, varre z de a ate b (m);  eixo x: y=fixo1 z=fixo2, varre x"""
import json, sys, numpy as np
from PIL import Image
import os
peca, eixo = sys.argv[1], sys.argv[2]
f1, f2, a, b = map(float, sys.argv[3:7])
passo = float(sys.argv[7]) / 100 if len(sys.argv) > 7 else 0.002
C = json.load(open(f"{peca}/camera.json"))
im = np.asarray(Image.open(next(f"{peca}/referencia.{e}" for e in ("png", "webp") if os.path.exists(f"{peca}/referencia.{e}"))).convert("L"), float)
g = C["rotation_euler"][2]; c, s = np.cos(g), np.sin(g)
R = np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]]) @ np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]])
t = np.arange(a, b, passo)
P = np.stack([np.full_like(t, f1), np.full_like(t, f2), t], 1) if eixo == "z" else np.stack([t, np.full_like(t, f1), np.full_like(t, f2)], 1)
q = (P - C["location"]) @ R
u, v = C["cx"] + C["f"] * q[:, 0] / -q[:, 2], C["cy"] - C["f"] * q[:, 1] / -q[:, 2]
# bilinear
u0, v0 = np.clip(np.floor(u).astype(int), 0, im.shape[1] - 2), np.clip(np.floor(v).astype(int), 0, im.shape[0] - 2)
fu, fv = u - u0, v - v0
L = im[v0, u0] * (1 - fu) * (1 - fv) + im[v0, u0 + 1] * fu * (1 - fv) + im[v0 + 1, u0] * (1 - fu) * fv + im[v0 + 1, u0 + 1] * fu * fv
for ti, li, ui, vi in zip(t, L, u, v):
    print("%7.1f cm  lum %5.1f  %s  px(%.0f,%.0f)" % (ti * 100, li, "#" * int(li / 6), ui, vi))

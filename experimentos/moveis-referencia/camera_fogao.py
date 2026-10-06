"""Camera do fogao 4 bocas: foto praticamente ORTOGRAFICA (lente longa de produto: os pontos de fuga
saem incoerentes, linhas quase paralelas). Ajuste ortografico (giro, inclinacao, escala) com a mesa e o pe
dos pes no chao. Medidas do catalogo que bate com a proporcao da foto (H/W 1,94): Ideal Top Glass 47 x 88,2
x 57,6. A de 50,7 x 86,3 deixava 10 px de residuo na base."""
import json, numpy as np
from scipy.optimize import least_squares
IW, IH = 274, 427
W, D, ZT = 0.47, 0.576, 0.85
PE = 0.035                                       # pe recuado da quina
def R(g, t):
    c, s = np.cos(g), np.sin(g)
    a = np.pi / 2 - t
    Rx = np.array([[1, 0, 0], [0, np.cos(a), -np.sin(a)], [0, np.sin(a), np.cos(a)]])
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]]) @ Rx
def proj(p, P):
    g, t, s, cx, cy = p[:5]
    c = R(g, t).T @ np.asarray(P, float)
    return np.array([cx + s * c[0], cy - s * c[1]])
def pts(W, D=D):
  return [((-W / 2, -D, ZT), (70, 69)), ((-W / 2, 0, ZT), (17, 35)), ((W / 2, -D, ZT), (243, 60)),
       ((-W / 2 + PE, -D + PE, 0.0), (95, 405)), ((W / 2 - PE, -D + PE, 0.0), (222, 391))]
res = lambda p: np.concatenate([proj(p, P) - uv for P, uv in pts(p[5], p[6])])
s = least_squares(res, [np.radians(-20), np.radians(10), 360, 137, 213, 0.47, 0.57])
r = res(s.x)
g, t, sc, cx, cy, W, D = s.x
print("rms %.2f max %.2f giro %.1f incl %.1f escala %.0f px/m W %.3f D %.3f" % (np.sqrt((r**2).mean()), abs(r).max(), np.degrees(g), np.degrees(t), sc, W, D), np.round(r, 1))
# camera ortografica: longe (10 m) na direcao de visada; ortho_scale = largura do quadro em metros
Rm = R(g, t)
alvo = np.linalg.solve(np.array([Rm[:, 0], Rm[:, 1], Rm[:, 2]]).T, np.zeros(3))  # origem
olhar = -Rm[:, 2]
# ponto do mundo que cai no centro do quadro
du, dv = (IW / 2 - cx) / sc, (cy - IH / 2) / sc
centro = Rm[:, 0] * du + Rm[:, 1] * dv
loc = centro - olhar * 10
json.dump({"ortho": IW / sc, "location": loc.tolist(), "rotation_euler": [np.pi / 2 - t, 0.0, g], "res": [IW, IH],
           "f": None, "cx": cx, "cy": cy, "escala": sc, "medidas": {"W": W, "D": D, "zt": ZT}}, open("fogao-4b/camera.json", "w"), indent=1)

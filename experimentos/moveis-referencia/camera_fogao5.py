"""Camera do fogao 5 bocas (534 x 572): catalogo 75,5 x 92 x 64,3 (Suggar Max/Neo Glass); mesa de vidro a
0,90 (o 92 inclui a grelha). Incognitas: camera nivelada com shift + altura da base do corpo (pes)."""
import json, numpy as np
from scipy.optimize import least_squares
IW, IH = 534, 572
W, D, ZT = 0.755, 0.643, 0.90
PTS = [((-W / 2, -D, ZT), (68, 98)), ((W / 2, -D, ZT), (478, 92)), ((-W / 2, 0, ZT), (51, 40)),
       ((-W / 2, -D, "zp"), (68, 492)), ((W / 2, -D, "zp"), (478, 478)),
       ((-W / 2, -D, 0.0), (68, 548)), ((W / 2 - 0.01, -D, 0.0), (472, 517))]       # quina de fora dos pes, no chao
def rot(g):
    c, s = np.cos(g), np.sin(g)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]]) @ np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]])
def proj(p, P):
    C, g, f, cx, cy = p[0:3], p[3], p[4], p[5], p[6]
    c = rot(g).T @ (np.asarray(P, float) - C)
    return np.array([cx + f * c[0] / -c[2], cy - f * c[1] / -c[2]])
def res(p):
    return np.concatenate([proj(p, (x, y, p[7] if z == "zp" else (p[8] if z == ZT else z))) - uv for (x, y, z), uv in PTS])
F = 1500                                         # lente longa de produto (livre: f e distancia se trocam)
res0 = res
res = lambda p: res0(np.concatenate([p[:4], [F], p[4:]]))
best = None
for x0 in (-2, -0.5, 0.5):
    s = least_squares(res, [x0, -4.0, 1.5, -0.2, IW / 2, IH / 2, 0.12, 0.90],
                      bounds=([-8, -15, 0.3, -1.2, -800, -800, 0.03, 0.70], [8, -0.8, 4, 1.2, 1400, 1400, 0.25, 1.0]))
    r = res(s.x)
    if best is None or (r ** 2).sum() < best[1]:
        best = (s.x, (r ** 2).sum(), r)
p, _, r = best
p = np.concatenate([p[:4], [F], p[4:]])
print("rms %.2f max %.2f cam %s giro %.1f f %.0f cx %.0f cy %.0f zp %.3f zt %.3f" % (np.sqrt((r**2).mean()), abs(r).max(), p[:3].round(2), np.degrees(p[3]), p[4], p[5], p[6], p[7], p[8]), np.round(r, 1))
json.dump({"location": p[:3].tolist(), "rotation_euler": [np.pi / 2, 0.0, p[3]], "res": [IW, IH], "f": p[4], "cx": p[5], "cy": p[6],
           "medidas": {"W": W, "D": D, "zt": p[8], "zp": p[7]}}, open("fogao-5b/camera.json", "w"), indent=1)

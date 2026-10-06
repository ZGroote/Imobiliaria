"""Camera da mesa de jantar (459 x 296): mesa de 4 lugares 1,36 x 0,80 (padrao), tampo a 0,77.
Lado comprido pra o fundo. Ajuste nivelado com shift; se nao fechar, com inclinacao."""
import json, numpy as np
from scipy.optimize import least_squares
IW, IH = 459, 296
W, L, Z = 0.80, 1.36, 0.77
PTS = [((-W / 2, -L / 2, Z), (124, 93)), ((W / 2, -L / 2, Z), (228, 112)), ((W / 2, L / 2, Z), (348, 78)),
       ((-W / 2 + 0.04, -L / 2 + 0.04, 0.0), (137, 221)), ((W / 2 - 0.04, -L / 2 + 0.04, 0.0), (232, 235))]
def R(g, t):
    c, s = np.cos(g), np.sin(g); a = np.pi / 2 - t
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]]) @ np.array([[1, 0, 0], [0, np.cos(a), -np.sin(a)], [0, np.sin(a), np.cos(a)]])
def proj(p, P):
    C, g, t, f, cx, cy = p[:3], p[3], p[4], p[5], p[6], p[7]
    c = R(g, t).T @ (np.asarray(P, float) - C)
    return np.array([cx + f * c[0] / -c[2], cy - f * c[1] / -c[2]])
res = lambda p: np.concatenate([proj(p, P) - uv for P, uv in PTS])
melhor = None
for g0 in (-0.9, -0.5, -0.2):
    s = least_squares(res, [-1.5, -2.5, 1.4, g0, 0.3, 500, IW / 2, IH / 2],
                      bounds=([-6, -8, 0.4, -1.6, -0.2, 150, 0, 0], [3, 0, 3, 1.6, 1.2, 3000, IW, IH]))
    r = res(s.x)
    if melhor is None or (r ** 2).sum() < melhor[1]:
        melhor = (s.x, (r ** 2).sum(), r)
p, _, r = melhor
print("rms %.2f max %.2f cam %s giro %.1f incl %.1f f %.0f cx %.0f cy %.0f" % (np.sqrt((r**2).mean()), abs(r).max(), p[:3].round(2), np.degrees(p[3]), np.degrees(p[4]), p[5], p[6], p[7]), np.round(r, 1))
json.dump({"location": p[:3].tolist(), "rotation_euler": [np.pi / 2 - p[4], 0.0, p[3]], "res": [IW, IH], "f": p[5], "cx": p[6], "cy": p[7],
           "medidas": {"W": W, "L": L, "Z": Z}}, open("jantar/camera.json", "w"), indent=1)

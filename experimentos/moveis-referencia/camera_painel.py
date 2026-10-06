"""Camera do painel de TV: sem catalogo -- largura de 1,80 (painel e rack alinhados na esquerda), rack com
40 cm de fundo e painel com 5 cm. Incognitas: camera nivelada com shift, altura do painel e do rack."""
import json, numpy as np
from scipy.optimize import least_squares
IW, IH = 617, 635
W, DR, DP = 1.80, 0.40, 0.05
PTS = [((-W / 2, -DP, "hp"), (65, 40)), ((W / 2, -DP, "hp"), (498, 95)), ((-W / 2, -DR, "hr"), (100, 425)),
       ((W / 2, -DR, "hr"), (545, 410)), ((-W / 2, -DR, 0.0), (100, 605)), ((W / 2, -DR, 0.0), (540, 540))]
def rot(g):
    c, s = np.cos(g), np.sin(g)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]]) @ np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]])
def proj(p, P):
    C, g, f, cx, cy = p[0:3], p[3], p[4], p[5], p[6]
    c = rot(g).T @ (np.asarray(P, float) - C)
    return np.array([cx + f * c[0] / -c[2], cy - f * c[1] / -c[2]])
def res(p):
    d = {"hp": p[7], "hr": p[8]}
    return np.concatenate([proj(p, (x, y, d.get(z, z) if isinstance(z, str) else z)) - uv for (x, y, z), uv in PTS])
s = least_squares(res, [-1.0, -3.0, 1.1, -0.3, 600, IW / 2, IH / 2, 2.0, 0.55],
                  bounds=([-4, -8, 0.3, -1.2, 150, -600, -600, 1.5, 0.3], [3, -0.8, 2.5, 1.2, 4000, 1200, 1200, 2.6, 0.9]))
p = s.x; r = res(p)
print("rms %.2f max %.2f" % (np.sqrt((r**2).mean()), abs(r).max()), "cam", p[:3].round(2), "yaw %.1f f %.0f cx %.0f cy %.0f hp %.3f hr %.3f" % (np.degrees(p[3]), p[4], p[5], p[6], p[7], p[8]), np.round(r, 1))
json.dump({"location": p[:3].tolist(), "rotation_euler": [np.pi / 2, 0.0, p[3]], "res": [IW, IH], "f": p[4], "cx": p[5], "cy": p[6],
           "medidas": {"W": W, "DR": DR, "DP": DP, "hp": p[7], "hr": p[8]}}, open("painel-tv/camera.json", "w"), indent=1)

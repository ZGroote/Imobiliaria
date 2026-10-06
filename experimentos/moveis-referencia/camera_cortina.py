"""Camera da cortina: sem catalogo -- largura de folha franzida 2,1 m e varao a 2,42 m (padrao de cortina de
ilhos 2,80 x 2,50 franzida num varao de 2 m). Plano da cortina em y = 0; camera nivelada com shift."""
import json, numpy as np
from scipy.optimize import least_squares
IW, IH = 549, 591
PTS = [((-0.98, 0, 2.42), (76, 45)), ((0.98, 0, 2.42), (466, 75)), ((1.05, 0, 0.0), (478, 522)), ((-0.75, 0, 0.0), (125, 562))]
def rot(g):
    c, s = np.cos(g), np.sin(g)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]]) @ np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]])
def proj(p, P):
    C, g, f, cx, cy = p[0:3], p[3], p[4], p[5], p[6]
    c = rot(g).T @ (np.asarray(P, float) - C)
    return np.array([cx + f * c[0] / -c[2], cy - f * c[1] / -c[2]])
res = lambda p: np.concatenate([proj(p, P) - uv for P, uv in PTS])
s = least_squares(res, [0.0, -3.0, 1.0, 0.1, 600, IW / 2, IH / 2], bounds=([-3, -8, 0.3, -1, 150, -400, -400], [3, -1, 2.5, 1, 3000, 900, 1000]))
r = res(s.x); p = s.x
print("rms %.2f max %.2f" % (np.sqrt((r**2).mean()), abs(r).max()), "cam", p[:3].round(2), "yaw %.1f f %.0f cx %.0f cy %.0f" % (np.degrees(p[3]), p[4], p[5], p[6]), np.round(r, 1))
json.dump({"location": p[:3].tolist(), "rotation_euler": [np.pi / 2, 0.0, p[3]], "res": [IW, IH], "f": p[4], "cx": p[5], "cy": p[6],
           "medidas": {"W": 2.1, "varao": 2.42}}, open("cortina/camera.json", "w"), indent=1)

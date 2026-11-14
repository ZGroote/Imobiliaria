"""Camera da foto da cozinha: cantos medidos (zoom.py) + medida de catalogo.
A foto sozinha e degenerada (rms 0,5 px com largura de 1,9 a 2,2 m): distancia e focal trocam
uma pela outra. A largura 207,4 e a altura 193,2 sao do armario de 7 portas/3 gavetas com adega
de mesma linha (catalogo de varejo); fixa-las ancora a escala. Incognitas: camera + profundidades + pe."""
import json, numpy as np
from scipy.optimize import least_squares
IW, IH = 500, 529
ZT, WF = 1.932, 2.074
# (x, y, z) com chaves das incognitas -> pixel. y=0 e a parede (fundo); frente em -D.
PTS = [(("-W", "-Da", "ZT"), (84, 6)), (("-W", 0, "ZT"), (42, 22)), (("+W", "-Da", "ZT"), (412, 71)),
       (("-W", "-Db", "Zb"), (95, 468)), (("-W", 0, "Zb"), (43, 452)), (("+W", "-Db", "Zb"), (428, 417))]
LINHA = [(42, 120), (42, 380)]                  # aresta de tras-esquerda (vertical): x=-W/2, y=0
K = ["Da", "Db", "Zb"]

def rot(g):
    c, s = np.cos(g), np.sin(g)
    Rz = np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
    Rx = np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]])
    return Rz @ Rx

def proj(p, P):
    C, g, f, cx, cy = p[0:3], p[3], p[4], p[5], p[6]
    c = rot(g).T @ (np.asarray(P, float) - C)
    return np.array([cx + f * c[0] / -c[2], cy - f * c[1] / -c[2]])

def val(v, d):
    if isinstance(v, (int, float)): return v
    sg = -1 if v[0] == "-" else 1
    k = v.lstrip("+-")
    if k == "ZT": return ZT
    if k == "W": return sg * WF / 2
    return sg * (d[k] / 2 if k == "W" else d[k])

def res(p):
    d = dict(zip(K, p[7:])); d["W"] = WF
    r = []
    for P, uv in PTS:
        r.extend(proj(p, [val(v, d) for v in P]) - uv)
    a, b = proj(p, (-d["W"] / 2, 0, 0.3)), proj(p, (-d["W"] / 2, 0, 1.8))
    t = (b - a) / np.linalg.norm(b - a)
    for uv in LINHA:
        v = np.asarray(uv) - a
        r.append(v[0] * t[1] - v[1] * t[0])
    return np.array(r)

p0 = np.array([-1.2, -3.5, 1.0, np.radians(-20), 600, IW / 2, IH / 2, 0.30, 0.41, 0.15])
s = least_squares(res, p0)
p = s.x; r = res(p)
print("rms px %.2f max %.2f" % (np.sqrt((r ** 2).mean()), np.abs(r).max()))
print("residuos", np.round(r, 1))
d = dict(zip(K, p[7:])); d["W"] = WF; print({k: round(v, 3) for k, v in d.items()})
f, cx, cy = p[4], p[5], p[6]
out = {"location": p[0:3].tolist(), "rotation_euler": [np.pi / 2, 0.0, p[3]], "lens_mm_sensor36": f / IW * 36,
       "shift_x": (IW / 2 - cx) / max(IW, IH), "shift_y": (cy - IH / 2) / max(IW, IH), "res": [IW, IH],
       "medidas": {**d, "ZT": ZT}, "f": f, "cx": cx, "cy": cy}
print(json.dumps(out, indent=1))
json.dump(out, open("cozinha/camera.json", "w"), indent=1)

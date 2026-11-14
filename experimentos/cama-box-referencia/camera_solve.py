"""Casa a camera do Blender com a foto: cantos da cama medidos a mao na referencia
(pixels) + medida padrao de cama box casal (1,38 x 1,88). Alturas sao incognitas."""
import json, numpy as np
from scipy.optimize import least_squares

W, L = 1.38, 1.88
IW, IH = 605, 595
# (x, y, chave-da-altura) -> pixel observado
PTS = [((-W/2, -L/2, "zf"), (52, 405)), ((W/2, -L/2, "zf"), (462, 522)),
       ((-W/2, -L/2, "zb"), (51, 331)), ((W/2, -L/2, "zb"), (468, 423)),
       ((-W/2, -L/2, "zm"), (51, 268)), ((W/2, -L/2, "zm"), (472, 328)),
       ((-W/2, -L/2, "zt"), (51, 248)), ((W/2, -L/2, "zt"), (476, 300)),
       ((W/2, L/2, "zf"), (558, 272)), ((W/2, L/2, "zt"), (563, 158)),
       ((0.0, -L/2, "zf"), (238, 459))]
# borda de cima do lado esquerdo: x=-W/2, z=zt, y livre
LINHA = [(150, 208), (200, 192), (300, 157)]
ZF = 0.05                                   # pe do box: fixa o zero da altura
H = ["zb", "zm", "zt"]

def rot(a, b, g):
    ca, sa, cb, sb, cg, sg = np.cos(a), np.sin(a), np.cos(b), np.sin(b), np.cos(g), np.sin(g)
    Rx = np.array([[1, 0, 0], [0, ca, -sa], [0, sa, ca]])
    Ry = np.array([[cb, 0, sb], [0, 1, 0], [-sb, 0, cb]])
    Rz = np.array([[cg, -sg, 0], [sg, cg, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx                     # rotation_euler XYZ do Blender

def proj(p, P):
    # NIVELADA: a foto tem as verticais retas (correcao de perspectiva de foto de
    # produto). Com a camera inclinada o canto esquerdo saia torto 34 px. O
    # enquadramento pra baixo vem do SHIFT (centro otico fora do meio), nao do pitch.
    C, g, f, cx, cy = p[0:3], p[3], p[4], p[5], p[6]
    c = rot(np.pi / 2, 0.0, g).T @ (np.asarray(P) - C)
    return np.array([cx + f * c[0] / -c[2], cy - f * c[1] / -c[2]])

def res(p):
    hz = dict(zip(H, p[7:10]), zf=ZF)
    r = []
    for (x, y, k), uv in PTS:
        r.extend(proj(p, (x, y, hz[k])) - uv)
    a, b = proj(p, (-W/2, -1.0, hz["zt"])), proj(p, (-W/2, 1.0, hz["zt"]))
    d = (b - a) / np.linalg.norm(b - a)
    for uv in LINHA:
        v = np.asarray(uv) - a
        r.append(v[0] * d[1] - v[1] * d[0])  # distancia do ponto a reta projetada
    return np.array(r)

p0 = np.array([1.0, -2.5, 1.2, np.radians(25), 650, IW / 2, IH / 2 - 150,
               0.38, 0.62, 0.70])
s = least_squares(res, p0)
p = s.x
r = res(p)
print("rms px %.2f  max %.2f" % (np.sqrt((r ** 2).mean()), np.abs(r).max()))
print("residuos", np.round(r, 1))
f, cx, cy = p[4], p[5], p[6]
out = {"location": list(p[0:3]), "rotation_euler": [np.pi / 2, 0.0, p[3]], "focal_px": f,
       "lens_mm_sensor36": f / IW * 36.0,
       # shift do Blender e fracao da MAIOR dimensao do quadro
       "shift_x": (IW / 2 - cx) / max(IW, IH), "shift_y": (cy - IH / 2) / max(IW, IH), "alturas": dict(zip(H, p[7:10]), zf=ZF), "W": W, "L": L}
print(json.dumps(out, indent=1))
json.dump(out, open("camera.json", "w"), indent=1)

"""Camera da cama de madeira (517 x 377). Sem catalogo: queen (colchao 1,58 x 1,98), estrutura 1,66 x 2,08,
cabeceira 1,05. Na foto a borda de cima da cabeceira e a de baixo do pe da cama sao HORIZONTAIS: camera
nivelada e olhando ao longo da cama (giro 0), deslocada pra direita -- o eixo da cama converge no centro
otico. Cabeceira (face da frente) em y = 0, pe da cama em -FL. Incognita extra: altura do fundo da estrutura."""
import json, numpy as np
from scipy.optimize import least_squares
IW, IH = 517, 377
FW, FL, HBH = 1.66, 2.08, 1.05
PTS = [((-FW / 2, 0.0, HBH), (51, 69)), ((FW / 2, 0.0, HBH), (300, 69)),
       ((-FW / 2, -FL, "zr"), (197, 296)), ((-FW / 2 + 0.06, -FL + 0.06, 0.0), (209, 336))]
def proj(p, P):                                  # giro 0, nivelada: olha +y
    C, f, cx, cy = p[0:3], p[3], p[4], p[5]
    d = np.asarray(P, float) - C
    return np.array([cx + f * d[0] / d[1], cy - f * d[2] / d[1]])
def res(p):
    return np.concatenate([proj(p, (x, y, p[6] if z == "zr" else z)) - uv for (x, y, z), uv in PTS])
best = None
for f0 in (300, 600, 1000):
    s = least_squares(res, [0.8, -3.5, 1.1, f0, 0, 100, 0.15], bounds=([-3, -12, 0.3, 100, -2000, -1000, 0.03], [4, -2.2, 3, 5000, 2000, 1000, 0.4]))
    r = res(s.x)
    if best is None or (r ** 2).sum() < best[1]:
        best = (s.x, (r ** 2).sum(), r)
p, _, r = best
print("rms %.2f max %.2f cam %s f %.0f cx %.0f cy %.0f zr %.3f" % (np.sqrt((r**2).mean()), abs(r).max(), p[:3].round(2), p[3], p[4], p[5], p[6]), np.round(r, 1))
json.dump({"location": p[:3].tolist(), "rotation_euler": [np.pi / 2, 0.0, 0.0], "res": [IW, IH], "f": p[3], "cx": p[4], "cy": p[5],
           "medidas": {"FW": FW, "FL": FL, "HBH": HBH, "zr": p[6]}}, open("cama-madeira/camera.json", "w"), indent=1)

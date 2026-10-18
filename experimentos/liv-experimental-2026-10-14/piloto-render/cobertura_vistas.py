"""Mapa de cobertura das vistas de treino x vistas do Tour (roda no Blender, em -b).

Pergunta: o que o visitante vê no Tour foi visto por câmeras suficientes do treino do splat daquele cômodo?
1. amostra as superfícies do apartamento (área ponderada) e conta, por splat, quantas câmeras de treino
   veem cada ponto (no quadro, sem nada na frente);
2. percorre as rotas do Tour (e, com --grade, toda posição livre; olho a 1,62 m, 8 rumos), lança uma grade
   de raios por vista e mede a fração da imagem que cai em ponto com menos de --minimo vistas no splat que o
   Tour mostra ali ("cego") e em cada um dos outros splats ("cego_se_fosse", para escolher zonas).

blender -b nuvem/apto-empacotado.blend --python cobertura_vistas.py -- --rotas rotas.json --saida pasta
    [nome=transforms.json[@zona] ...] [--mesmo comodo=conjunto,...] [--poligonos zonas-do-tour.json] [--grade 0.3] [--densidade 150] [--minimo 3]
Sem --treino, usa os conjuntos publicados (nuvem/comodos.sh + recaptura dos banheiros).
"""
import bpy, json, math, os, sys, time
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(nome, padrao=None):
    return argv[argv.index(nome) + 1] if nome in argv else padrao
AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = arg("--saida", "cobertura"); os.makedirs(SAIDA, exist_ok=True)
DENS = float(arg("--densidade", "150"))       # pontos por m²
MINIMO = int(arg("--minimo", "3"))
ALCANCE = 7.0                                  # além disso o detalhe já não vem da câmera

# Zonas do treino por cômodo (iguais a nuvem/comodos.sh e interior-splat.js), espaço do Blender.
ZONAS = {
    "sala":         lambda x, y: x < -0.3 and y < 1.25 and not (x > -1.9 and y > -0.26),
    "varanda":      lambda x, y: x < -1.9 and y >= 1.25,
    "quarto":       lambda x, y: -1.9 <= x < 0.35 and y > -0.26,
    "banho-suite":  lambda x, y: 0.9 <= x < 2.18 and y > -0.15,
    "banho-social": lambda x, y: -0.1 <= x < 2.18 and y < -1.3,
    "suite":        lambda x, y: x >= 2.18,
}
sys.path.insert(0, AQUI); from planta import carregar, dentro
# Qual splat o Tour mostra em cada posição: os retângulos acima, ou --poligonos (JSON nome -> [[x, y], ...],
# o TOUR_REGIONAL_POLYGONS publicado). Primeira zona que contém, na ordem do arquivo, como o Tour.
if arg("--poligonos"):
    POLI = json.load(open(arg("--poligonos"), encoding="utf-8"))
    TOUR = {n: (lambda x, y, p=p: dentro((x, y), p)) for n, p in POLI.items()}
else:
    TOUR = ZONAS
def zona(x, y):
    return next((n for n, f in TOUR.items() if f(x, y)), None)

nuvem = os.path.join(AQUI, "nuvem")
treinos = [a.split("=", 1) for a in argv if "=" in a and not a.startswith("--")]
if not treinos:   # o publicado: quatro cômodos da captura geral, banheiros da recaptura densa
    treinos = [(n, f"{nuvem}/captura-apto/transforms.json@{n}") for n in ("sala", "varanda", "quarto", "suite")]
    treinos += [("banho-suite", f"{nuvem}/captura-banho-suite/transforms.json"),
                ("banho-social", f"{nuvem}/captura-banho-social/transforms.json")]
CAMS = {}
for nome, fonte in treinos:
    caminho, _, filtro = fonte.partition("@")
    if not os.path.exists(caminho):
        print("SEM DADOS", nome, caminho, flush=True); CAMS[nome] = None; continue
    t = json.load(open(caminho))
    m = [np.array(f["transform_matrix"]) for f in t["frames"]]
    if filtro: m = [x for x in m if ZONAS[filtro](x[0, 3], x[1, 3])]
    CAMS[nome] = {"m": np.array(m), "fx": t["fl_x"], "fy": t["fl_y"], "w": t["w"], "h": t["h"]}
    print("TREINO", nome, len(m), flush=True)

# Cena: uma BVH só com as malhas visíveis no render.
dg = bpy.context.evaluated_depsgraph_get()
tris, verts = [], []
for ob in bpy.context.scene.objects:
    if ob.type != "MESH" or ob.hide_render: continue
    ev = ob.evaluated_get(dg); me = ev.to_mesh(); me.calc_loop_triangles()
    base = len(verts); mw = ob.matrix_world
    verts += [tuple(mw @ v.co) for v in me.vertices]
    tris += [tuple(base + i for i in lt.vertices) for lt in me.loop_triangles]
    ev.to_mesh_clear()
bvh = BVHTree.FromPolygons(verts, tris)
V = np.array(verts); T = np.array(tris)
print("CENA", len(V), "vertices", len(T), "triangulos", flush=True)

# Superfícies dentro do apartamento: centro da caixa das zonas com folga de parede.
comodos = (json.loads(bpy.context.scene["liv_comodos"]) if "liv_comodos" in bpy.context.scene
           else carregar(os.path.join(AQUI, "..", "interiores", "meio", "unidade.json")).comodos)
xy = np.array([v for c in comodos for v in c["poly"]])
X0, Y0 = xy.min(0) - 0.2; X1, Y1 = xy.max(0) + 0.2
rng = np.random.default_rng(7)
a, b, c = V[T[:, 0]], V[T[:, 1]], V[T[:, 2]]
n = np.cross(b - a, c - a); area = np.linalg.norm(n, axis=1) / 2
cen = (a + b + c) / 3
ok = (area > 1e-6) & (cen[:, 0] > X0) & (cen[:, 0] < X1) & (cen[:, 1] > Y0) & (cen[:, 1] < Y1) & (cen[:, 2] < 2.8)
quantos = rng.poisson(area[ok] * DENS)
idx = np.repeat(np.nonzero(ok)[0], quantos)
r1, r2 = rng.random(len(idx)), rng.random(len(idx))
s = np.sqrt(r1)
P = (1 - s)[:, None] * a[idx] + (s * (1 - r2))[:, None] * b[idx] + (s * r2)[:, None] * c[idx]
N = n[idx] / np.linalg.norm(n[idx], axis=1, keepdims=True)
print("AMOSTRAS", len(P), "area", round(float(area[ok].sum()), 1), "m2", flush=True)

def visivel(origem, alvos, normais):
    """alvos vistos de origem sem obstrução; aceita os dois lados da face (normal pode estar invertida)."""
    out = np.zeros(len(alvos), bool); o = Vector(origem)
    for i, (p, nn) in enumerate(zip(alvos, normais)):
        d = Vector(p) - o; L = d.length
        if L < 0.05: continue
        d /= L
        if abs(d.dot(Vector(nn))) < 0.08: continue          # rasante: não dá textura
        hit = bvh.ray_cast(o, d, L + 0.02)
        out[i] = hit[0] is None or hit[3] >= L - 0.02
    return out

# 1. Cobertura por splat
cont = {}
t0 = time.time()
for nome, cam in CAMS.items():
    if cam is None: continue
    k = np.zeros(len(P), np.int32)
    for m in cam["m"]:
        R, o = m[:3, :3], m[:3, 3]
        q = (P - o) @ R                       # câmera OpenGL: olha para -z
        z = -q[:, 2]
        with np.errstate(divide="ignore", invalid="ignore"):
            u = cam["fx"] * q[:, 0] / z + cam["w"] / 2; v = cam["fy"] * q[:, 1] / z + cam["h"] / 2
        cand = np.nonzero((z > 0.05) & (z < ALCANCE) & (u >= 0) & (u < cam["w"]) & (v >= 0) & (v < cam["h"]))[0]
        k[cand[visivel(o, P[cand], N[cand])]] += 1
    cont[nome] = k
    print("COBERTURA", nome, len(cam["m"]), "vistas", round(time.time() - t0), "s", flush=True)

# --mesmo "varanda=denso,banho-suite=denso": cômodos que o Tour desenha com um modelo de outro conjunto
for par in filter(None, (arg("--mesmo") or "").split(",")):
    comodo, conjunto = par.split("=")
    cont[comodo] = cont[conjunto]

# 2. Vistas do Tour: rotas em three (x, z) -> Blender (x, -z), olho 1,62 m, vertical 48°, 16:9
kd = KDTree(len(P))
for i, p in enumerate(P): kd.insert(p, i)
kd.balance()
rotas = json.load(open(arg("--rotas")))
VF = math.radians(48); GX, GY = 48, 27
fy = (GY / 2) / math.tan(VF / 2)
pontos = []
for r in rotas:
    path = [(x, -z) for x, z in r["path"]]
    for (x0, y0), (x1, y1) in zip(path, path[1:]):
        L = math.hypot(x1 - x0, y1 - y0); passos = max(1, int(L / 0.3))
        pontos += [(x0 + (x1 - x0) * t / passos, y0 + (y1 - y0) * t / passos, r["name"]) for t in range(passos + 1)]
# --grade 0.3: além das rotas, toda posição livre (o visitante anda pelas setas por onde quiser): dentro de
# um cômodo e a 0,3 m de parede e móvel (raio da navegação do Tour), conferido por raios a 0,5 e 1,2 m.
if arg("--grade"):
    passo = float(arg("--grade"))
    def livre(x, y):
        return all(bvh.ray_cast(Vector((x, y, h)), Vector((math.cos(a), math.sin(a), 0)), 0.3)[0] is None
                   for h in (0.5, 1.2) for a in np.linspace(0, 2 * math.pi, 12, endpoint=False))
    for gx in np.arange(X0, X1, passo):
        for gy in np.arange(Y0, Y1, passo):
            if any(dentro((gx, gy), c["poly"]) for c in comodos) and livre(gx, gy):
                pontos.append((float(gx), float(gy), "grade"))
# visto[i] = menor contagem com que o Tour mostra a amostra i (-1: o Tour não a vê em splat)
visto = np.full(len(P), -1); vistos_por_splat = {}
vistas = []
for x, y, rota in pontos:
    if any(abs(x - v["pos"][0]) < 0.05 and abs(y - v["pos"][1]) < 0.05 for v in vistas): continue
    z = zona(x, y)
    for k in range(8):
        yaw = k * math.pi / 4
        f = Vector((math.cos(yaw), math.sin(yaw), 0)); rgt = Vector((math.sin(yaw), -math.cos(yaw), 0)); up = Vector((0, 0, 1))
        o = Vector((x, y, 1.62)); cegos = total = 0; cegos_de = dict.fromkeys(cont, 0)
        for j in range(GY):
            for i in range(GX):
                d = (f + rgt * ((i + .5 - GX / 2) / fy) + up * ((GY / 2 - j - .5) / fy)).normalized()
                hit = bvh.ray_cast(o, d, 30)
                if hit[0] is None: continue
                total += 1
                _, idp, dist = kd.find(hit[0])
                if dist <= 0.15:
                    for nm in cont: cegos_de[nm] += int(cont[nm][idp] < MINIMO)
                if z is None or z not in cont: cegos += 1; continue
                if dist > 0.15: continue
                c = int(cont[z][idp]); visto[idp] = c if visto[idp] < 0 else min(visto[idp], c)
                vistos_por_splat.setdefault(z, set()).add(idp)
                if c < MINIMO: cegos += 1
        vistas.append({"pos": [round(x, 3), round(y, 3)], "yaw_graus": k * 45, "rota": rota, "splat": z,
                       "cego": round(cegos / max(total, 1), 4),
                       "cego_se_fosse": {nm: round(c / max(total, 1), 4) for nm, c in cegos_de.items()}})
zP = np.array([zona(x, y) or "" for x, y in P[:, :2]])
np.savez_compressed(os.path.join(SAIDA, "amostras.npz"), P=P, N=N, zona=zP, visto=visto, **{f"n_{k}": v for k, v in cont.items()})
json.dump({"minimo": MINIMO, "densidade": DENS, "treinos": {k: (None if v is None else len(v["m"])) for k, v in CAMS.items()},
           "por_splat": {nm: {"amostras_vistas_no_tour": len(ids),
                              "cego": round(float(np.mean([cont[nm][i] < MINIMO for i in ids])), 4)}
                         for nm, ids in vistos_por_splat.items()},
           "vistas": vistas}, open(os.path.join(SAIDA, "cobertura.json"), "w"), ensure_ascii=False, indent=1)
print("FIM", len(vistas), "vistas do Tour", round(time.time() - t0), "s", flush=True)

"""Camiseta pelo molde (teste da skill roupas).
Uso: blender -b --python camiseta.py -- <pasta> [quadros]
Le manequim.blend e medidas.json; grava camiseta.blend, molde.svg e vistas *.png.
"""
import bpy, bmesh, json, math, sys
from mathutils import Vector, geometry

args = sys.argv[sys.argv.index("--") + 1:]
pasta = args[0]
QUADROS = int(args[1]) if len(args) > 1 else 240
S = float(args[2]) if len(args) > 2 else 1.0   # passo da malha (cm): 2 trabalhando, 1 no final (CLO)
FASE1 = 120                                   # costura + assentar na pose T
bpy.ops.wm.open_mainfile(filepath=f"{pasta}/manequim.blend")
M = json.load(open(f"{pasta}/medidas.json"))
cena = bpy.context.scene
corpo = bpy.data.objects["manequim"]

# ---------------- molde (cm), metade direita, x = 0 no centro -------------
FOLGA_BUSTO = 8.0                      # malha solta: +8 cm no contorno
Q = (M["busto_cm"] + FOLGA_BUSTO) / 4  # 1/4 do contorno (skill 1)
L = 64.0                               # ponto do pescoco ate a barra
NW = 8.0                               # meia largura do decote
SW = 19.0                              # meia largura de ombro
CAIDA = 3.0                            # caida do ombro (2 a 4 cm)
YU = L - 23.0                          # fundo da cava (camiseta: ~22-24 cm abaixo do ombro)


def bez(p0, c, p1, n=64):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0],
             (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1])
            for t in (i / n for i in range(n + 1))]


def comprimento(pts):
    return sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))


def reamostra(pts, n):
    """n pontos igualmente espacados (comprimento de arco) na polilinha."""
    acum = [0.0]
    for i in range(len(pts) - 1):
        acum.append(acum[-1] + math.dist(pts[i], pts[i + 1]))
    tot, out, j = acum[-1], [], 0
    for k in range(n):
        alvo = tot * k / (n - 1)
        while j < len(pts) - 2 and acum[j + 1] < alvo:
            j += 1
        seg = acum[j + 1] - acum[j] or 1
        t = (alvo - acum[j]) / seg
        out.append((pts[j][0] + t * (pts[j + 1][0] - pts[j][0]),
                    pts[j][1] + t * (pts[j + 1][1] - pts[j][1])))
    return out


def n_pontos(*polys):
    return max(3, round(max(comprimento(p) for p in polys) / S) + 1)


def segmentos_corpo(prof_decote, recuo_cava):
    """Trechos da metade direita, como polilinhas densas."""
    gola = bez((0, L - prof_decote), (NW, L - prof_decote), (NW, L))  # chega em angulo reto no centro
    ombro = [(NW, L), (SW, L - CAIDA)]
    cava = bez((SW, L - CAIDA), (SW - recuo_cava, YU), (Q, YU))
    lado = [(Q, YU), (Q, 0)]
    barra = [(Q, 0), (0, 0)]
    return dict(gola=gola, ombro=ombro, cava=cava, lado=lado, barra=barra)


frente = segmentos_corpo(9.0, 2.0)    # decote da frente bem mais baixo
costas = segmentos_corpo(2.5, 1.0)    # cava das costas menos cavada

# manga: largura = braco + folga; altura da copa ajustada ao tamanho da cava
W = M["braco_cm"] + 6.0
LM = 17.0          # comprimento da costura de baixo da manga
AFIL = 2.0         # afunila 2 cm de cada lado ate a barra
cava_tot = comprimento(frente["cava"]) + comprimento(costas["cava"])


def copa(H):
    return [(u, H * (0.5 + 0.5 * math.cos(2 * math.pi * u / W)))
            for u in (-W / 2 + W * i / 128 for i in range(129))]


lo, hi = 1.0, 40.0
for _ in range(60):                    # copa = cava (malha: sem folga na copa)
    H = (lo + hi) / 2
    if comprimento(copa(H)) < cava_tot:
        lo = H
    else:
        hi = H
cp = copa(H)
manga = dict(copa_a=list(reversed(cp[:65])),   # topo -> canto u<0
             copa_b=cp[64:],                   # topo -> canto u>0
             lado_a=[(-W / 2, 0), (-W / 2 + AFIL, -LM)],
             lado_b=[(W / 2, 0), (W / 2 - AFIL, -LM)],
             barra=[(-W / 2 + AFIL, -LM), (W / 2 - AFIL, -LM)])

# mesmo numero de pontos nos dois lados de cada costura (piquetes casam)
N = {"ombro": n_pontos(frente["ombro"], costas["ombro"]),
     "lado": n_pontos(frente["lado"], costas["lado"]),
     "cava_f": n_pontos(frente["cava"], manga["copa_a"]),
     "cava_c": n_pontos(costas["cava"], manga["copa_b"]),
     "manga_lado": n_pontos(manga["lado_a"])}
# a manga pode costurar qualquer metade da copa na frente: as duas cavas com o mesmo N
N["cava_f"] = N["cava_c"] = max(N["cava_f"], N["cava_c"])


def amostra_corpo(seg, cava_n):
    d = {"gola": reamostra(seg["gola"], n_pontos(seg["gola"])),
         "ombro": reamostra(seg["ombro"], N["ombro"]),
         "cava": reamostra(seg["cava"], cava_n),
         "lado": reamostra(seg["lado"], N["lado"]),
         "barra": reamostra(seg["barra"], n_pontos(seg["barra"]))}
    return d


def contorno_inteiro(d):
    """Espelha a metade: devolve pontos do contorno + indice de cada trecho (lado d/e)."""
    ordem = ["gola", "ombro", "cava", "lado", "barra"]
    pts, marc = [], {}
    for nome in ordem:                       # metade direita: centro-topo -> centro-baixo
        seg = d[nome]
        ini = len(pts) - (1 if pts else 0)
        if pts:
            seg = seg[1:]
        pts.extend(seg)
        marc[nome + "_d"] = list(range(ini, len(pts)))
    meio = [(-x, y) for (x, y) in reversed(pts[1:-1])]  # metade esquerda, sem repetir o centro
    base = len(pts)
    pts.extend(meio)
    n = len(pts)
    for nome in ordem:
        idx_d = marc[nome + "_d"]
        # espelho do indice i (0 < i < base-1) e n - i
        marc[nome + "_e"] = [(n - i) % n if 0 < i < base - 1 else i for i in idx_d]
    return pts, marc


def malha_peca(contorno):
    """Triangulacao uniforme: borda + grade interna (CDT do mathutils)."""
    nb = len(contorno)
    xs = [p[0] for p in contorno]
    ys = [p[1] for p in contorno]
    pts = list(contorno)

    def dist_seg(p, a, b):
        ax, ay = b[0] - a[0], b[1] - a[1]
        t = max(0.0, min(1.0, ((p[0] - a[0]) * ax + (p[1] - a[1]) * ay) / (ax * ax + ay * ay or 1)))
        return math.dist(p, (a[0] + t * ax, a[1] + t * ay))

    def dist_borda(p):
        return min(dist_seg(p, contorno[i], contorno[(i + 1) % nb]) for i in range(nb))

    y = min(ys) + S / 2
    linha = 0
    while y < max(ys):
        x = min(xs) + S / 2 + (S / 2 if linha % 2 else 0)
        while x < max(xs):
            # ponto dentro do poligono: paridade de cruzamentos
            c = False
            for i in range(nb):
                (x1, y1), (x2, y2) = contorno[i], contorno[(i + 1) % nb]
                if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
                    c = not c
            if c and dist_borda((x, y)) > 0.7 * S:
                pts.append((x, y))
            x += S
        y += S * 0.866
        linha += 1
    arestas = [(i, (i + 1) % nb) for i in range(nb)]
    vs, es, fs, ov, oe, of = geometry.delaunay_2d_cdt([Vector(p) for p in pts], arestas, [], 1, 1e-4, True)
    inv = {}
    for k, origs in enumerate(ov):
        for o in origs:
            inv[o] = k
    return [tuple(v) for v in vs], fs, inv


fa = amostra_corpo(frente, N["cava_f"])
ca = amostra_corpo(costas, N["cava_c"])
ma = {"copa_a": reamostra(manga["copa_a"], N["cava_f"]),
      "copa_b": reamostra(manga["copa_b"], N["cava_c"]),
      "lado_a": reamostra(manga["lado_a"], N["manga_lado"]),
      "lado_b": reamostra(manga["lado_b"], N["manga_lado"]),
      "barra": reamostra(manga["barra"], n_pontos(manga["barra"]))}

# contorno da manga: copa_a (canto a -> topo), copa_b (topo -> canto b), lado_b, barra (b->a), lado_a (sobe)
m_pts, m_marc = [], {}
seq = [("copa_a", list(reversed(ma["copa_a"]))), ("copa_b", ma["copa_b"]),
       ("lado_b", ma["lado_b"]), ("barra", list(reversed(ma["barra"]))), ("lado_a", list(reversed(ma["lado_a"])))]
for nome, seg in seq:
    ini = len(m_pts) - (1 if m_pts else 0)
    if m_pts:
        seg = seg[1:]
    m_pts.extend(seg)
    m_marc[nome] = list(range(ini, len(m_pts)))
m_pts.pop()                                    # ultimo == primeiro (canto a)
m_marc["lado_a"][-1] = 0
m_marc["copa_a"] = list(reversed(m_marc["copa_a"]))  # topo -> canto a
m_marc["lado_a"] = list(reversed(m_marc["lado_a"]))  # canto a -> barra
m_marc["barra"] = list(reversed(m_marc["barra"]))

f_pts, f_marc = contorno_inteiro(fa)
c_pts, c_marc = contorno_inteiro(ca)

# ---------------- svg do molde (conferencia visual) ----------------
def svg_poly(pts, dx, dy, cor):
    return '<polygon fill="none" stroke="%s" stroke-width="0.2" points="%s"/>' % (
        cor, " ".join(f"{x + dx:.2f},{-y + dy:.2f}" for x, y in pts))

svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="-5 -75 190 90" width="1900" height="900">',
       svg_poly(f_pts, 30, 0, "#c33"), svg_poly(c_pts, 90, 0, "#33c"),
       svg_poly(m_pts, 150, -40, "#3a3"),
       '<line x1="30" y1="-70" x2="30" y2="2" stroke="#999" stroke-width="0.15" stroke-dasharray="1"/>',
       '<text x="20" y="8" font-size="3">FRENTE (corte 1)</text><text x="80" y="8" font-size="3">COSTAS (corte 1)</text>',
       '<text x="138" y="-14" font-size="3">MANGA (corte 2)</text></svg>']
open(f"{pasta}/molde.svg", "w").write("\n".join(svg))

# ---------------- montagem 3D ----------------
Z0 = 0.86                         # barra (m) na posicao inicial
YF = M["meia_prof_peito_m"] + 0.08
OMBRO_X = 0.17


def posicao_corpo(x, y, lado):     # lado -1 frente, +1 costas
    return (x / 100, lado * YF, Z0 + y / 100)


R = W / 100 / (2 * math.pi) + 0.025


def posicao_manga(u, v, s):        # s = +1 braco direito, -1 esquerdo
    d = OMBRO_X + 0.035 + (H - v) / 100 * 0.9
    th = u / (W / 2) * math.pi * s     # topo da copa (u=0) em cima do braco
    return (s * d, -R * math.sin(th) * s, 1.40 + R * math.cos(th))


verts_plano, verts_3d, faces, mapas = [], [], [], {}


def adiciona(nome, contorno, pos, deslocamento):
    vs, fs, inv = malha_peca(contorno)
    base = len(verts_plano)
    for (x, y) in vs:
        verts_plano.append(((x + deslocamento[0]) / 100, (y + deslocamento[1]) / 100, 0))
        verts_3d.append(pos(x, y))
    faces.extend([tuple(base + i for i in f) for f in fs])
    mapas[nome] = {k: base + v for k, v in inv.items()}


adiciona("frente", f_pts, lambda x, y: posicao_corpo(x, y, -1), (0, 0))
adiciona("costas", c_pts, lambda x, y: posicao_corpo(x, y, +1), (70, 0))
adiciona("manga_d", m_pts, lambda u, v: posicao_manga(u, v, +1), (140, 0))
adiciona("manga_e", m_pts, lambda u, v: posicao_manga(u, v, -1), (200, 0))

# frente da manga = metade com y < 0 depois de vestida
def metade_da_frente(peca):
    ya = sum(verts_3d[mapas[peca][i]][1] for i in m_marc["copa_a"]) / len(m_marc["copa_a"])
    return ("copa_a", "copa_b") if ya < 0 else ("copa_b", "copa_a")


costuras = []


def costura(pa, ia, pb, ib):
    assert len(ia) == len(ib), (pa, pb, len(ia), len(ib))
    costuras.extend((mapas[pa][a], mapas[pb][b]) for a, b in zip(ia, ib))


for s in ("_d", "_e"):
    costura("frente", f_marc["ombro" + s], "costas", c_marc["ombro" + s])
    costura("frente", f_marc["lado" + s], "costas", c_marc["lado" + s])
for s, peca in (("_d", "manga_d"), ("_e", "manga_e")):
    mf, mc = metade_da_frente(peca)
    costura("frente", f_marc["cava" + s], peca, m_marc[mf])
    costura("costas", c_marc["cava" + s], peca, m_marc[mc])
    costura(peca, m_marc["lado_a"], peca, m_marc["lado_b"])

me = bpy.data.meshes.new("camiseta")
me.from_pydata(verts_plano, costuras, faces)
me.update()
ob = bpy.data.objects.new("camiseta", me)
cena.collection.objects.link(ob)
ob.shape_key_add(name="molde")                 # forma de repouso = molde plano
kb = ob.shape_key_add(name="vestida")
for i, co in enumerate(verts_3d):
    kb.data[i].co = co
kb.value = 1.0

col = corpo.modifiers.new("colisao", "COLLISION")
corpo.collision.thickness_outer = 0.0025       # skin offset ~2,5 mm (CLO)
corpo.collision.cloth_friction = 5

cl = ob.modifiers.new("pano", "CLOTH")
st = cl.settings
st.quality = 10
st.mass = 0.15                       # malha leve (jersey)
st.tension_stiffness = st.compression_stiffness = 8
st.shear_stiffness = 4
st.bending_stiffness = 0.2
st.air_damping = 1
st.use_sewing_springs = True
st.sewing_force_max = 6
st.rest_shape_key = me.shape_keys.key_blocks["molde"]
cc = cl.collision_settings
cc.collision_quality = 4
cc.distance_min = 0.0025
cc.use_self_collision = True
cc.self_distance_min = 0.0025
cl.point_cache.frame_start = 1
cl.point_cache.frame_end = QUADROS
cena.frame_start, cena.frame_end = 1, QUADROS
# gravidade desligada enquanto as costuras fecham
st.effector_weights.gravity = 0.0
st.effector_weights.keyframe_insert("gravity", frame=1)
st.effector_weights.keyframe_insert("gravity", frame=int(FASE1 * 0.45))
st.effector_weights.gravity = 1.0
st.effector_weights.keyframe_insert("gravity", frame=int(FASE1 * 0.7))
# pose final: bracos descem da pose T para a pose A depois que a roupa assentou
kpa = corpo.data.shape_keys.key_blocks["pose_A"]
kpa.value = 0.0
kpa.keyframe_insert("value", frame=FASE1 + 10)
kpa.value = 1.0
kpa.keyframe_insert("value", frame=min(QUADROS - 20, FASE1 + 80))

print("MOLDE", json.dumps({"Q": round(Q, 1), "W": round(W, 1), "H_copa": round(H, 1),
                           "cava_cm": round(cava_tot, 1), "pontos": N,
                           "vertices": len(verts_plano), "faces": len(faces),
                           "costuras": len(costuras)}), flush=True)

for f in range(1, QUADROS + 1):
    cena.frame_set(f)
    if f % 20 == 0:
        print("quadro", f, flush=True)

# congela o resultado
dg = bpy.context.evaluated_depsgraph_get()
final = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
fo = bpy.data.objects.new("camiseta_final", final)
cena.collection.objects.link(fo)
ob.hide_render = True
ob.hide_viewport = True
bm = bmesh.new()
bm.from_mesh(final)
bmesh.ops.delete(bm, geom=[e for e in bm.edges if not e.link_faces], context="EDGES")
# folga das costuras: distancia media entre pontos costurados
bm.to_mesh(final)
bm.free()
abertas = [(Vector(final.vertices[a].co) - Vector(final.vertices[b].co)).length
           for a, b in costuras if a < len(final.vertices) and b < len(final.vertices)]
print("COSTURA_ABERTA_MM", round(1000 * sum(abertas) / len(abertas), 1),
      "max", round(1000 * max(abertas), 1), flush=True)
for p in final.polygons:
    p.use_smooth = True
sub = fo.modifiers.new("suave", "SUBSURF")
sub.levels = sub.render_levels = 1
sol = fo.modifiers.new("espessura", "SOLIDIFY")
sol.thickness = 0.002

# ---------------- render das vistas ----------------
for o, cor in ((corpo, (0.75, 0.75, 0.75, 1)), (fo, (0.85, 0.25, 0.2, 1))):
    m = bpy.data.materials.new(o.name)
    m.diffuse_color = cor
    o.data.materials.append(m)
cena.render.engine = "BLENDER_WORKBENCH"
cena.display.shading.light = "STUDIO"
cena.display.shading.color_type = "MATERIAL"
cena.display.shading.show_shadows = True
cena.render.resolution_x, cena.render.resolution_y = 700, 800
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
cena.collection.objects.link(cam)
cena.camera = cam
cam.data.type = "ORTHO"
cam.data.ortho_scale = 1.3
alvo = Vector((0, 0, 1.15))
for nome, direcao in (("frente", (0, -1, 0.1)), ("lado", (1, 0, 0.1)), ("tres_quartos", (0.7, -0.7, 0.25)), ("costas", (0, 1, 0.1))):
    d = Vector(direcao).normalized()
    cam.location = alvo + d * 4
    cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    cena.render.filepath = f"{pasta}/vista_{nome}.png"
    bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=f"{pasta}/camiseta.blend")
print("FIM", flush=True)

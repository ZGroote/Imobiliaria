# -*- coding: utf-8 -*-
"""Cortina de ilhos (2 folhas, varao de 2,1 m a 2,42 m) da referencia 6, cinza quente.
Procedural e nao simulada: cortina de ilhos e uma onda em S presa nos ilhos (cada vao entre dois ilhos
bojuda pra frente ou pra tras, alternando), que solta e balanca mais perto do chao. UV em metro ao longo
do PANO (comprimento de arco), entao a trama nao estica na dobra.
    blender -b --factory-startup --python cortina/cena.py -- [saida.png]
Plano do varao em y = 0, parede em y = +0,12, chao z = 0."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import kit
from kit import caixa, material, luz
import bpy, bmesh, math
import numpy as np

C = kit.camera("cortina")
ZV = C["medidas"]["varao"]                     # centro dos ilhos
WEB = os.environ.get("WEB") == "1"          # malha do navegador: baixa na origem (decimar a dobra apertada a destruia)
TEC = material("tecido_cortina", (170, 155, 140), rough=0.92, tex="blackout", relevo=0.35, sheen=0.35, spec=0.25, duplo=WEB,
               tinta=kit.lin((176, 162, 148))[:3])
METAL = material("metal_varao", (185, 182, 175), rough=0.35, metal=1.0)


def folha(nome, x0, x1, ngrom, amp=0.055, topo=0.045, semente=1, nseg=None, nv=None):
    """Uma folha: `ngrom` ilhos de x0 a x1; onda de meia-volta entre ilhos, amplitude `amp`."""
    nseg, nv = nseg or (6 if WEB else 12), nv or (26 if WEB else 70)
    rng = np.random.default_rng(semente)
    L = x1 - x0
    p = L / (ngrom - 1)
    nu = (ngrom - 1) * nseg + 1
    H = ZV + topo
    k_amp = rng.uniform(0.8, 1.15, ngrom)            # cada dobra com bojo proprio
    fase = rng.uniform(0, 2 * np.pi, (ngrom, 2))
    s = np.linspace(0, L, nu)
    zs = np.linspace(H, 0.006, nv)
    P = np.zeros((nv, nu, 3))
    for j, z in enumerate(zs):
        solto = (1 - min(z, ZV) / ZV)                  # 0 no varao, 1 no chao
        t = s / p
        k = np.minimum(t.astype(int), ngrom - 2)
        a = amp * (k_amp[k] * (1 - 0.3 * solto) + 0.3 * solto * k_amp[k + 1]) * (1 + 0.25 * solto)
        # zigue-zague de ponta redonda (pano pesado: entre ilhos o pano e quase PLANO e vinca na ponta)
        tri = (2 / np.pi) * np.arcsin(np.sin(np.pi * t))
        y = a * (0.7 * tri + 0.3 * np.sin(np.pi * t))
        # balanco lateral da dobra (some no varao, cresce pro chao)
        dx = 0.008 * solto ** 2 * (np.sin(2 * np.pi * z / 1.9 + fase[k, 0]) + 0.5 * np.sin(2 * np.pi * z / 0.7 + fase[k, 1]))
        P[j, :, 0] = x0 + s + dx
        P[j, :, 1] = y
        P[j, :, 2] = z
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    vs = [[bm.verts.new(P[j, i]) for i in range(nu)] for j in range(nv)]
    # u = comprimento de arco ao longo da linha (o pano esticado), v = altura
    arco = np.concatenate([np.zeros((nv, 1)), np.cumsum(np.linalg.norm(np.diff(P, axis=1), axis=2), axis=1)], 1)
    for j in range(nv - 1):
        for i in range(nu - 1):
            f = bm.faces.new((vs[j][i], vs[j + 1][i], vs[j + 1][i + 1], vs[j][i + 1]))
            for l, (jj, ii) in zip(f.loops, ((j, i), (j + 1, i), (j + 1, i + 1), (j, i + 1))):
                l[uvl].uv = (arco[jj, ii], zs[jj])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = kit.obj(nome, kit.mesh_bm(nome, bm), [TEC])
    for pl in o.data.polygons:
        pl.use_smooth = True
    if not WEB:                                # no navegador: pano de uma face, material dupla-face
        sd = o.modifiers.new("esp", "SOLIDIFY")
        sd.thickness = 0.003
        ss = o.modifiers.new("sub", "SUBSURF")
        ss.levels = ss.render_levels = 1
    return [x0 + i * p for i in range(ngrom)]


def anel(nome, x, z, R=0.021, r=0.0055, seg=None, lado=None):
    seg, lado = seg or (10 if WEB else 14), lado or (5 if WEB else 6)
    bm = bmesh.new()
    an = []
    for a in range(seg):
        A = 2 * math.pi * a / seg
        c = [x + R * math.cos(A), 0.0, z + R * math.sin(A)]
        an.append([bm.verts.new((c[0] + r * math.cos(B) * math.cos(A), r * math.sin(B), c[2] + r * math.cos(B) * math.sin(A)))
                   for B in (2 * math.pi * b / lado for b in range(lado))])
    for a in range(seg):
        for b in range(lado):
            bm.faces.new((an[a][b], an[(a + 1) % seg][b], an[(a + 1) % seg][(b + 1) % lado], an[a][(b + 1) % lado]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    kit.uv_metro(bm, "x", nome)
    o = kit.obj(nome, kit.mesh_bm(nome, bm), [METAL])
    for pl in o.data.polygons:
        pl.use_smooth = True


# ABERTA=1: a cortina do app fica ABERTA (a janela aparece): as duas folhas em maco nas pontas do varao,
# os mesmos 8 ilhos apertados em 0,40 m e a dobra mais funda (o pano sobra).
if os.environ.get("ABERTA") == "1":
    ilhos = (folha("cortina_esq", -1.02, -0.62, 8, amp=0.085, semente=3) +
             folha("cortina_dir", 0.63, 1.03, 8, amp=0.085, semente=8))
else:
    ilhos = folha("cortina_esq", -1.02, -0.03, 8, semente=3) + folha("cortina_dir", 0.03, 1.03, 8, semente=8)
for k, x in enumerate(ilhos):
    anel("ilhos_%d" % k, x, ZV)
# varao passa pela parte de cima do ilhos (a cortina pendura nele)
caixa("varao", -1.12, 1.12, -0.0125, 0.0125, ZV + 0.004, ZV + 0.029, METAL, bevel=0.012, seg=4, veio="x")
for lado in (-1, 1):
    caixa("ponteira_%d" % lado, lado * 1.12 - 0.025, lado * 1.12 + 0.025, -0.025, 0.025, ZV - 0.008, ZV + 0.042, METAL, bevel=0.024, seg=5)
    caixa("suporte_%d" % lado, lado * 1.08 - 0.008, lado * 1.08 + 0.008, 0.0, 0.12, ZV + 0.008, ZV + 0.025, METAL, bevel=0.006)

# navegador: o pano subdividido passa de 90 mil tri por folha; decima e o relevo assado guarda o caimento
# (com WEB=1 a malha ja nasce baixa: sem tri_alvo)

# ------------------------------------------------------------------ sala
PAREDE = material("parede_creme", (240, 228, 210), rough=0.9)
CHAO = material("tapete_claro", (215, 205, 190), rough=1.0, sheen=0.4)
kit.amb(caixa("parede", -4, 4, 0.12, 0.2, 0, 3.2, PAREDE, bevel=0))
kit.amb(caixa("chao", -4, 4, -4, 0.12, -0.01, 0.0, CHAO, bevel=0))
luz("janela_esq", "AREA", (-2.4, -1.6, 1.8), 65, (1.0, 0.98, 0.95), 2.0, (0.0, 0.0, 1.2))
luz("frente", "AREA", (0.4, -3.2, 1.6), 35, (1.0, 0.97, 0.92), 3.0, (0.0, 0.0, 1.2))
luz("teto", "AREA", (0.0, -1.2, 3.0), 20, (1.0, 0.97, 0.92), 2.0, (0.0, -0.2, 0.0))
kit.mundo((235, 228, 218), 0.08)
kit.render(kit.saida_padrao("cortina"), (C["res"][0] * 2, C["res"][1] * 2), vista="Standard")

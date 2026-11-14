# -*- coding: utf-8 -*-
"""Cozinha compacta da referencia (aereo + balcao, adega, ripado, puxador de madeira).
Medidas: camera_cozinha.py (catalogo 207,4 x 193,2) + vista retificada (retifica.py), em cm.
    blender -b --factory-startup --python cozinha/cena.py -- [saida.png]"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import kit
from kit import caixa, material, luz
import bmesh, bpy, math
from mathutils import Vector

C = kit.camera("cozinha")
M = C["medidas"]
W, ZT, DA, DB = M["W"] * 100, M["ZT"] * 100, M["Da"] * 100, M["Db"] * 100   # cm
X0, X1 = -W / 2, W / 2
E = 1.8                     # chapa de MDP
F = 0.3                     # fresta entre frentes

MAD = material("madeira", tex="madeira_nature", rough=0.75, relevo=0.35, spec=0.3)
PUX = material("puxador", tex="madeira_nature", tinta=(1.18, 1.16, 1.12), rough=0.5, relevo=0.3)
GRAF = material("grafite", (53, 54, 56), rough=0.85, spec=0.2)   # melamina fosca: quase sem reflexo
PE = material("pe", (150, 136, 126), rough=0.45, metal=0.3)
VIDRO = material("garrafa", (28, 36, 26), rough=0.08)
PAREDE = material("parede", (226, 223, 218), rough=0.85)
JUNTA = material("junta", (90, 90, 90), rough=0.9)
PISO = material("piso", (165, 152, 139), rough=0.45)
MIOLO = material("miolo", (62, 48, 38), rough=0.9, spec=0.2)   # interior: so aparece pela fresta, e no escuro
JANELA = material("janela", (215, 225, 215), emissao=1.2)


def cx(nome, x0, x1, y0, y1, z0, z1, mat=MAD, **k):
    """caixa em cm (y: 0 = parede, frente negativa)."""
    return caixa(nome, x0 / 100, x1 / 100, y0 / 100, y1 / 100, z0 / 100, z1 / 100, mat, **k)


def frente(nome, x0, x1, z0, z1, y, mat=GRAF):
    """porta/gaveta: chapa de 1,8 com a face em y."""
    return cx(nome, x0, x1, y, y + E, z0, z1, mat, bevel=0.002)


def puxador(nome, x0, x1, zc, y, alto=2.3):
    return cx(nome, x0, x1, y - 2.0, y, zc - alto / 2, zc + alto / 2, PUX, bevel=0.003, seg=3, veio="x")


def ripado(nome, x0, x1, z0, z1, y, passo=1.8, sulco=0.45):
    """ripas verticais: fundo recuado + ripas com sulco entre elas."""
    cx(nome + "_fundo", x0, x1, y + 0.9, y + E, z0, z1, bevel=0)
    n = max(1, round((x1 - x0) / passo))
    p = (x1 - x0) / n
    for i in range(n):
        cx("%s_%d" % (nome, i), x0 + i * p + sulco / 2, x0 + (i + 1) * p - sulco / 2, y, y + 0.9, z0, z1,
           bevel=0.0015, veio="z")


def garrafa(nome, x, z, y0):
    """deitada, fundo pra frente (como na foto)."""
    bm = bmesh.new()
    perfil = [(0.0, 0.0), (3.5, 0.0), (3.6, 0.6), (3.6, 21.0), (2.6, 24.5), (1.4, 26.5), (1.4, 31.0), (0.0, 31.0)]
    seg = 16
    anel = []
    for r, t in perfil:
        anel.append([bm.verts.new((x / 100 + r / 100 * math.cos(2 * math.pi * k / seg), (y0 + t) / 100,
                                   z / 100 + r / 100 * math.sin(2 * math.pi * k / seg))) for k in range(seg)])
    for a, b in zip(anel, anel[1:]):
        for k in range(seg):
            bm.faces.new((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = kit.obj(nome, kit.mesh_bm(nome, bm), [VIDRO])
    for p in o.data.polygons:
        p.use_smooth = True
    return o


# ------------------------------------------------------------------ balcao
# medidas por perfil de luminancia (perfil.py/bordas.py) ao longo de linhas 3D na foto, em cm
ZB, ZC, ZT2 = 12.5, 83.7, 86.0                   # base, baixo do tampo, cima do tampo
YF = -DB                                         # face das frentes do balcao
cx("bal_lado_esq", X0, X0 + E, YF + E, 0, ZB, ZC, veio="z")    # frentes sobrepostas a lateral
cx("bal_pilar_dir", X1 - E, X1, YF + E, 0, ZB, ZC, veio="z")
cx("bal_base", X0 + E, X1 - E, YF + 2.5, 0, ZB, ZB + E, bevel=0)
cx("bal_miolo", X0 + E, X1 - E, YF + E, -0.6, ZB + E, ZC, MIOLO, bevel=0)   # o que a fresta mostra
cx("tampo", X0 - 0.5, X1 + 0.5, YF - 2.0, 0, ZC, ZT2, veio="x", bevel=0.002)
for i, (z0, z1) in enumerate(((68.0, 83.3), (52.3, 67.7), (13.5, 52.0))):
    frente("gaveta_%d" % i, X0, -46.3, z0, z1, YF)
for i, zc in enumerate((75.35, 59.25, 47.2)):
    puxador("pux_gaveta_%d" % i, -92.5, -57.5, zc, YF)
ripado("ripado_esq", -46.0, -29.0, 13.5, ZC, YF)
frente("porta_bal_esq", -28.7, 29.0, 14.5, 80.9, YF)
frente("porta_bal_dir", 29.3, 86.3, 14.5, 80.9, YF)
cx("travessa_bal", -29.0, 86.6, YF, YF + E, 81.2, ZC, veio="x")
puxador("pux_bal_esq", -16.5, 18.0, 76.2, YF, alto=2.6)
puxador("pux_bal_dir", 40.9, 75.3, 76.2, YF, alto=2.6)
ripado("ripado_dir", 86.6, X1, 13.5, ZC, YF)
for x in (-100.0, -46.0, 30.0, 99.0):
    for y in (YF + 3.0, -3.0):
        cx("pe_%d_%d" % (x, y), x - 1.8, x + 1.8, y - 1.8, y + 1.8, 0, ZB, PE, bevel=0.002)

# ------------------------------------------------------------------ aereo (z 86 .. 193,2)
Z0 = ZT2
YA = -DA
cx("aer_lado_esq", X0, X0 + E, YA + E, 0, Z0, ZT - 3.0, veio="z")
cx("aer_pilar_dir", 96.0, X1, YA, 0, Z0, ZT - 3.0, veio="z")
cx("aer_topo", X0, X1, YA, 0, ZT - 3.0, ZT, veio="x")
cx("aer_fundo", X0 + E, 96.0, -0.6, 0, Z0, ZT - 3.0, veio="x", bevel=0)
# coluna da esquerda: porta alta + nicho do micro-ondas
frente("porta_alta", X0, -49.3, 122.0, 190.0, YA)
puxador("pux_alta", -94.3, -60.2, 130.75, YA, alto=2.5)
cx("alta_miolo", X0 + E, -49.0, YA + E, -0.6, 122.0, ZT - 3.0, MIOLO, bevel=0)
cx("alta_base", X0 + E, -49.0, YA + E, -0.6, 120.2, 122.0, veio="x")
cx("div_a", -50.6, -49.0, YA + 0.5, -0.6, Z0, ZT - 3.0, veio="z")
cx("div_micro", -48.6, -47.0, YA, -0.6, Z0, 123.0, veio="z")
# adegas: tabuas medidas, garrafa deitada com o fundo pra frente
TAB = (145.8, 156.4, 166.4, 176.6)
for nome, a, b in (("adega_esq", -49.0, -33.9), ("adega_dir", 80.9, 96.0)):
    for k, z in enumerate(TAB):
        cx("%s_tabua_%d" % (nome, k), a, b, YA, -0.6, z, z + 1.6, veio="x")
        topo = TAB[k + 1] if k + 1 < len(TAB) else ZT - 3.0
        garrafa("%s_garrafa_%d" % (nome, k), (a + b) / 2, z + 1.6 + 3.7, YA + 2.5)
cx("div_b", -34.2, -32.4, YA + E, -0.6, 131.5, ZT - 3.0, veio="z")
cx("div_c", 80.0, 81.5, YA + E, -0.6, 131.5, ZT - 3.0, veio="z")
# armario das duas portas
frente("porta_aer_esq", -33.2, 23.6, 148.0, 190.0, YA)
frente("porta_aer_dir", 23.9, 80.6, 148.0, 190.0, YA)
puxador("pux_aer_esq", -20.6, 13.6, 151.0, YA, alto=2.2)
puxador("pux_aer_dir", 35.0, 69.5, 151.0, YA, alto=2.2)
cx("aer_miolo", -32.4, 80.0, YA + E, -0.6, 147.6, ZT - 3.0, MIOLO, bevel=0)
# nicho aberto (vasilhas): prateleira com testeira na frente, divisoria no meio
cx("div_nicho", 19.6, 21.2, YA, -0.6, 131.5, 145.8, veio="z")
cx("prateleira", -47.0, 96.0, YA, -0.6, 129.7, 131.5, veio="x")
cx("testeira", -47.0, 96.0, YA, YA + E, 123.0, 129.7, veio="x")

# ------------------------------------------------------------------ ambiente
kit.amb(cx("parede", -400, 400, 0.0, 3.0, 0, 300, PAREDE, bevel=0))
for z in (95.0, 190.0):
    kit.amb(cx("junta_%d" % z, -400, 400, -0.05, 0.0, z - 0.15, z + 0.15, JUNTA, bevel=0))
kit.amb(cx("rodape", -400, 400, -1.5, 0.0, 0, 8.0, PAREDE, bevel=0.001))
kit.amb(cx("piso", -600, 600, -600, 3.0, -1.0, 0.0, PISO, bevel=0))
kit.amb(cx("janela", 125, 260, -1.0, 0.5, 10, 260, JANELA, bevel=0))

# foto de produto: luz plana (lateral 154 x frente 165 na foto). Pesos achados por ablacao (uma luz
# desligada por vez, contribuicao medida na frente e na lateral) e resolvidos pro alvo da foto.
luz("janela_luz", "AREA", (2.2, -1.6, 1.4), 48, (1.0, 0.98, 0.95), 2.0, (0.0, -0.2, 1.0), tam_y=2.4)
luz("frente", "AREA", (-2.6, -3.4, 1.8), 187, (1.0, 0.97, 0.93), 4.0, (0.0, -0.2, 1.0))
luz("teto", "AREA", (0.0, -1.2, 2.9), 30, (1.0, 0.97, 0.92), 2.0, (0.0, -0.4, 0.0))
kit.mundo((228, 228, 232), 0.4)
# Standard e nao AgX: a foto de catalogo e CGI com curva sRGB -- o AgX levanta o escuro (grafite)
kit.render(kit.saida_padrao("cozinha"), (C["res"][0] * 2, C["res"][1] * 2), vista="Standard")

# -*- coding: utf-8 -*-
"""Geladeira French door (inox preto) da referencia: 83,6 x 186,4, duas portas + gaveta do freezer,
puxadores verticais de inox escovado e painel de vidro preto. Logo da marca fica de fora.
Frente quase ortografica: as medidas sao a escala de 292,4 px/m aplicada aos pixels da foto.
    blender -b --factory-startup --python geladeira/cena.py -- [saida.png]

O metal NAO tem cor propria visivel: e o reflexo do estudio. A foto tem softbox so a direita e
atras da camera (porta esquerda preta, direita cinza-marrom degrade de cima pra baixo); o estudio
aqui e esse: plano emissivo com degrade vertical atras da camera, so do lado direito."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import kit
from kit import caixa, material, luz
import bpy, bmesh, math
import numpy as np

C = kit.camera("geladeira")
M = C["medidas"]
PX = 292.4                                     # px por metro na frente
u2x = lambda u: (u - 164.0) / PX               # pixel da foto -> metro
v2z = lambda v: (570.0 - v) / PX
W, H, D = M["W"], M["H"], M["D"]
X0, X1 = -W / 2, W / 2
EP = 0.065                                     # espessura da porta

# com textura a cor vem da TINTA (a imagem do escovado e quase branca): F0 do metal = tinta x 0,92
INOX_PRETO = material("inox_preto", (88, 74, 64), rough=0.11, metal=1.0, tex="inox_escovado", relevo=0.008,
                      tinta=kit.lin((92, 77, 67))[:3])
INOX = material("inox", (228, 226, 222), rough=0.32, metal=1.0, tex="inox_escovado", relevo=0.05,
                tinta=kit.lin((236, 234, 230))[:3])
CORPO = material("corpo", (38, 36, 35), rough=0.5, metal=0.3)
VIDRO = material("vidro_painel", (3, 3, 4), rough=0.04, spec=0.02)
PE = material("pe_plastico", (160, 135, 90), rough=0.6)
VEDA = material("vedacao", (15, 15, 15), rough=0.8)
ICONE = material("icone", (200, 205, 210), emissao=0.6)

# ------------------------------------------------------------------ corpo, portas, gaveta
ZP, ZDIV = M["pe"], M["div"]
caixa("corpo", X0 + 0.003, X1 - 0.003, -D + EP + 0.004, -0.02, ZP + 0.005, H - 0.005, CORPO, bevel=0.004)
caixa("vedacao", X0 + 0.01, X1 - 0.01, -D + EP, -D + EP + 0.006, ZP + 0.01, H - 0.01, VEDA, bevel=0)
F = 0.002                                      # meia fresta
caixa("porta_esq", X0, -F, -D, -D + EP, ZDIV + F, H, INOX_PRETO, bevel=0.012, seg=4, veio="z")
caixa("porta_dir", F, X1, -D, -D + EP, ZDIV + F, H, INOX_PRETO, bevel=0.012, seg=4, veio="z")
caixa("gaveta", X0, X1, -D, -D + EP, ZP, ZDIV - F, INOX_PRETO, bevel=0.012, seg=4, veio="z")


# ------------------------------------------------------------------ puxadores (barra + 2 colunas)
def puxador(nome, xa, xb):
    za, zb = v2z(310), v2z(47)
    caixa(nome, xa, xb, -D - 0.055, -D - 0.030, za, zb, INOX, bevel=0.009, seg=4, veio="z")
    xm = (xa + xb) / 2
    for k, z in enumerate((za + 0.035, zb - 0.035)):
        caixa("%s_col%d" % (nome, k), xm - 0.012, xm + 0.012, -D - 0.031, -D + 0.002, z - 0.012, z + 0.012,
              INOX, bevel=0.006, seg=3, veio="y")


puxador("pux_esq", u2x(146), u2x(160))
puxador("pux_dir", u2x(168), u2x(182))

# ------------------------------------------------------------------ painel do dispenser (vidro preto)
px0, px1, pz0, pz1 = u2x(196), u2x(272), v2z(152), v2z(103)
caixa("painel", px0, px1, -D - 0.003, -D + 0.002, pz0, pz1, VIDRO, bevel=0.012, seg=4, veio="x")
for k, u in enumerate((222, 232, 242, 250, 258)):          # icones do painel (pontinhos da foto)
    x = u2x(u)
    caixa("icone_%d" % k, x - 0.003, x + 0.003, -D - 0.0035, -D - 0.0028, v2z(131.5), v2z(128.5), ICONE, bevel=0)

# ------------------------------------------------------------------ pes (cantos da frente)
for nome, xa, xb in (("pe_esq", u2x(42), u2x(68)), ("pe_dir", u2x(260), u2x(286))):
    caixa(nome, xa, xb, -D + 0.02, -D + 0.10, 0.0, ZP, PE, bevel=0.004)

# ------------------------------------------------------------------ estudio
# softbox atras da camera, so a direita, degrade vertical (medido na foto: coluna u=240)
ESTUDIO = bpy.data.materials.new("softbox")
nt = ESTUDIO.node_tree
for n in list(nt.nodes):
    nt.nodes.remove(n)
out = nt.nodes.new("ShaderNodeOutputMaterial")
em = nt.nodes.new("ShaderNodeEmission")
tc = nt.nodes.new("ShaderNodeTexCoord")
sep = nt.nodes.new("ShaderNodeSeparateXYZ")
rp = nt.nodes.new("ShaderNodeValToRGB")          # rampa: z do plano (0..1 = baixo..cima)
rp.color_ramp.elements[0].position, rp.color_ramp.elements[0].color = 0.30, (0, 0, 0, 1)
rp.color_ramp.elements[1].position, rp.color_ramp.elements[1].color = 0.80, (1.25, 1.18, 1.10, 1)
nt.links.new(tc.outputs["Generated"], sep.inputs[0])
nt.links.new(sep.outputs["Z"], rp.inputs["Fac"])
nt.links.new(rp.outputs["Color"], em.inputs["Color"])
em.inputs["Strength"].default_value = float(os.environ.get("SOFTBOX", "1.7"))
nt.links.new(em.outputs[0], out.inputs[0])
kit.MATS["softbox"] = dict(cor=[255, 245, 235], rough=1, metal=0, tex=None, tinta=[1, 1, 1], relevo=0, sheen=0, coat=0,
                           emissao=1.0, spec=0.5)
bm = bmesh.new()
for x, z in ((0.02, -1.5), (4.0, -1.5), (4.0, 4.5), (0.02, 4.5)):
    bm.verts.new((x, -9.0, z))
bm.faces.new(bm.verts)
sb = kit.obj("softbox", kit.mesh_bm("softbox", bm), [ESTUDIO])
sb.visible_camera = False
kit.amb(sb)
# teto claro (a borda de cima de cada porta/gaveta acende, como na foto)
kit.amb(caixa("teto_estudio", -3, 3, -6, 2, 3.4, 3.45, material("teto", (200, 200, 200), emissao=0.15), bevel=0))
bpy.data.objects["teto_estudio"].visible_camera = False

kit.mundo((0, 0, 0), 0.0)
S = kit.S
S.render.film_transparent = True               # a foto e recortada no branco
kit.render(kit.saida_padrao("geladeira"), (C["res"][0] * 2, C["res"][1] * 2), vista="Standard")

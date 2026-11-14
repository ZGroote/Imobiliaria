# -*- coding: utf-8 -*-
"""Fogao de piso 4 bocas, corpo preto e mesa inox (referencia 10). Logo da marca fica de fora.
Camera ORTOGRAFICA (camera_fogao.py): a foto e de lente longa. Medidas: largura/profundidade do ajuste
(42,8 x 47,5), mesa a 0,85; faixas da frente pelo perfil de luminancia no meio da frente (u=160).
    blender -b --factory-startup --python fogao-4b/cena.py -- [saida.png]
y = 0 no fundo, frente em -D; z = 0 no chao."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import kit
from kit import caixa, material, luz
import bpy, bmesh, math

C = kit.camera("fogao-4b")
M = C["medidas"]
W, D, ZT = M["W"], M["D"], M["zt"]
X0, X1, YF = -W / 2, W / 2, -D

PRETO = material("preto_brilho", (14, 14, 15), rough=0.15)
GRAF = material("grafite_lateral", (27, 27, 28), rough=0.45)
PAINEL = material("painel", (58, 58, 60), rough=0.35)
VIDRO = material("vidro_visor", (10, 10, 11), rough=0.05, coat=1.0, alpha=0.55)   # fume: a grade do forno aparece
FORNO = material("forno_dentro", (70, 68, 65), rough=0.6)
GRADE = material("grade_forno", (170, 170, 168), rough=0.3, metal=1.0)
INOX = material("inox_mesa", (220, 220, 218), rough=0.22, metal=1.0, tex="inox_escovado", relevo=0.01,
                tinta=kit.lin((230, 230, 228))[:3])
PUX = material("puxador_fogao", (120, 120, 122), rough=0.3, metal=0.8)
BOTAO = material("botao", (18, 18, 18), rough=0.35)
CROMO = material("cromo", (230, 230, 230), rough=0.08, metal=1.0)
GRELHA = material("grelha", (25, 25, 25), rough=0.5)
QUEIM = material("queimador", (30, 30, 30), rough=0.4)
PE = material("pe_fogao", (17, 17, 17), rough=0.5)

ZP = 0.113                                     # pes
# ------------------------------------------------------------------ corpo
caixa("lateral_esq", X0, X0 + 0.008, YF + 0.01, 0, ZP, ZT - 0.02, GRAF, bevel=0.003)
caixa("lateral_dir", X1 - 0.008, X1, YF + 0.01, 0, ZP, ZT - 0.02, GRAF, bevel=0.003)
caixa("fundo", X0, X1, -0.01, 0, ZP, ZT - 0.02, GRAF, bevel=0)
for k, y in enumerate((-0.30, -0.12)):          # vincos verticais da lateral (estampados)
    for lado, x in ((-1, X0 - 0.002), (1, X1 + 0.002)):
        caixa("vinco_%d_%d" % (k, lado), x - 0.002, x + 0.002, y - 0.006, y + 0.006, ZP + 0.06, ZT - 0.10, GRAF, bevel=0.002)
for nome, z0, z1 in (("miolo_baixo", ZP, 0.40), ("miolo_cima", 0.70, ZT - 0.02)):
    caixa(nome, X0 + 0.008, X1 - 0.008, YF + 0.02, -0.01, z0, z1, FORNO, bevel=0)
# frente, de cima pra baixo (faixas medidas)
caixa("painel_botoes", X0, X1, YF, YF + 0.02, 0.75, 0.83, PAINEL, bevel=0.004)
# porta = moldura vazada em volta do visor (maciça, a grade do forno nao aparece pelo vidro)
VX, VZ0, VZ1 = 0.165, 0.44, 0.66
for nome, a, b, z0, z1 in (("porta_esq", X0 + 0.002, -VX, 0.365, 0.745), ("porta_dir", VX, X1 - 0.002, 0.365, 0.745),
                           ("porta_cima", -VX, VX, VZ1, 0.745), ("porta_baixo", -VX, VX, 0.365, VZ0)):
    caixa(nome, a, b, YF - 0.012, YF + 0.01, z0, z1, PRETO, bevel=0.004, seg=2)
caixa("visor", -0.165, 0.165, YF - 0.0135, YF - 0.010, 0.44, 0.66, VIDRO, bevel=0.003)
# cavidade do forno: fundo, teto, piso e laterais (a grade fica DENTRO, visivel pelo vidro)
for nome, a, b, y0, y1, z0, z1 in (("forno_fundo", -VX, VX, -0.07, -0.06, 0.40, 0.70), ("forno_teto", -VX, VX, YF + 0.01, -0.06, 0.69, 0.70),
                                   ("forno_piso", -VX, VX, YF + 0.01, -0.06, 0.40, 0.41), ("forno_lado_e", -VX - 0.01, -VX, YF + 0.01, -0.06, 0.40, 0.70),
                                   ("forno_lado_d", VX, VX + 0.01, YF + 0.01, -0.06, 0.40, 0.70)):
    caixa(nome, a, b, y0, y1, z0, z1, FORNO, bevel=0)
for k, z in enumerate((0.47, 0.52)):           # grade do forno que aparece pelo visor
    for j in range(9):
        x = -0.15 + j * 0.0375
        caixa("grade_%d_%d" % (k, j), x - 0.0015, x + 0.0015, YF + 0.03, -0.08, z - 0.0015, z + 0.0015, GRADE, bevel=0)
    caixa("grade_borda_%d" % k, -0.155, 0.155, YF + 0.03, YF + 0.034, z - 0.002, z + 0.002, GRADE, bevel=0)
caixa("puxador", -0.18, 0.18, YF - 0.035, YF - 0.022, 0.688, 0.713, PUX, bevel=0.005, seg=3, veio="x")
for x in (-0.17, 0.17):
    caixa("pux_suporte_%d" % (x > 0), x - 0.01, x + 0.01, YF - 0.024, YF - 0.010, 0.692, 0.709, PUX, bevel=0.003)
caixa("gaveta", X0 + 0.002, X1 - 0.002, YF - 0.006, YF + 0.01, 0.215, 0.354, GRAF, bevel=0.004, seg=3)
caixa("rodape", X0 + 0.01, X1 - 0.01, YF + 0.01, YF + 0.03, ZP, 0.197, GRAF, bevel=0.003)


# botoes: 5 (posicoes da foto), cilindro preto com aro cromado
def cilindro(nome, x, z, y0, y1, r, mat, seg=24, eixo="y"):
    """eixo y: botao (x, z = centro; y0..y1 = profundidade). eixo z: queimador (x, z = centro em x,y; y0..y1 = altura)."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=y1 - y0)
    for v in bm.verts:
        v.co = ((v.co.x + x, v.co.z + (y0 + y1) / 2, v.co.y + z) if eixo == "y" else
                (v.co.x + x, v.co.y + z, v.co.z + (y0 + y1) / 2))
    bm.normal_update()
    kit.uv_metro(bm, None, nome)
    o = kit.obj(nome, kit.mesh_bm(nome, bm), [mat])
    m = o.modifiers.new("bevel", "BEVEL")
    m.width, m.segments, m.limit_method, m.harden_normals = 0.002, 2, "ANGLE", True
    for p in o.data.polygons:
        p.use_smooth = True
    return o


for k, x in enumerate((-0.136, -0.063, 0.013, 0.086, 0.159)):
    cilindro("botao_%d" % k, x, 0.792, YF - 0.026, YF, 0.026, BOTAO)
    cilindro("botao_aro_%d" % k, x, 0.792, YF - 0.0272, YF - 0.0262, 0.0215, CROMO)
    caixa("botao_pega_%d" % k, x - 0.004, x + 0.004, YF - 0.034, YF - 0.026, 0.775, 0.809, BOTAO, bevel=0.002)

# ------------------------------------------------------------------ mesa: inox, 4 queimadores, 2 grelhas
caixa("mesa", X0 - 0.003, X1 + 0.003, YF - 0.004, 0, ZT - 0.02, ZT, INOX, bevel=0.006, seg=3, veio="x")
caixa("encosto", X0, X1, -0.045, 0, ZT, ZT + 0.03, PRETO, bevel=0.006)        # dobradica da tampa
for i, (x, y, r) in enumerate(((-0.105, YF + 0.13, 0.038), (0.105, YF + 0.13, 0.030), (-0.105, -0.16, 0.030), (0.105, -0.16, 0.040))):
    cilindro("queimador_%d" % i, x, y, ZT, ZT + 0.012, r, QUEIM, eixo="z")
    cilindro("queimador_aro_%d" % i, x, y, ZT, ZT + 0.004, r + 0.012, CROMO, eixo="z")
for i, x0, x1 in ((0, X0 + 0.01, -0.005), (1, 0.005, X1 - 0.01)):              # grelha de ferro
    y0, y1 = YF + 0.02, -0.05
    for (a, b, c, d) in ((x0, x1, y0, y0 + 0.008), (x0, x1, y1 - 0.008, y1), (x0, x0 + 0.008, y0, y1), (x1 - 0.008, x1, y0, y1)):
        caixa("grelha_%d_%d_%d" % (i, round(a * 1000), round(c * 1000)), a, b, c, d, ZT + 0.018, ZT + 0.028, GRELHA, bevel=0.002)
    xm = (x0 + x1) / 2
    for yy in (YF + 0.13, -0.16):
        for dx in (-0.06, 0.06):
            caixa("dedo_%d_%d_%d" % (i, round(yy * 1000), round(dx * 1000)), xm + dx - 0.004, xm + dx + 0.004, yy - 0.07, yy + 0.07,
                  ZT + 0.018, ZT + 0.028, GRELHA, bevel=0.002)
# ------------------------------------------------------------------ pes (blocos nos cantos)
for nome, x0, x1, y0, y1 in (("pe_fe", X0 + 0.005, X0 + 0.115, YF + 0.02, YF + 0.10), ("pe_fd", X1 - 0.10, X1 - 0.005, YF + 0.02, YF + 0.10),
                             ("pe_te", X0 + 0.005, X0 + 0.115, -0.09, -0.01), ("pe_td", X1 - 0.10, X1 - 0.005, -0.09, -0.01)):
    caixa(nome, x0, x1, y0, y1, 0.0, ZP, PE, bevel=0.006, seg=3)

# ------------------------------------------------------------------ estudio (foto recortada no branco)
CHAO = material("chao_estudio", (145, 145, 145), rough=0.9)   # pega-sombra: so a sombra aparece; o rebatimento e o de um chao medio
chao = kit.amb(caixa("chao", -3, 3, -3, 3, -0.01, 0.0, CHAO, bevel=0))
chao.is_shadow_catcher = True                  # recorte branco da foto: do chao so a sombra
luz("chave", "AREA", (-1.6, -2.2, 2.4), 25, (1.0, 1.0, 1.0), 2.5, (0.0, -0.2, 0.5))
luz("preenche", "AREA", (1.8, -2.0, 1.2), 12, (1.0, 1.0, 1.0), 2.0, (0.0, -0.2, 0.5))
luz("topo", "AREA", (0.0, -0.3, 2.6), 220, (1.0, 1.0, 1.0), 3.0, (0.0, -0.2, 0.0))
# fundo branco de estudio atras e acima: e o que a mesa de inox espelha (so pro reflexo)
FUNDO = material("fundo_estudio", (255, 255, 255), emissao=0.6)
fundo = kit.amb(caixa("fundo_estudio", -3, 3, 1.2, 1.25, 0.6, 3.5, FUNDO, bevel=0))
fundo.visible_camera = fundo.visible_diffuse = fundo.visible_shadow = False
kit.mundo((255, 255, 255), 0.05)          # estudio escuro: o preto lustroso fica preto
kit.S.render.film_transparent = True
kit.render(kit.saida_padrao("fogao-4b"), (C["res"][0] * 2, C["res"][1] * 2), vista="Standard")

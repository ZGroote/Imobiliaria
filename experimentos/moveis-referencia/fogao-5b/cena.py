# -*- coding: utf-8 -*-
"""Fogao de piso 5 bocas com mesa de vidro preto (referencia 9). Logo da marca fica de fora.
Catalogo 75,5 x 92 x 64,3; camera e alturas em camera_fogao5.py (vidro a 0,79, pes 8,6 cm); faixas da
frente convertidas dos pixels da foto (557 px/m na vertical, 543 na horizontal).
    blender -b --factory-startup --python fogao-5b/cena.py -- [saida.png]
y = 0 no fundo, frente em -D; z = 0 no chao."""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import kit
from kit import caixa, material, luz
import bpy, bmesh

C = kit.camera("fogao-5b")
M = C["medidas"]
W, D, ZT, ZP = M["W"], M["D"], M["zt"], M["zp"]
X0, X1, YF = -W / 2, W / 2, -D

PRETO = material("preto_brilho_5b", (30, 30, 32), rough=0.2)
LADO = material("lateral_5b", (40, 40, 42), rough=0.3)
VIDRO = material("vidro_mesa", (6, 6, 7), rough=0.03, coat=1.0)
VISOR = material("vidro_visor_5b", (8, 8, 9), rough=0.05, coat=1.0, alpha=0.5)
FORNO = material("forno_dentro_5b", (60, 58, 55), rough=0.6)
GRADE = material("grade_forno_5b", (170, 170, 168), rough=0.3, metal=1.0)
FERRO = material("ferro_fundido", (28, 28, 28), rough=0.6)
CROMO = material("cromo_5b", (225, 225, 225), rough=0.08, metal=1.0)
LATAO = material("tampa_queimador", (40, 40, 40), rough=0.35)
BOTAO = material("botao_5b", (15, 15, 15), rough=0.3)
PE = material("pe_5b", (45, 45, 46), rough=0.5)


def cilindro(nome, x, y, z0, z1, r, mat, seg=24, r_cima=None):
    """eixo vertical: (x, y) centro, z0..z1."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r_cima is None else r_cima, depth=z1 - z0)
    for v in bm.verts:
        v.co = (v.co.x + x, v.co.y + y, v.co.z + (z0 + z1) / 2)
    bm.normal_update()
    kit.uv_metro(bm, None, nome)
    o = kit.obj(nome, kit.mesh_bm(nome, bm), [mat])
    m = o.modifiers.new("bevel", "BEVEL")
    m.width, m.segments, m.limit_method, m.harden_normals = 0.0015, 2, "ANGLE", True
    for p in o.data.polygons:
        p.use_smooth = True
    return o


# ------------------------------------------------------------------ corpo e frente (faixas da foto)
caixa("lateral_esq", X0, X0 + 0.008, YF + 0.01, 0, ZP, ZT - 0.006, LADO, bevel=0.003)
caixa("lateral_dir", X1 - 0.008, X1, YF + 0.01, 0, ZP, ZT - 0.006, LADO, bevel=0.003)
caixa("fundo", X0, X1, -0.01, 0, ZP, ZT - 0.006, LADO, bevel=0)
for nome, z0, z1 in (("miolo_baixo", ZP, 0.30), ("miolo_cima", 0.70, ZT - 0.006)):
    caixa(nome, X0 + 0.008, X1 - 0.008, YF + 0.02, -0.01, z0, z1, FORNO, bevel=0)
caixa("faixa_topo", X0, X1, YF, YF + 0.02, 0.750, ZT - 0.006, PRETO, bevel=0.003)
VX0, VX1, VZ0, VZ1 = -0.250, 0.269, 0.385, 0.610                     # visor
for nome, a, b, z0, z1 in (("porta_esq", X0 + 0.003, VX0, 0.301, 0.747), ("porta_dir", VX1, X1 - 0.003, 0.301, 0.747),
                           ("porta_cima", VX0, VX1, VZ1, 0.747), ("porta_baixo", VX0, VX1, 0.301, VZ0)):
    caixa(nome, a, b, YF - 0.014, YF + 0.01, z0, z1, PRETO, bevel=0.004, seg=2)
caixa("visor", VX0, VX1, YF - 0.0155, YF - 0.012, VZ0, VZ1, VISOR, bevel=0.003)
for nome, a, b, y0, y1, z0, z1 in (("forno_fundo", VX0, VX1, -0.07, -0.06, 0.30, 0.70), ("forno_teto", VX0, VX1, YF + 0.01, -0.06, 0.69, 0.70),
                                   ("forno_piso", VX0, VX1, YF + 0.01, -0.06, 0.30, 0.31), ("forno_lado_e", VX0 - 0.01, VX0, YF + 0.01, -0.06, 0.30, 0.70),
                                   ("forno_lado_d", VX1, VX1 + 0.01, YF + 0.01, -0.06, 0.30, 0.70)):
    caixa(nome, a, b, y0, y1, z0, z1, FORNO, bevel=0)
for k, z in enumerate((0.42, 0.50)):                                 # grade do forno, vista pelo vidro
    for j in range(13):
        x = VX0 + 0.02 + j * (VX1 - VX0 - 0.04) / 12
        caixa("grade_%d_%d" % (k, j), x - 0.0015, x + 0.0015, YF + 0.03, -0.08, z - 0.0015, z + 0.0015, GRADE, bevel=0)
    caixa("grade_borda_%d" % k, VX0 + 0.01, VX1 - 0.01, YF + 0.03, YF + 0.034, z - 0.002, z + 0.002, GRADE, bevel=0)
# puxador curvo embutido no alto da porta: barra que sobressai 2 cm, pontas curvando pra porta
caixa("puxador", -0.337, 0.361, YF - 0.036, YF - 0.016, 0.666, 0.700, PRETO, bevel=0.008, seg=4, veio="x")
for x in (-0.33, 0.354):
    caixa("pux_ponta_%d" % (x > 0), x - 0.012, x + 0.012, YF - 0.030, YF - 0.012, 0.664, 0.702, PRETO, bevel=0.006, seg=3)
caixa("gaveta", X0 + 0.003, X1 - 0.003, YF - 0.006, YF + 0.01, 0.095, 0.292, PRETO, bevel=0.004, seg=3)
for nome, x0, x1, y0, y1 in (("pe_fe", X0 + 0.0, X0 + 0.12, YF + 0.0, YF + 0.10), ("pe_fd", X1 - 0.12, X1 - 0.0, YF + 0.0, YF + 0.10),
                             ("pe_te", X0 + 0.0, X0 + 0.12, -0.10, 0.0), ("pe_td", X1 - 0.12, X1, -0.10, 0.0)):
    caixa(nome, x0, x1, y0, y1, 0.0, ZP, PE, bevel=0.008, seg=3)

# ------------------------------------------------------------------ mesa de vidro, espelho traseiro, botoes
caixa("mesa_vidro", X0 - 0.002, X1 + 0.002, YF - 0.004, 0, ZT - 0.006, ZT, VIDRO, bevel=0.004, seg=3, veio="x")
caixa("espelho", X0 + 0.02, X1 - 0.02, -0.03, 0, ZT, ZT + 0.025, PRETO, bevel=0.008, seg=3)
for k, x in enumerate((-0.18, -0.09, 0.0, 0.09, 0.18)):
    cilindro("botao_%d" % k, x, YF + 0.045, ZT, ZT + 0.028, 0.019, BOTAO)
    cilindro("botao_aro_%d" % k, x, YF + 0.045, ZT, ZT + 0.004, 0.023, CROMO)
    caixa("botao_pega_%d" % k, x - 0.003, x + 0.003, YF + 0.03, YF + 0.06, ZT + 0.026, ZT + 0.034, BOTAO, bevel=0.002)

# 5 queimadores: 4 nos cantos + tripla chama no meio; trempe individual de ferro em estrela (6 bracos)
QUEIM = [(-0.235, YF + 0.20, 0.040, 0.13), (0.235, YF + 0.20, 0.034, 0.12), (-0.235, -0.15, 0.034, 0.12),
         (0.235, -0.15, 0.040, 0.13), (0.0, -D / 2 - 0.02, 0.055, 0.15)]
for i, (x, y, r, t) in enumerate(QUEIM):
    cilindro("q_base_%d" % i, x, y, ZT, ZT + 0.010, r + 0.012, CROMO)
    cilindro("q_coroa_%d" % i, x, y, ZT + 0.010, ZT + 0.022, r, LATAO)
    cilindro("q_tampa_%d" % i, x, y, ZT + 0.022, ZT + 0.028, r * 0.75, LATAO)
    for b in range(6):                                # bracos da trempe
        a = 2 * math.pi * b / 6 + math.pi / 6
        ca, sa = math.cos(a), math.sin(a)
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        L0, L1 = r + 0.006, t / 2
        for v in bm.verts:
            u = L0 + (v.co.x + 0.5) * (L1 - L0)
            w = v.co.y * 0.009
            zz = ZT + 0.030 + (v.co.z + 0.5) * 0.012 - (0.018 if u > L1 - 0.02 else 0.0) * (v.co.z < 0)
            v.co = (x + u * ca - w * sa, y + u * sa + w * ca, zz)
        bm.normal_update()
        kit.uv_metro(bm, None, "trempe_%d_%d" % (i, b))
        o = kit.obj("trempe_%d_%d" % (i, b), kit.mesh_bm("t", bm), [FERRO])
        mb = o.modifiers.new("bevel", "BEVEL")
        mb.width, mb.segments, mb.limit_method = 0.002, 2, "ANGLE"
    for b in range(6):                                # pes da trempe na ponta dos bracos
        a = 2 * math.pi * b / 6 + math.pi / 6
        caixa("trempe_pe_%d_%d" % (i, b), x + (t / 2 - 0.008) * math.cos(a) - 0.005, x + (t / 2 - 0.008) * math.cos(a) + 0.005,
              y + (t / 2 - 0.008) * math.sin(a) - 0.005, y + (t / 2 - 0.008) * math.sin(a) + 0.005, ZT, ZT + 0.032, FERRO, bevel=0.002)

# ------------------------------------------------------------------ estudio (o mesmo do fogao 4 bocas)
CHAO = material("chao_estudio_5b", (145, 145, 145), rough=0.9)
chao = kit.amb(caixa("chao", -3, 3, -3, 3, -0.01, 0.0, CHAO, bevel=0))
chao.is_shadow_catcher = True
# sem fundo luminoso atras (a mesa de vidro o espelhava inteiro); softbox ALTO a esquerda: e o brilho da
# lateral da foto (186), invisivel pra camera e pra luz difusa -- so reflexo
SOFT = material("softbox_5b", (255, 255, 255), emissao=1.2)
soft = kit.amb(caixa("softbox", -2.2, -2.15, -2.5, 0.5, 0.2, 2.2, SOFT, bevel=0))
soft.visible_camera = soft.visible_diffuse = soft.visible_shadow = False
luz("chave", "AREA", (-1.6, -2.2, 2.4), 70, (1.0, 1.0, 1.0), 2.5, (0.0, -0.2, 0.5))
luz("preenche", "AREA", (1.8, -2.0, 1.2), 30, (1.0, 1.0, 1.0), 2.0, (0.0, -0.2, 0.5))
luz("topo", "AREA", (0.0, -0.3, 2.6), 220, (1.0, 1.0, 1.0), 3.0, (0.0, -0.2, 0.0))
kit.mundo((255, 255, 255), 0.05)
kit.S.render.film_transparent = True
kit.render(kit.saida_padrao("fogao-5b"), (C["res"][0] * 2, C["res"][1] * 2), vista="Standard")

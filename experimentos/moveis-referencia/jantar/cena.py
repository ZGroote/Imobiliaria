# -*- coding: utf-8 -*-
"""Mesa de jantar 4 lugares (referencia 5): tampo laqueado branco 1,36 x 0,80 sobre estrutura de
madeira com pes conicos; cadeiras de madeira com assento estofado e encosto em capitone (botao que
afunda o estofado). Medidas padrao (sem catalogo), camera em camera_jantar.py.
    blender -b --factory-startup --python jantar/cena.py -- [saida.png]
Mesa centrada na origem, lado comprido em y, chao z = 0."""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import kit
from kit import caixa, material, luz, estofado, poe
import bpy, bmesh
import numpy as np
from mathutils import Vector

C = kit.camera("jantar")
W, L, Z = C["medidas"]["W"], C["medidas"]["L"], C["medidas"]["Z"]

LACA = material("laca_branca", (238, 235, 230), rough=0.12, coat=0.6)
MAD = material("madeira_escura", tex="madeira_nature", rough=0.55, relevo=0.3, spec=0.4, tinta=(0.92, 0.62, 0.38))
TEC = material("tecido_cadeira", tex="linho", rough=0.9, relevo=0.3, sheen=0.4, spec=0.3, tinta=kit.lin((214, 208, 202))[:3])
BOTAO = material("botao_cadeira", (120, 117, 113), rough=0.7)


def perna(nome, x, y, z0, z1, r0, r1, incl=(0.0, 0.0)):
    """pe conico de secao quadrada: r0 embaixo, r1 em cima; incl = deslocamento do pe no chao (m)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        cima = v.co.z > 0
        r = r1 if cima else r0
        dx, dy = (0.0, 0.0) if cima else incl
        v.co = Vector((x + dx + v.co.x * 2 * r, y + dy + v.co.y * 2 * r, z1 if cima else z0))
    bm.normal_update()
    kit.uv_metro(bm, "z", nome)
    o = kit.obj(nome, kit.mesh_bm(nome, bm), [MAD])
    m = o.modifiers.new("bevel", "BEVEL")
    m.width, m.segments, m.limit_method, m.harden_normals = 0.002, 2, "ANGLE", True
    for p in o.data.polygons:
        p.use_smooth = True
    return o


# ------------------------------------------------------------------ mesa
caixa("tampo", -W / 2, W / 2, -L / 2, L / 2, Z - 0.022, Z, LACA, bevel=0.006, seg=3)
caixa("saia_x0", -W / 2 + 0.05, -W / 2 + 0.07, -L / 2 + 0.05, L / 2 - 0.05, Z - 0.10, Z - 0.022, MAD, veio="y")
caixa("saia_x1", W / 2 - 0.07, W / 2 - 0.05, -L / 2 + 0.05, L / 2 - 0.05, Z - 0.10, Z - 0.022, MAD, veio="y")
caixa("saia_y0", -W / 2 + 0.05, W / 2 - 0.05, -L / 2 + 0.05, -L / 2 + 0.07, Z - 0.10, Z - 0.022, MAD, veio="x")
caixa("saia_y1", -W / 2 + 0.05, W / 2 - 0.05, L / 2 - 0.07, L / 2 - 0.05, Z - 0.10, Z - 0.022, MAD, veio="x")
for sx in (-1, 1):
    for sy in (-1, 1):
        perna("pe_mesa_%d_%d" % (sx, sy), sx * (W / 2 - 0.08), sy * (L / 2 - 0.08), 0.0, Z - 0.022, 0.016, 0.026)


# ------------------------------------------------------------------ cadeira (montada na origem, de frente pra +y)
def capitone(o, botoes, raio=0.035, fundo=0.012, eixo=1):
    """afunda o estofado em volta de cada botao (gaussiana) -- o capitone e GEOMETRIA (luz suave apaga bump)."""
    me = o.data
    for v in me.vertices:
        for bx, bz in botoes:
            d2 = (v.co.x - bx) ** 2 + (v.co.z - bz) ** 2
            if v.co[eixo] < 0:                       # so a frente do encosto (frente = -y local)
                v.co[eixo] += fundo * math.exp(-d2 / (2 * raio ** 2))
    me.update()


def cadeira(nome):
    pecas = []
    LW, LD, ZS = 0.44, 0.46, 0.46                    # largura, profundidade, altura do assento
    # pes da frente retos, de tras sobem ate o topo do encosto e abrem pra tras no chao
    for sx in (-1, 1):
        pecas.append(perna(nome + "_pf%d" % sx, sx * (LW / 2 - 0.02), LD / 2 - 0.02, 0.0, ZS - 0.04, 0.014, 0.017))
        pecas.append(perna(nome + "_pt%d" % sx, sx * (LW / 2 - 0.02), -LD / 2 + 0.02, 0.0, 0.88, 0.015, 0.016, incl=(0.0, -0.05)))
    pecas.append(caixa(nome + "_quadro", -LW / 2, LW / 2, -LD / 2, LD / 2, ZS - 0.09, ZS - 0.04, MAD, veio="x"))
    a = estofado(nome + "_assento", LW + 0.01, LD + 0.02, 0.06, TEC, pressao=0.15, passo=0.02)
    poe(a, (0.0, 0.01, ZS - 0.01))
    pecas.append(a)
    e = estofado(nome + "_encosto", LW - 0.05, 0.05, 0.34, TEC, pressao=0.4, passo=0.015)
    botoes = [(-0.10, 0.06), (0.10, 0.06), (-0.10, -0.06), (0.10, -0.06)]
    capitone(e, botoes)
    poe(e, (0.0, -LD / 2 + 0.005, 0.70), (-8, 0, 0))
    pecas.append(e)
    for k, (bx, bz) in enumerate(botoes):
        b = caixa(nome + "_botao%d" % k, bx - 0.006, bx + 0.006, -0.03, -0.018, bz - 0.006, bz + 0.006, BOTAO, bevel=0.005, seg=3)
        b.parent = e
        pecas.append(b)
    return pecas


# 6 lugares como na foto: 2 por lado comprido + 1 em cada cabeceira (de frente pro centro da mesa)
GIROS = {"cad_e0": (-W / 2 - 0.16, -0.30, -90), "cad_e1": (-W / 2 - 0.16, 0.30, -90),
         "cad_d0": (W / 2 + 0.16, -0.30, 90), "cad_d1": (W / 2 + 0.16, 0.30, 90),
         "cad_c0": (0.0, -L / 2 - 0.16, 180), "cad_c1": (0.0, L / 2 + 0.16, 0)}
for nome, (x, y, g) in GIROS.items():
    vazio = bpy.data.objects.new(nome, None)
    kit.S.collection.objects.link(vazio)
    for o in cadeira(nome):
        if o.parent is None:
            o.parent = vazio
    vazio.location = (x, y, 0.0)
    vazio.rotation_euler = (0, 0, math.radians(g))

# navegador: o estofado de pano passa de 4 mil tri por almofada
for o in kit.S.objects:
    if o.name.endswith(("_assento", "_encosto")):
        o["tri_alvo"] = 500

# ------------------------------------------------------------------ sala
PISO = material("piso_madeira_clara", (196, 160, 120), rough=0.5)
TAPETE = material("tapete_juta", (190, 175, 150), rough=1.0, sheen=0.3)
PAREDE = material("parede_branca", (238, 234, 228), rough=0.9)
kit.amb(caixa("piso", -6, 6, -6, 6, -0.01, 0.0, PISO, bevel=0))
kit.amb(caixa("tapete", -1.5, 1.5, -1.9, 1.9, 0.0, 0.008, TAPETE, bevel=0.003))
kit.amb(caixa("parede_fundo", -6, 6, 2.4, 2.5, 0, 3, PAREDE, bevel=0))
kit.amb(caixa("parede_esq", -3.6, -3.5, -6, 6, 0, 3, PAREDE, bevel=0))
luz("janela", "AREA", (-3.3, 0.5, 1.5), 140, (1.0, 0.98, 0.95), 3.0, (0.0, 0.3, 0.6), tam_y=2.5)
luz("ceu", "AREA", (0.5, -1.0, 2.9), 50, (1.0, 0.97, 0.93), 3.0, (0.0, 0.0, 0.0))
kit.mundo((235, 230, 222), 0.10)
kit.render(kit.saida_padrao("jantar"), (C["res"][0] * 2, C["res"][1] * 2), vista="Standard")

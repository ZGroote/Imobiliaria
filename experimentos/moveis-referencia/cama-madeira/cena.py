# -*- coding: utf-8 -*-
"""Cama de madeira com cabeceira de painel (referencia 11): estrutura de madeira tipo teca com pes
inclinados, cabeceira de painel, colchao com lencol branco, edredom creme por SIMULACAO DE PANO (cai com
gravidade sobre colchao e estrutura) com a parte de cima dobrada pra tras (segundo pano por cima), e
travesseiros (kit.estofado). Banco e criados da foto ficam de fora.
    LARGURA=1.58 (queen, compara com a foto) | 0.88 (solteiro, vaga do Cedros)
    blender -b --factory-startup --python cama-madeira/cena.py -- [saida.png]
Cabeceira (face da frente) em y = 0, pe da cama em -FL; chao z = 0."""
import os, sys, math, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import kit
from kit import caixa, material, luz, estofado, poe, travesseiro
import bpy, bmesh
import numpy as np
from mathutils import Vector

C = kit.camera("cama-madeira")
W = float(os.environ.get("LARGURA", "1.58"))     # colchao
CL = 1.98                                         # comprimento do colchao
FW, FL = W + 0.08, CL + 0.10                      # estrutura
ZR = C["medidas"]["zr"]                           # fundo das laterais (0,17, da camera)
ZRT = 0.36                                        # topo das laterais
ZC0, ZC1 = 0.31, 0.56                             # colchao (assenta 5 cm abaixo do topo da lateral)
HBH = 1.05

MAD = material("teca", tex="madeira_nature", rough=0.5, relevo=0.3, spec=0.4, tinta=(1.35, 0.82, 0.50))
LENCOL = material("lencol", tex="blackout", rough=0.9, relevo=0.2, sheen=0.4, spec=0.3, tinta=kit.lin((236, 232, 226))[:3])
EDREDOM = material("edredom", tex="blackout", rough=0.92, relevo=0.3, sheen=0.5, spec=0.3, tinta=kit.lin((232, 224, 212))[:3], duplo=True)
FRONHA = material("fronha", tex="blackout", rough=0.9, relevo=0.2, sheen=0.4, spec=0.3, tinta=kit.lin((250, 246, 240))[:3])


def perna(nome, x, y, z0, z1, r0, r1, abre=(0.0, 0.0)):
    """pe conico de secao quadrada (r0 embaixo, r1 em cima); `abre` desloca o pe no chao (pe inclinado)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        cima = v.co.z > 0
        r = r1 if cima else r0
        dx, dy = (0.0, 0.0) if cima else abre
        v.co = Vector((x + dx + v.co.x * 2 * r, y + dy + v.co.y * 2 * r, z1 if cima else z0))
    bm.normal_update()
    kit.uv_metro(bm, "z", nome)
    o = kit.obj(nome, kit.mesh_bm(nome, bm), [MAD])
    m = o.modifiers.new("bevel", "BEVEL")
    m.width, m.segments, m.limit_method, m.harden_normals = 0.003, 2, "ANGLE", True
    for p in o.data.polygons:
        p.use_smooth = True
    return o


# ------------------------------------------------------------------ estrutura e cabeceira
E = 0.028                                         # espessura das tabuas
caixa("lateral_esq", -FW / 2, -FW / 2 + E, -FL, -0.0, ZR, ZRT, MAD, bevel=0.003, veio="y")
caixa("lateral_dir", FW / 2 - E, FW / 2, -FL, -0.0, ZR, ZRT, MAD, bevel=0.003, veio="y")
caixa("pe_da_cama", -FW / 2, FW / 2, -FL, -FL + E, ZR, ZRT, MAD, bevel=0.003, veio="x")
caixa("estrado", -FW / 2 + E, FW / 2 - E, -FL + E, -0.0, ZC0 - 0.02, ZC0, MAD, bevel=0, veio="y")
caixa("cabeceira", -FW / 2, FW / 2, 0.0, 0.035, 0.30, HBH, MAD, bevel=0.004, seg=3, veio="x")
for s in (-1, 1):
    caixa("poste_%d" % s, s * (FW / 2 - 0.03) - 0.025, s * (FW / 2 - 0.03) + 0.025, 0.0, 0.035, 0.0, 0.31, MAD, bevel=0.003, veio="z")
    # pes do pe da cama: inclinados pra fora e pra frente (como na foto)
    perna("perna_pe_%d" % s, s * (FW / 2 - 0.06), -FL + 0.06, 0.0, ZR + 0.01, 0.017, 0.024, abre=(s * 0.025, -0.03))
    perna("perna_meio_%d" % s, s * (FW / 2 - 0.06), -FL / 2, 0.0, ZR + 0.01, 0.017, 0.024, abre=(s * 0.025, 0.0))

# ------------------------------------------------------------------ colchao com lencol
colchao = estofado("colchao", W, CL, ZC1 - ZC0, LENCOL, pressao=0.05, passo=0.04, sub=0)
poe(colchao, (0.0, -0.05 - CL / 2, (ZC0 + ZC1) / 2))
bpy.context.view_layer.update()


# ------------------------------------------------------------------ pano simulado
def pano(nome, sx, sy, cx, cy, z, mat, colisores, passo=0.022, quadros=60, dobra=0.6, semente=1):
    """plano de pano solto em z, cai com gravidade sobre os colisores (o que vira edredom)."""
    T0 = time.time()
    nx, ny = int(sx / passo) + 1, int(sy / passo) + 1
    bm = bmesh.new()
    rng = np.random.default_rng(semente)
    # ondas em DIRECOES aleatorias (a regular, alinhada com a grade, congelava como caixa de ovo): e o
    # excesso de pano que vira ruga macia quando assenta
    ondas = [(rng.uniform(0, 2 * np.pi), rng.uniform(3, 9), rng.uniform(0, 2 * np.pi), rng.uniform(0.004, 0.012)) for _ in range(7)]
    def alt(x, y):
        return sum(a * math.sin(k * (x * math.cos(t) + y * math.sin(t)) + ph) for t, k, ph, a in ondas)
    vs = [[bm.verts.new((cx - sx / 2 + i * sx / (nx - 1), cy - sy / 2 + j * sy / (ny - 1),
                         z + alt(i * sx / (nx - 1), j * sy / (ny - 1)) + 0.02))
           for i in range(nx)] for j in range(ny)]
    uvl = bm.loops.layers.uv.verify()
    for j in range(ny - 1):
        for i in range(nx - 1):
            f = bm.faces.new((vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]))
            for l in f.loops:
                l[uvl].uv = (l.vert.co.x, l.vert.co.y)
    o = kit.obj(nome, kit.mesh_bm(nome, bm), [mat])
    for c in colisores:
        if not any(m.type == "COLLISION" for m in c.modifiers):
            cm = c.modifiers.new("col", "COLLISION")
            c.collision.thickness_outer = 0.006
            c.collision.cloth_friction = 8.0
    S = kit.S
    S.frame_start, S.frame_end = 1, quadros
    m = o.modifiers.new("pano", "CLOTH")
    cs = m.settings
    cs.quality, cs.mass = 6, 0.4
    cs.tension_stiffness = cs.compression_stiffness = 15.0
    cs.shear_stiffness, cs.bending_stiffness = 5.0, dobra
    cs.air_damping = 2.0
    m.collision_settings.distance_min = 0.006
    m.point_cache.frame_start, m.point_cache.frame_end = 1, quadros
    for f in range(1, quadros + 1):
        S.frame_set(f)
    me = bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    o.modifiers.remove(m)
    velho, o.data = o.data, me
    bpy.data.meshes.remove(velho)
    S.frame_set(1)
    for p in me.polygons:
        p.use_smooth = True
    o["grade"] = [nx, ny, 2]                     # exporta.py: malha do navegador = 1 a cada 2 pontos (3 cortava a borda)
    print("pano %s: %d vertices, %.0f s" % (nome, len(me.vertices), time.time() - T0), flush=True)
    return o


laterais = [bpy.data.objects[n] for n in ("lateral_esq", "lateral_dir", "pe_da_cama")]
# edredom: sobra 15 cm de cada lado e no pe (a lateral de madeira aparece, como na foto); comeca a 40 cm
# da cabeceira (o travesseiro fica de fora)
SOB = 0.25                                         # cobre a parte de cima da lateral, como na foto
SOB_PE = 0.12                                      # no pe sobra menos (com 25 cm ele escorregava ate o chao)
ed = pano("edredom", W + 2 * SOB, CL - 0.35 + SOB_PE, 0.0, -0.40 - (CL - 0.35 + SOB_PE) / 2, ZC1 + 0.03, EDREDOM,
          [colchao] + laterais, semente=3)
# a parte de cima dobrada pra tras: tira de 65 cm por cima do edredom, a 40..105 cm da cabeceira
dob = pano("edredom_dobra", W + 2 * SOB, 0.65, 0.0, -0.40 - 0.325, ZC1 + 0.10, EDREDOM, [colchao, ed] + laterais, quadros=50, semente=5)
for o in (ed, dob):
    sd = o.modifiers.new("esp", "SOLIDIFY")
    sd.thickness, sd.offset = 0.012, 1.0
    ss = o.modifiers.new("sub", "SUBSURF")
    ss.levels = ss.render_levels = 1

# ------------------------------------------------------------------ travesseiros (encostados na cabeceira)
n_trav = 2 if W > 1.2 else 1
for k in range(n_trav):
    x = 0.0 if n_trav == 1 else (k - 0.5) * (W / 2)
    t = travesseiro("travesseiro_%d" % k, 0.72, 0.50, FRONHA, pressao=2.0)
    # quase deitado: so a borda de tras sobe na cabeceira (na foto, ~25 graus)
    poe(t, (x, -0.29, ZC1 + 0.16), (-28, 0, (k - 0.5) * 4))
    t["tri_alvo"] = 900
colchao["tri_alvo"] = 600

# ------------------------------------------------------------------ quarto
PAREDE = material("parede_cimento", (62, 58, 52), rough=0.9)
PISO = material("piso_cimento", (110, 104, 98), rough=0.6)
TAPETE = material("tapete_juta", (132, 86, 50), rough=1.0, sheen=0.3)
kit.amb(caixa("parede", -5, 5, 0.04, 0.14, 0, 3, PAREDE, bevel=0))
kit.amb(caixa("piso", -6, 6, -7, 0.04, -0.01, 0.0, PISO, bevel=0))
kit.amb(caixa("tapete", -2.2, 3.0, -4.5, -0.3, 0.0, 0.008, TAPETE, bevel=0.003))
luz("sol", "AREA", (3.2, -2.4, 2.2), 240, (1.0, 0.82, 0.62), 1.2, (0.0, -1.0, 0.4))
luz("janela", "AREA", (2.8, -1.2, 1.5), 45, (1.0, 0.9, 0.8), 2.5, (0.0, -1.0, 0.6), tam_y=2.0)
luz("frente", "AREA", (-2.0, -5.0, 1.8), 30, (1.0, 0.95, 0.9), 3.0, (0.0, -1.0, 0.5))
kit.mundo((150, 140, 125), 0.12)
kit.render(kit.saida_padrao("cama-madeira"), (C["res"][0] * 2, C["res"][1] * 2), vista="Standard")

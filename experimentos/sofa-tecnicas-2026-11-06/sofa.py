# -*- coding: utf-8 -*-
"""Sofa reto em sala (06/11/2026): costura, linho escaneado, luz de janela e camera das skills.
blender -b --python sofa.py -- <saida.png> [geral|detalhe]"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tecnicas import *

# ================================================================== CENA
log("comeco")
# --- materiais
LINHO_SOFA = tecido("linho_sofa", (168, 152, 132))            # greige quente (nunca saturado)
LINHO_ALMOF = tecido("linho_almofada", (208, 198, 180), escala=0.35)
LINHO_FERR = tecido("linho_ferrugem", (146, 84, 58), escala=0.35, sheen=0.4)
LINHO_MANTA = tecido("linho_manta", (190, 156, 116), escala=0.3, sheen=0.35, relevo=1.2, slub=0.05)
JUTA = tecido("juta_tapete", (186, 164, 128), escala=0.14, sheen=0.1, relevo=1.6, rough=(0.85, 1.0), slub=0.06)
CARVALHO = madeira("carvalho_pe", (0.62, 0.50, 0.40), rough=0.45)
PISO = madeira("piso_carvalho", (0.92, 0.86, 0.78), rough=0.38, escala=1.6, amp=0.09)
MESA = madeira("carvalho_mesa", (0.80, 0.66, 0.52), rough=0.35)
PAREDE = tinta_parede("parede", (236, 231, 222))
TETO = tinta_parede("teto", (242, 240, 235))
RODAPE = liso("rodape", (236, 233, 226), 0.55)
CERAMICA = liso("ceramica", (222, 214, 200), 0.6)
PAPEL = liso("papel", (238, 234, 224), 0.8)
CAPA1 = liso("capa1", (92, 104, 96), 0.6)
CAPA2 = liso("capa2", (182, 140, 104), 0.6)
MOLDURA = madeira("moldura", (0.55, 0.42, 0.32), rough=0.4)


def arte_mat():
    """Gravura abstrata calma (cor da casa: greige, ferrugem, oliva) -- mancha de ruido grande."""
    m, nt, bs = mat_base("gravura")
    nz = no(nt, "ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value, nz.inputs["Detail"].default_value = 1.6, 1.0
    rp = no(nt, "ShaderNodeValToRGB")
    e = rp.color_ramp.elements
    e[0].position, e[0].color = 0.42, lin((232, 224, 210))
    e[1].position, e[1].color = 0.62, lin((176, 112, 82))
    x = e.new(0.5)
    x.color = lin((206, 186, 160))
    nt.links.new(nz.outputs["Fac"], rp.inputs["Fac"])
    nt.links.new(rp.outputs["Color"], bs.inputs["Base Color"])
    bs.inputs["Roughness"].default_value = 0.85
    return m


# --- sala (pe-direito 2,70; janela de piso a teto na parede esquerda, FORA do quadro)
XL, XR, YF, YB, PD = -2.6, 2.6, -5.0, 0.62, 2.70
JY0, JY1, JZ0, JZ1 = -3.2, -0.9, 0.0, 2.45
# piso de tabuas de verdade: cada tabua uma peca (tom e desenho proprios), chanfro de 1,5 mm
rng = np.random.default_rng(7)
LARG = 0.19
x = XL
k = 0
while x < XR:
    y = YF - rng.uniform(0, 1.6)
    while y < YB:
        comp = rng.uniform(1.2, 2.2)
        caixa("tabua_%d" % k, x + 0.0008, x + LARG - 0.0008, max(y, YF) + 0.0008, min(y + comp, YB) - 0.0008, -0.015, 0.0,
              PISO, bevel=0.0015)
        k += 1
        y += comp
    x += LARG
log("piso: %d tabuas" % k)
amb_ = []
amb_ += [caixa("parede_fundo", XL, XR, YB, YB + 0.1, 0, PD, PAREDE, 0),
         caixa("parede_dir", XR, XR + 0.1, YF, YB + 0.1, 0, PD, PAREDE, 0),
         caixa("parede_frente", XL - 0.1, XR + 0.1, YF - 0.1, YF, 0, PD, PAREDE, 0),
         caixa("teto", XL - 0.1, XR + 0.1, YF - 0.1, YB + 0.1, PD, PD + 0.1, TETO, 0)]
# parede esquerda com o vao da janela
for nm_, a in (("pe_a", (YF - 0.1, JY0, 0, PD)), ("pe_b", (JY1, YB + 0.1, 0, PD)), ("pe_c", (JY0, JY1, JZ1, PD))):
    caixa("parede_esq_" + nm_, XL - 0.1, XL, a[0], a[1], a[2], a[3], PAREDE, 0)
caixa("rodape_fundo", XL, XR, YB - 0.012, YB, 0, 0.08, RODAPE, 0.001)
caixa("rodape_dir", XR - 0.012, XR, YF, YB, 0, 0.08, RODAPE, 0.001)

# --- sofa: 2,20 x 0,95; assento 0,45; braco 0,62; encosto 0,84
W, Y0, Y1 = 2.20, -0.47, 0.48
BR = 0.17
PE = 0.12
bx = W / 2
braco_e = caixa_estofada("braco_esq", -bx, -bx + BR, Y0, Y1, PE, 0.62, LINHO_SOFA, pressao=0.09)
braco_d = caixa_estofada("braco_dir", bx - BR, bx, Y0, Y1, PE, 0.62, LINHO_SOFA, pressao=0.09)
base = caixa_estofada("base", -bx + BR - 0.01, bx - BR + 0.01, Y0 + 0.01, Y1, PE, 0.29, LINHO_SOFA, pressao=0.08)
encosto = caixa_estofada("encosto_fixo", -bx + BR - 0.01, bx - BR + 0.01, 0.30, Y1, 0.27, 0.70, LINHO_SOFA, pressao=0.08)
for xx in (-bx + 0.07, bx - 0.07):
    for yy in (Y0 + 0.07, Y1 - 0.07):
        cilindro("pe_%+.0f_%+.0f" % (xx * 10, yy * 10), 0.016, 0.022, PE + 0.01, CARVALHO, loc=(xx, yy, 0))
colide(braco_e, braco_d, base, encosto)
z_deck = topo_z(base)
log("topo da base %.3f" % z_deck)

# almofadas de assento: costuradas, caem com gravidade e assentam na base
LI = (bx - BR) * 2                                            # vao interno
assentos = []
for i, cx in enumerate((-LI / 4, LI / 4)):
    # a pressao estufa o tampo (~+4 cm de altura, ~+1,5 cm de largura): molde menor que a medida final
    o, aneis, _ = almofada_costurada("assento_%d" % i, LI / 2 - 0.035, 0.73, 0.12, LINHO_SOFA)
    poe(o, (cx, Y0 + 0.37 + 0.005, z_deck + 0.075 + 0.012))
    # massa do Cloth e POR VERTICE: 0,4 x 5 mil vertices = 2 t e a almofada murcha no primeiro teste
    simula(o, pressao=0.2, gravidade=1.0, quadros=45, tensao=90, dobra=0.5, massa=0.002)
    for j, an in enumerate(aneis):
        vivo("vivo_assento_%d_%d" % (i, j), o, an, LINHO_SOFA)
    colide(o)                                                 # a segunda encosta na primeira
    assentos.append(o)

# almofadas de encosto: costuradas (sem gravidade), depois em pe, deitadas ~14 graus pra tras
z_ass = max(topo_z(a) for a in assentos)
for i, cx in enumerate((-LI / 4, LI / 4)):
    o, aneis, _ = almofada_costurada("encosto_%d" % i, LI / 2 - 0.03, 0.46, 0.15, LINHO_SOFA, raio=0.05)
    simula(o, pressao=0.35, gravidade=0.0, quadros=40, tensao=80, dobra=0.3)
    poe(o, (cx, 0.21, z_ass + 0.215), rot=(90 - 14, 0, 0))
    bpy.context.view_layer.update()
    for j, an in enumerate(aneis):
        vivo("vivo_encosto_%d_%d" % (i, j), o, an, LINHO_SOFA)

# almofadas decorativas (travesseiro costurado na borda) apoiadas no encosto
# (rotacao "ZXY": gira no proprio plano primeiro, depois levanta e deita pra tras)
for nome, mat, loc, rx, rz in (("almof_a", LINHO_ALMOF, (-0.72, -0.03, z_ass + 0.215), 73, 9),
                               ("almof_b", LINHO_FERR, (-0.31, -0.07, z_ass + 0.205), 76, -7),
                               ("almof_c", LINHO_ALMOF, (0.70, -0.02, z_ass + 0.21), 74, -11)):
    t = kit.travesseiro(nome, 0.48, 0.48, mat, pressao=1.3)
    t.rotation_mode = "ZXY"
    t.location = loc
    t.rotation_euler = (math.radians(rx), 0, math.radians(rz))

# manta de linho jogada no braco esquerdo: pano com gravidade, cai sobre braco e assento
chao = caixa("chao_colisao", XL, XR, YF, YB, -0.02, 0.0, PISO, 0)
chao.hide_render = True
colide(chao)
bm = bmesh.new()
bmesh.ops.create_grid(bm, x_segments=55, y_segments=70, size=1.0)
co_ = np.array([v.co[:] for v in bm.verts])
ext = co_.max(0) - co_.min(0)
for v in bm.verts:
    v.co.x *= 1.1 / ext[0]
    v.co.y *= 1.4 / ext[1]
uvl = bm.loops.layers.uv.verify()
for f in bm.faces:
    for l in f.loops:
        l[uvl].uv = (l.vert.co.x, l.vert.co.y)
manta = obj("manta", mesh_bm("manta", bm), [LINHO_MANTA])
poe(manta, (-bx + 0.05, -0.12, 0.80), rot=(0, 0, 28))
bpy.context.view_layer.update()
simula(manta, pressao=0.0, gravidade=1.0, quadros=90 if not TESTE else 60, tensao=15, dobra=0.08, massa=0.02,
       auto=True, ondas=0.01, ar=0.3)
sd = manta.modifiers.new("esp", "SOLIDIFY")
sd.thickness, sd.offset = 0.003, 0
ss = manta.modifiers.new("sub", "SUBSURF")
ss.levels = ss.render_levels = 1

# --- tapete de juta, mesa lateral, vaso, livros, gravura
caixa("tapete", -1.45, 1.45, -2.25, -0.05, 0.0, 0.012, JUTA, bevel=0.004)
mt = cilindro("mesa_tampo", 0.25, 0.25, 0.025, MESA, seg=64, loc=(1.48, -0.05, 0.50))
cilindro("mesa_pe", 0.03, 0.03, 0.50, MESA, loc=(1.48, -0.05, 0.0))
cilindro("mesa_base", 0.16, 0.17, 0.02, MESA, seg=48, loc=(1.48, -0.05, 0.0))
cilindro("vaso", 0.055, 0.07, 0.20, CERAMICA, seg=48, loc=(1.53, 0.02, 0.525), sub=1)
caixa("livro_1", 1.33, 1.57, -0.20, -0.04, 0.525, 0.552, CAPA1)
caixa("livro_2", 1.35, 1.55, -0.19, -0.05, 0.552, 0.572, CAPA2)
caixa("moldura", -0.52, 0.52, YB - 0.03, YB - 0.002, 1.10, 1.86, MOLDURA)
caixa("passepartout", -0.49, 0.49, YB - 0.033, YB - 0.02, 1.13, 1.83, PAPEL, 0.0005)
caixa("gravura", -0.36, 0.36, YB - 0.036, YB - 0.032, 1.25, 1.71, arte_mat(), 0)

# planta do Poly Haven (CC0) no canto direito, atras da mesa
try:
    blend = os.path.join(REPO, "experimentos", "liv-luz-natural-2026-10-26", "fontes", "polyhaven", "potted_plant_01_1k.blend")
    with bpy.data.libraries.load(blend, link=False) as (src, dst):
        dst.objects = list(src.objects)
    plantas = [o for o in dst.objects if o and o.type == "MESH"]
    for o in plantas:
        S.collection.objects.link(o)
    bpy.context.view_layer.update()
    zs = [(o.matrix_world @ Vector(c)).z for o in plantas for c in o.bound_box]
    alt = max(zs) - min(zs)
    piv = bpy.data.objects.new("planta", None)
    S.collection.objects.link(piv)
    for o in plantas:
        if o.parent is None:
            o.parent = piv
    esc = 0.95 / alt
    piv.scale = (esc,) * 3
    piv.location = (1.98, 0.22, -min(zs) * esc)
    log("planta: altura original %.2f m -> 0,95 m" % alt)
except Exception as e:
    log("planta fora:", e)

# ------------------------------------------------------------------ luz (archviz-realista)
# principal = sol de fim de tarde entrando pela janela da ESQUERDA (luz lateral ~45 graus: volume),
# ceu fisico; nenhuma luminaria acesa (foto de dia: temperaturas misturadas sujam o branco).
# AZ = quanto o sol puxa pro fundo da sala. Com 22 a mancha de sol caia na parede direita PERTO da
# camera (area clara onde nao se quer o olho); com 36 ela vai pra tras da planta.
ELEV, AZ = 24.0, float(os.environ.get("AZ_SOL", "36"))
S.world = bpy.data.worlds.new("ceu")
try:
    S.world.use_nodes = True
except Exception:
    pass
wn = S.world.node_tree
sky = wn.nodes.new("ShaderNodeTexSky")
tipos = [i.identifier for i in sky.bl_rna.properties["sky_type"].enum_items]
sky.sky_type = next((t for t in ("NISHITA", "MULTIPLE_SCATTERING", "SINGLE_SCATTERING") if t in tipos), tipos[0])
for at, val in (("sun_disc", False), ("sun_elevation", math.radians(ELEV)),
                ("sun_rotation", math.radians(90 + AZ)), ("altitude", 300.0)):
    try:
        setattr(sky, at, val)
    except Exception:
        pass
bg = next(n for n in wn.nodes if n.type == "BACKGROUND")
bg.inputs["Strength"].default_value = float(os.environ.get("CEU", "1.0"))
wn.links.new(sky.outputs["Color"], bg.inputs["Color"])
log("ceu:", sky.sky_type)

sd_ = bpy.data.lights.new("sol", "SUN")
sd_.energy = float(os.environ.get("SOL", "2.5"))
sd_.angle = math.radians(1.2)
try:
    sd_.use_temperature, sd_.temperature = True, 5000
except Exception:
    sd_.color = (1.0, 0.86, 0.72)
sol = bpy.data.objects.new("sol", sd_)
S.collection.objects.link(sol)
d = Vector((math.cos(math.radians(ELEV)) * math.cos(math.radians(AZ)),
            math.cos(math.radians(ELEV)) * math.sin(math.radians(AZ)),
            -math.sin(math.radians(ELEV))))
sol.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

# portal na janela (concentra as amostras onde a luz entra)
pl = bpy.data.lights.new("portal", "AREA")
pl.shape, pl.size, pl.size_y = "RECTANGLE", JY1 - JY0, JZ1 - JZ0
for alvo in (pl, getattr(pl, "cycles", None)):
    try:
        alvo.is_portal = True
        break
    except Exception:
        pass
po = bpy.data.objects.new("portal", pl)
S.collection.objects.link(po)
po.location = (XL - 0.05, (JY0 + JY1) / 2, (JZ0 + JZ1) / 2)
po.rotation_euler = Vector((1, 0, 0)).to_track_quat("-Z", "Y").to_euler()

# ------------------------------------------------------------------ camera (composicao-de-cena)
cd = bpy.data.cameras.new("cam")
cd.sensor_fit, cd.sensor_width = "HORIZONTAL", 36.0
cam = bpy.data.objects.new("cam", cd)
S.collection.objects.link(cam)
S.camera = cam
if VISTA == "detalhe":
    # detalhe: 85 mm, foco no canto da almofada (vivo + costura + manta), f/3.5
    cd.lens = 85
    cam.location = (-0.28, -1.55, 0.64)
    alvo = Vector((-0.80, -0.47, 0.45))
    cam.rotation_euler = (alvo - cam.location).to_track_quat("-Z", "Y").to_euler()
    cd.dof.use_dof, cd.dof.aperture_fstop = True, 3.5
    cd.dof.focus_distance = (alvo - cam.location).length
    RES = (1200, 1500)
else:
    # ambiente: 35 mm, 1 ponto de fuga (parede do fundo paralela), pitch 0, altura ~1,0 m (o sofa e o
    # protagonista: camera perto da altura do assento/braco, nem acima nem abaixo dele), um pouco fora
    # do centro; shift pra baixo em vez de inclinar.
    cd.lens = 35
    # (a grande-angular afasta tudo: camera mais perto do que parece natural -- curso 2146)
    cam.location = (0.10, -3.80, 1.02)
    cam.rotation_euler = (math.radians(90), 0, 0)
    cd.shift_y = -0.05
    RES = (1800, 1200)
cd.clip_start = 0.05
if TESTE:
    RES = (RES[0] // 2, RES[1] // 2)

S.view_settings.exposure = float(os.environ.get("EXPO", "1.2"))
S.view_settings.use_white_balance = True                       # ceu ~7500 K vira branco neutro
S.view_settings.white_balance_temperature = float(os.environ.get("WB", "8000"))
S.cycles.sample_clamp_indirect = 10.0
S.cycles.use_adaptive_sampling = True
log("cena montada")
kit.render(SAIDA, RES, amostras=48 if TESTE else 256, look=os.environ.get("LOOK", "AgX - High Contrast"))
log("fim")

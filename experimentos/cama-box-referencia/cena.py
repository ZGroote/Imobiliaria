# -*- coding: utf-8 -*-
"""Cama box casal + pillow-top da referencia, montada so com dado (sem mode_set:
ele trava em -b). Roda:  blender -b --factory-startup --python cena.py -- [saida.png]

Camera vem de camera.json (camera_solve.py): nivelada, com shift, casada com 11
cantos medidos na foto. Alturas da cama tambem vem de la."""
import bpy, bmesh, json, math, os, sys, time
import numpy as np
from mathutils import Vector

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else os.path.join(AQUI, "render.png")
CAM = json.load(open(os.path.join(AQUI, "camera.json")))
# LARGURA/COMPRIMENTO trocam o tamanho sem mexer na camera (solteiro: LARGURA=0.88)
W = float(os.environ.get("LARGURA", CAM["W"]))
L = float(os.environ.get("COMPRIMENTO", CAM["L"]))
SOLTEIRO = W < 1.2
ZF, ZB, ZM, ZT = (CAM["alturas"][k] for k in ("zf", "zb", "zm", "zt"))
Y0, Y1 = -L / 2, L / 2
T0 = time.time()

bpy.ops.wm.read_factory_settings(use_empty=True)
S = bpy.context.scene


# ---------------------------------------------------------------- utilidades
def lin(c):
    """sRGB 0-255 -> linear 0-1 (o Principled recebe linear)."""
    return tuple(((v / 255 + 0.055) / 1.055) ** 2.4 for v in c) + (1.0,)


def obj(nome, me, mats=()):
    o = bpy.data.objects.new(nome, me)
    S.collection.objects.link(o)
    for m in mats:
        o.data.materials.append(m)
    return o


def mesh_bm(nome, bm):
    me = bpy.data.meshes.new(nome)
    bm.to_mesh(me)
    bm.free()
    return me


def caixa(nome, x0, x1, y0, y1, z0, z1, mats, topo_slot=None, bevel=0.0, seg=3,
          prof=0.5):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector(((x0 + x1) / 2 + v.co.x * (x1 - x0), (y0 + y1) / 2 + v.co.y * (y1 - y0),
                       (z0 + z1) / 2 + v.co.z * (z1 - z0)))
    if topo_slot is not None:
        for f in bm.faces:
            if f.normal.z > 0.5:
                f.material_index = topo_slot
    o = obj(nome, mesh_bm(nome, bm), mats)
    if bevel:
        m = o.modifiers.new("bevel", "BEVEL")
        m.width, m.segments, m.profile = bevel, seg, prof
        m.limit_method = "ANGLE"
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def imagem(nome, h):
    """Mapa de altura (numpy 0-1, linhas = v) -> imagem nao-cor dentro do .blend."""
    hh, ww = h.shape
    img = bpy.data.images.new(nome, ww, hh, alpha=False, float_buffer=True)
    # O espaco de cor ANTES dos pixels: trocar depois recarrega a imagem gerada e
    # ZERA o buffer -- o matelasse inteiro sumia do render sem erro nenhum.
    img.colorspace_settings.name = "Non-Color"
    px = np.ones((hh, ww, 4), np.float32)
    px[..., 0] = px[..., 1] = px[..., 2] = h
    img.pixels.foreach_set(px.ravel())
    # grava em tex/ pra o .blend reabrir com o matelasse
    os.makedirs(os.path.join(AQUI, "tex"), exist_ok=True)
    img.filepath_raw = os.path.join(AQUI, "tex", nome + ".exr")
    img.file_format = "OPEN_EXR"
    try:
        img.save()
    except RuntimeError as e:      # arquivo preso por outro processo: o render usa a memoria
        print("aviso: %s nao gravado (%s)" % (nome, e), flush=True)
    return img


def sock(col, nome):
    return next(x for x in col if x.name == nome and x.enabled)


def material(nome, cor, rough=0.8, sheen=0.0, altura=None, escala=(1, 1, 1),
             dist=0.006, extra=None, escuro=0.78):
    m = bpy.data.materials.new(nome)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    bs = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bs.inputs["Base Color"].default_value = lin(cor)
    bs.inputs["Roughness"].default_value = rough
    if sheen:
        bs.inputs["Sheen Weight"].default_value = sheen
        bs.inputs["Sheen Roughness"].default_value = 0.4
    if altura is not None:
        tc = nt.nodes.new("ShaderNodeTexCoord")
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = escala
        tx = nt.nodes.new("ShaderNodeTexImage")
        tx.image, tx.projection, tx.projection_blend = altura, "BOX", 0.15
        tx.interpolation = "Cubic"
        bp = nt.nodes.new("ShaderNodeBump")
        bp.inputs["Distance"].default_value = dist
        nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
        nt.links.new(mp.outputs["Vector"], tx.inputs["Vector"])
        nt.links.new(tx.outputs["Color"], bp.inputs["Height"])
        nt.links.new(bp.outputs["Normal"], bs.inputs["Normal"])
        # o fundo do vinco escurece um pouco (oclusao de costura), como no tecido real
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        sock(mix.inputs, "A").default_value = tuple(v * escuro for v in lin(cor)[:3]) + (1,)
        sock(mix.inputs, "B").default_value = lin(cor)
        nt.links.new(tx.outputs["Color"], sock(mix.inputs, "Factor"))
        nt.links.new(sock(mix.outputs, "Result"), bs.inputs["Base Color"])
    if extra:
        extra(nt, bs)
    return m


# ---------------------------------------------------------------- padroes de matelasse
def grade(nu, nv, tu, tv):
    u = (np.arange(nu) + 0.5) / nu * tu
    v = (np.arange(nv) + 0.5) / nv * tv
    return np.meshgrid(u, v)


def sdf_ret(px, pz, cx, cz, hx, hz, r):
    qx, qz = np.abs(px - cx) - (hx - r), np.abs(pz - cz) - (hz - r)
    return np.hypot(np.maximum(qx, 0), np.maximum(qz, 0)) + np.minimum(np.maximum(qx, qz), 0) - r


def padrao_base():
    """Celulas de canto redondo em colunas defasadas (o box da foto)."""
    tu, tv = 0.14, 0.18
    x, z = grade(448, 576, tu, tv)
    col = np.floor(x / 0.07)
    lx = x - col * 0.07
    lz = np.mod(z + col * 0.045, 0.09)
    d = sdf_ret(lx, lz, 0.035, 0.045, 0.031, 0.041, 0.016)
    return np.clip(-d / 0.010, 0, 1) ** 0.6, (1 / tu, 1 / tu, 1 / tv)


def padrao_lado():
    """Faixa lateral do colchao: celulas estreitas em colunas defasadas (na foto
    ela e da mesma familia do box, so que menor e mais alta)."""
    tu, tv = 0.10, 0.14
    x, z = grade(400, 560, tu, tv)
    col = np.floor(x / 0.05)
    lx = x - col * 0.05
    lz = np.mod(z + col * 0.035, 0.07)
    d = sdf_ret(lx, lz, 0.025, 0.035, 0.021, 0.031, 0.012)
    return np.clip(-d / 0.008, 0, 1) ** 0.6, (1 / tu, 1 / tu, 1 / tv)


def padrao_topo():
    """Pillow-top: tufos em losango com vinco em estrela + linhas de bordado."""
    t = 0.18
    x, y = grade(640, 640, t, t)
    h = np.ones_like(x)
    for cx, cy in ((0, 0), (t, 0), (0, t), (t, t), (t / 2, t / 2)):
        dx, dy = x - cx, y - cy
        r = np.hypot(dx, dy)
        th = np.arctan2(dy, dx)
        h -= 0.45 * np.exp(-(r / 0.032) ** 2) + 0.55 * np.exp(-(r / 0.010) ** 2)
        h -= 0.35 * np.exp(-r / 0.03) * np.maximum(0, np.cos(6 * th)) ** 4 * (r < 0.065)
    g = np.abs(np.sin(2 * np.pi * (x + 0.018 * np.sin(2 * np.pi * y / 0.13)) / 0.065))
    h -= 0.28 * np.exp(-(g / 0.12) ** 2)
    g2 = np.abs(np.sin(2 * np.pi * (y + 0.02 * np.sin(2 * np.pi * x / 0.087)) / 0.087))
    h -= 0.10 * np.exp(-(g2 / 0.1) ** 2)
    h = (h - h.min()) / (h.max() - h.min())
    return h, (1 / t, 1 / t, 1 / t)


TUFO = 0.18          # malha do tufo: losango de 0,18 (vizinho mais perto a 0,127)


def tufos(x, y):
    """0 no fundo do tufo, 1 no almofadado. Tres termos, cada um com seu papel:
    tigela larga (o almofadado entre botoes), CONE fechado (o botao puxando o
    tecido -- gaussiana de 1 cm sumia numa malha de 5 mm) e vinco em estrela."""
    t = TUFO
    h = np.ones_like(x)
    for ox, oy in ((0, 0), (t / 2, t / 2)):
        dx = np.mod(x - ox + t / 2, t) - t / 2
        dy = np.mod(y - oy + t / 2, t) - t / 2
        r = np.hypot(dx, dy)
        th = np.arctan2(dy, dx)
        h -= 0.50 * np.exp(-(r / 0.045) ** 2)
        h -= 0.50 * np.maximum(0, 1 - r / 0.022) ** 1.5
        h -= 0.20 * np.exp(-r / 0.022) * np.maximum(0, np.cos(6 * th)) ** 4 * (r < 0.06)
    return np.clip(h, 0, 1)


def mancha_tufo(x, y, raio=0.026):
    """Quanto o tecido escurece dobrado dentro do botao: 1 no centro. Mais larga
    que o cone da malha -- com o raio do cone a mancha dava 3 px na imagem final."""
    t = TUFO
    m = np.zeros_like(x)
    for ox, oy in ((0, 0), (t / 2, t / 2)):
        dx = np.mod(x - ox + t / 2, t) - t / 2
        dy = np.mod(y - oy + t / 2, t) - t / 2
        m = np.maximum(m, np.exp(-(dx * dx + dy * dy) / raio ** 2))
    return m


def padrao_bordado():
    """So o que e fino demais pra malha: vinco em estrela e linha de bordado."""
    t = TUFO
    x, y = grade(640, 640, t, t)
    h = np.ones_like(x)
    for cx, cy in ((0, 0), (t, 0), (0, t), (t, t), (t / 2, t / 2)):
        dx, dy = x - cx, y - cy
        r = np.hypot(dx, dy)
        th = np.arctan2(dy, dx)
        h -= 0.35 * np.exp(-r / 0.03) * np.maximum(0, np.cos(6 * th)) ** 4 * (r < 0.065)
    g = np.abs(np.sin(2 * np.pi * (x + 0.018 * np.sin(2 * np.pi * y / 0.13)) / 0.065))
    h -= 0.28 * np.exp(-(g / 0.12) ** 2)
    g2 = np.abs(np.sin(2 * np.pi * (y + 0.02 * np.sin(2 * np.pi * x / 0.087)) / 0.087))
    h -= 0.10 * np.exp(-(g2 / 0.1) ** 2)
    h = (h - h.min()) / (h.max() - h.min())
    return h, (1 / t, 1 / t, 1 / t)


def padrao_cordao():
    x, y = grade(64, 64, 1, 1)
    return 0.5 + 0.5 * np.sin(2 * np.pi * (x + y) * 2), (60, 60, 60)


# ---------------------------------------------------------------- materiais
def escurece_por(nt, bs, atributo, minimo):
    """Multiplica a cor que chega no Base Color por um atributo da malha (0-1)."""
    lk = next(l for l in nt.links if l.to_socket == bs.inputs["Base Color"])
    at = nt.nodes.new("ShaderNodeAttribute")
    at.attribute_name = atributo
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["To Min"].default_value = minimo
    mul = nt.nodes.new("ShaderNodeMix")
    mul.data_type, mul.blend_type = "RGBA", "MULTIPLY"
    sock(mul.inputs, "Factor").default_value = 1.0
    nt.links.new(lk.from_socket, sock(mul.inputs, "A"))
    nt.links.new(at.outputs["Fac"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], sock(mul.inputs, "B"))
    nt.links.new(sock(mul.outputs, "Result"), bs.inputs["Base Color"])


def com_ao(nt, bs, dist, minimo):
    """Escurece o que a propria malha fecha (fundo do tufo): AO local multiplicando
    a cor que ja chega no Base Color. O path tracer sozinho nao chega la com luz
    suave -- o tecido de verdade tambem e mais escuro dobrado dentro do botao."""
    lk = next(l for l in nt.links if l.to_socket == bs.inputs["Base Color"])
    ao = nt.nodes.new("ShaderNodeAmbientOcclusion")
    ao.inputs["Distance"].default_value = dist
    ao.only_local = True
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["To Min"].default_value = minimo
    mul = nt.nodes.new("ShaderNodeMix")
    mul.data_type, mul.blend_type = "RGBA", "MULTIPLY"
    sock(mul.inputs, "Factor").default_value = 1.0
    nt.links.new(lk.from_socket, sock(mul.inputs, "A"))
    nt.links.new(ao.outputs["AO"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], sock(mul.inputs, "B"))
    nt.links.new(sock(mul.outputs, "Result"), bs.inputs["Base Color"])


def rugas(nt, bs):
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 9.0
    nz.inputs["Detail"].default_value = 6.0
    nz.inputs["Distortion"].default_value = 1.5
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Distance"].default_value = 0.02
    bp.inputs["Strength"].default_value = 0.6
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    nt.links.new(nz.outputs["Fac"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], bs.inputs["Normal"])


def mat_tecido(nome, cor, padrao, dist, rough=0.85, sheen=0.3, escuro=0.78, extra=None):
    h, esc = padrao()
    return material(nome, cor, rough, sheen, imagem("h_" + nome, h), esc, dist,
                    escuro=escuro, extra=extra)


M_BASE = mat_tecido("base", (182, 169, 163), padrao_base, 0.010)
M_LADO = mat_tecido("lado", (182, 168, 162), padrao_lado, 0.008)
M_TOPO = mat_tecido("topo", (156, 149, 146), padrao_bordado, 0.006, escuro=0.62)
# o fundo do tufo escurece pelo ATRIBUTO gravado na malha, nao por AO no shader:
# AO local nao escureceu nada e levou o render de 90 pra 328 s
M_TUFO = mat_tecido("tufo", (156, 149, 146), padrao_bordado, 0.006, escuro=0.62,
                    extra=lambda nt, bs: escurece_por(nt, bs, "tufo", 0.30))
M_CORD = mat_tecido("cordao", (214, 210, 206), padrao_cordao, 0.002, 0.6, 0.2)
M_PE = material("pe", (70, 45, 32), 0.5)
M_BABADO = material("babado", (112, 107, 103), 0.55, 0.5)
M_TRAV = material("travesseiro", (150, 145, 141), 0.40, 0.6, extra=lambda nt, bs: rugas(nt, bs))
M_ALM = mat_tecido("almofada", (152, 149, 144), padrao_topo, 0.008, 0.6, 0.5)
M_PAREDE = material("parede", (118, 115, 119), 0.9)
M_CRIADO = material("criado", (100, 64, 50), 0.45)
M_CORTINA = material("cortina", (122, 118, 118), 0.9, 0.5)
M_FOLHA = material("folha", (60, 80, 50), 0.55)
M_VASO = material("vaso", (200, 196, 190), 0.6)
M_TEXTO = material("bordado", (60, 50, 44), 0.7)


def piso_extra(nt, bs):
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Rotation"].default_value = (0, 0, math.pi / 2)   # tabua ao longo de Y
    br = nt.nodes.new("ShaderNodeTexBrick")
    br.inputs["Color1"].default_value = lin((72, 58, 53))
    br.inputs["Color2"].default_value = lin((64, 52, 46))
    br.inputs["Mortar"].default_value = lin((70, 56, 50))
    br.inputs["Scale"].default_value = 1.0
    br.inputs["Mortar Size"].default_value = 0.0015
    br.inputs["Brick Width"].default_value = 1.2
    br.inputs["Row Height"].default_value = 0.19
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 8.0
    mp2 = nt.nodes.new("ShaderNodeMapping")
    mp2.inputs["Scale"].default_value = (3, 60, 3)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], br.inputs["Vector"])
    nt.links.new(tc.outputs["Object"], mp2.inputs["Vector"])
    nt.links.new(mp2.outputs["Vector"], nz.inputs["Vector"])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type, mix.blend_type = "RGBA", "MULTIPLY"
    sock(mix.inputs, "Factor").default_value = 0.35
    nt.links.new(br.outputs["Color"], sock(mix.inputs, "A"))
    nt.links.new(nz.outputs["Color"], sock(mix.inputs, "B"))
    nt.links.new(sock(mix.outputs, "Result"), bs.inputs["Base Color"])


def tapete_extra(nt, bs):
    tc = nt.nodes.new("ShaderNodeTexCoord")
    wv = nt.nodes.new("ShaderNodeTexWave")
    wv.inputs["Scale"].default_value = 160.0
    wv.inputs["Distortion"].default_value = 2.0
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 300.0
    cr = nt.nodes.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].color = lin((70, 50, 40))
    cr.color_ramp.elements[1].color = lin((190, 150, 128))
    mx = nt.nodes.new("ShaderNodeMath")
    mx.operation = "MULTIPLY"
    nt.links.new(tc.outputs["Object"], wv.inputs["Vector"])
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    nt.links.new(wv.outputs["Fac"], mx.inputs[0])
    nt.links.new(nz.outputs["Fac"], mx.inputs[1])
    nt.links.new(mx.outputs["Value"], cr.inputs["Fac"])
    nt.links.new(cr.outputs["Color"], bs.inputs["Base Color"])
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Distance"].default_value = 0.002
    nt.links.new(mx.outputs["Value"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], bs.inputs["Normal"])


M_PISO = material("piso", (140, 114, 102), 0.38, extra=piso_extra)
M_TAPETE = material("tapete", (175, 140, 120), 0.95, extra=tapete_extra)

# ---------------------------------------------------------------- a cama
# box bipartido: duas metades de 0,69 com a costura no meio da frente
# box de casal e bipartido (duas metades); o de solteiro e inteirico
METADES = (((-W / 2, W / 2),) if SOLTEIRO else ((-W / 2, -0.004), (0.004, W / 2)))
for i, (x0, x1) in enumerate(METADES):
    caixa("box_%d" % i, x0, x1, Y0, Y1, ZF, ZB - 0.004, [M_BASE], bevel=0.025)
    for px in (x0 + 0.07, x1 - 0.07):
        for py in (Y0 + 0.08, Y1 - 0.08):
            bm = bmesh.new()
            bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=0.024,
                                  radius2=0.02, depth=ZF)
            for v in bm.verts:
                v.co += Vector((px, py, ZF / 2))
            obj("pe", mesh_bm("pe", bm), [M_PE])

caixa("colchao", -W / 2, W / 2, Y0, Y1, ZB, ZM, [M_LADO], bevel=0.035, seg=4)
# o tampo da caixa fica 1,2 cm ABAIXO de ZT: no mesmo plano, o fundo de cada tufo
# empatava com ele e mostrava o tampo liso no lugar do ponto escuro (r4-r6)
BAIXO = 0.012
caixa("pillowtop", -W / 2 + 0.005, W / 2 - 0.005, Y0 + 0.005, Y1 - 0.005, ZM, ZT - BAIXO,
      [M_LADO, M_TOPO], topo_slot=1, bevel=0.032, seg=5, prof=0.7)


def camada_tufos(passo=0.005, alto=0.035, borda=0.04, esmaece=0.07):
    """O tufo como GEOMETRIA. No relevo pintado (r1-r3) ele sumia: com luz suave o
    bump so inclina a normal, nao faz sombra. Aqui a malha sobe ate `alto` entre
    os tufos e encosta no tampo da caixa no fundo deles -- nunca desce abaixo do
    tampo, senao a tampa da caixa aparece pelo buraco. Nasce `borda` pra dentro
    (o chanfro da caixa ocupa 0,037) e esmaece ate zero ali, sem degrau."""
    x0, x1, y0, y1 = -W / 2 + borda, W / 2 - borda, Y0 + borda, Y1 - borda
    nx, ny = int((x1 - x0) / passo) + 1, int((y1 - y0) / passo) + 1
    xs, ys = np.linspace(x0, x1, nx), np.linspace(y0, y1, ny)
    X, Y = np.meshgrid(xs, ys)
    d = np.minimum.reduce([X - x0, x1 - X, Y - y0, y1 - Y])
    f = np.clip(d / esmaece, 0, 1)
    f = f * f * (3 - 2 * f)
    Ht = tufos(X, Y)
    Z = ZT - BAIXO + f * (BAIXO + alto * Ht)
    me = bpy.data.meshes.new("tufos")
    vs = np.stack([X, Y, Z], -1).reshape(-1, 3)
    idx = np.arange(nx * ny).reshape(ny, nx)
    q = np.stack([idx[:-1, :-1], idx[:-1, 1:], idx[1:, 1:], idx[1:, :-1]], -1).reshape(-1, 4)
    me.vertices.add(len(vs))
    me.vertices.foreach_set("co", vs.astype(np.float32).ravel())
    me.loops.add(q.size)
    me.loops.foreach_set("vertex_index", q.ravel().astype(np.int32))
    me.polygons.add(len(q))
    me.polygons.foreach_set("loop_start", (np.arange(len(q)) * 4).astype(np.int32))
    me.polygons.foreach_set("loop_total", np.full(len(q), 4, np.int32))
    me.update()
    me.validate()
    at = me.attributes.new("tufo", "FLOAT", "POINT")
    at.data.foreach_set("value", (1 - 0.85 * mancha_tufo(X, Y) * f).astype(np.float32).ravel())
    o = obj("tufos", me, [M_TUFO])
    me.polygons.foreach_set("use_smooth", np.ones(len(q), bool))
    print("tufos: %d vertices" % len(vs), flush=True)
    return o


camada_tufos()


def cordao(nome, z, r, inset=0.0, raio=0.04):
    """Vivo torcido em volta do colchao: retangulo de canto redondo com bevel."""
    cu = bpy.data.curves.new(nome, "CURVE")
    cu.dimensions, cu.bevel_depth, cu.bevel_resolution = "3D", r, 3
    sp = cu.splines.new("POLY")
    pts = []
    hx, hy = W / 2 - inset, L / 2 - inset
    for cx, cy, a0 in ((hx - raio, hy - raio, 0), (-hx + raio, hy - raio, 90),
                       (-hx + raio, -hy + raio, 180), (hx - raio, -hy + raio, 270)):
        for k in range(7):
            a = math.radians(a0 + 90 * k / 6)
            pts.append((cx + raio * math.cos(a), cy + raio * math.sin(a), z))
    sp.points.add(len(pts) - 1)
    for p, c in zip(sp.points, pts):
        p.co = (c[0], c[1], c[2], 1)
    sp.use_cyclic_u = True
    o = obj(nome, cu, [M_CORD])
    return o


cordao("vivo_base", ZB + 0.002, 0.0075, -0.004)
cordao("vivo_meio", ZM, 0.0065, -0.004)
cordao("vivo_topo", ZT - 0.022, 0.0055, 0.004, 0.05)


# etiqueta e bordado na cabeceira do pe
def etiqueta():
    h = 0.11
    w = 0.05
    img = bpy.data.images.new("etiqueta", 50, 110)
    px = np.ones((110, 50, 4), np.float32)
    yy, xx = np.mgrid[0:110, 0:50]
    circ = (xx - 25) ** 2 + (yy - 78) ** 2 < 15 ** 2
    px[circ] = (0.95, 0.55, 0.05, 1)
    px[(yy > 40) & (yy < 50) & (xx > 6) & (xx < 44)] = (0.1, 0.55, 0.35, 1)
    px[(yy > 28) & (yy < 36) & (xx > 6) & (xx < 44)] = (0.95, 0.6, 0.1, 1)
    px[(yy > 14) & (yy < 22) & (xx > 6) & (xx < 44)] = (0.9, 0.35, 0.2, 1)
    img.pixels.foreach_set(px.ravel())
    img.pack()
    m = bpy.data.materials.new("etiqueta")
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    bs = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tx = nt.nodes.new("ShaderNodeTexImage")
    tx.image = img
    nt.links.new(tx.outputs["Color"], bs.inputs["Base Color"])
    bs.inputs["Roughness"].default_value = 0.5
    bm = bmesh.new()
    x, z, y = -W / 2 + 0.10, (ZB + ZM) / 2 + 0.01, Y0 - 0.004
    vs = [bm.verts.new((x - w / 2, y, z - h / 2)), bm.verts.new((x + w / 2, y, z - h / 2)),
          bm.verts.new((x + w / 2, y, z + h / 2)), bm.verts.new((x - w / 2, y, z + h / 2))]
    f = bm.faces.new(vs)
    uv = bm.loops.layers.uv.new()
    for lp, c in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        lp[uv].uv = c
    obj("etiqueta", mesh_bm("etiqueta", bm), [m])


etiqueta()


def texto(corpo, x, z, tam, fonte="C:/Windows/Fonts/segoesc.ttf"):
    cu = bpy.data.curves.new("txt", "FONT")
    cu.body = corpo
    try:
        cu.font = bpy.data.fonts.load(fonte, check_existing=True)
    except Exception:
        pass
    cu.size, cu.extrude, cu.align_x = tam, 0.0006, "CENTER"
    o = obj("txt_" + corpo[:8], cu, [M_TEXTO])
    o.location = (x, Y0 - 0.006, z)
    o.rotation_euler = (math.pi / 2, 0, 0)
    return o


texto("Descanso", 0.0, (ZB + ZM) / 2 - 0.020, 0.12, "C:/Windows/Fonts/segoescb.ttf")
texto("Mola Ensacada", -0.03, (ZB + ZM) / 2 - 0.068, 0.017, "C:/Windows/Fonts/arial.ttf")


# ---------------------------------------------------------------- travesseiros
def travesseiro(nome, w, h, t, mat, babado=0.05, amp=0.010, nu=28, nv=22):
    bm = bmesh.new()
    vs = {}

    def co(i, j, lado):
        u, v = -1 + 2 * i / nu, -1 + 2 * j / nv
        pr = max(0.0, (1 - abs(u) ** 4) * (1 - abs(v) ** 4)) ** 0.55
        x = u * w / 2 * (1 - 0.10 * (1 - v * v))
        y = v * h / 2 * (1 - 0.12 * (1 - u * u))
        return Vector((x, y, lado * t / 2 * pr))

    def vert(i, j, lado):
        borda = i in (0, nu) or j in (0, nv)
        k = ("b", i, j) if borda else (lado, i, j)
        if k not in vs:
            vs[k] = bm.verts.new(co(i, j, lado))
        return vs[k]

    for lado in (1, -1):
        for i in range(nu):
            for j in range(nv):
                q = [vert(i, j, lado), vert(i + 1, j, lado), vert(i + 1, j + 1, lado),
                     vert(i, j + 1, lado)]
                bm.faces.new(q if lado == 1 else q[::-1])
    # babado: anel ondulado pra fora da costura
    anel = ([(i, 0) for i in range(nu)] + [(nu, j) for j in range(nv)] +
            [(i, nv) for i in range(nu, 0, -1)] + [(0, j) for j in range(nv, 0, -1)])
    n = len(anel)
    per = 2 * (w + h)
    ondas = round(per / 0.045)
    aneis = [[vs[("b", i, j)] for i, j in anel]]
    for passo in (0.5, 1.0):
        nova = []
        for k, (i, j) in enumerate(anel):
            p = vs[("b", i, j)].co
            a, b = vs[("b",) + anel[k - 1]].co, vs[("b",) + anel[(k + 1) % n]].co
            tg = (b - a).normalized()
            nr = Vector((tg.y, -tg.x, 0))
            if nr.dot(Vector((p.x, p.y, 0))) < 0:
                nr = -nr
            z = amp * passo * math.sin(2 * math.pi * ondas * k / n)
            nova.append(bm.verts.new(p + nr * babado * passo + Vector((0, 0, z))))
        aneis.append(nova)
    for r0, r1 in zip(aneis, aneis[1:]):
        for k in range(n):
            bm.faces.new((r0[k], r0[(k + 1) % n], r1[(k + 1) % n], r1[k]))
    o = obj(nome, mesh_bm(nome, bm), [mat])
    for p in o.data.polygons:
        p.use_smooth = True
    sd = o.modifiers.new("esp", "SOLIDIFY")
    sd.thickness = 0.002
    ss = o.modifiers.new("sub", "SUBSURF")
    ss.levels = ss.render_levels = 1
    return o


def travesseiro_tecido(nome, w, h, mat, pressao=1.6, babado=0.045, amp=0.022,
                       nu=44, nv=32, quadros=36, semente=1, mat_babado=None):
    """Travesseiro por SIMULACAO DE PANO, nao por formula: envelope fechado (frente e
    verso costurados na borda) inflado por pressao interna. O pano nao estica, entao
    a borda puxa pra dentro, o canto vira ponta e a ruga nasce sozinha -- o que a
    formula (r1-r6) nunca deu: ela saia com cara de cabeceira estofada."""
    bm = bmesh.new()
    vs = {}

    def vert(i, j, lado):
        borda = i in (0, nu) or j in (0, nv)
        k = ("b", i, j) if borda else (lado, i, j)
        if k not in vs:
            u, v = -1 + 2 * i / nu, -1 + 2 * j / nv
            pr = 0.0 if borda else 0.015
            vs[k] = bm.verts.new((u * w / 2, v * h / 2, lado * pr))
        return vs[k]

    for lado in (1, -1):
        for i in range(nu):
            for j in range(nv):
                q = [vert(i, j, lado), vert(i + 1, j, lado), vert(i + 1, j + 1, lado),
                     vert(i, j + 1, lado)]
                bm.faces.new(q if lado == 1 else q[::-1])
    anel = ([(i, 0) for i in range(nu)] + [(nu, j) for j in range(nv)] +
            [(i, nv) for i in range(nu, 0, -1)] + [(0, j) for j in range(nv, 0, -1)])
    bm.verts.index_update()
    borda_idx = [vs[("b", i, j)].index for i, j in anel]
    o = obj(nome, mesh_bm(nome, bm), [mat, mat_babado or mat])
    # --- inflar
    S.frame_start, S.frame_end = 1, quadros
    m = o.modifiers.new("pano", "CLOTH")
    cs = m.settings
    cs.quality, cs.mass = 8, 0.25
    cs.tension_stiffness = cs.compression_stiffness = 40.0
    cs.shear_stiffness, cs.bending_stiffness = 15.0, 0.05
    cs.use_pressure, cs.uniform_pressure_force = True, pressao
    cs.effector_weights.gravity = 0.0
    m.point_cache.frame_start, m.point_cache.frame_end = 1, quadros
    for f in range(1, quadros + 1):
        S.frame_set(f)
    me = bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    o.modifiers.remove(m)
    velho, o.data = o.data, me
    bpy.data.meshes.remove(velho)
    S.frame_set(1)
    # --- babado franzido na costura, com franzido irregular (pano de verdade)
    rng = np.random.default_rng(semente)
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    # O babado e malha PROPRIA, reamostrada ao longo da costura: na p2 ele usava os
    # 152 vertices da borda pra 124 pregas (1,2 vertice por prega) e saia faixa lisa.
    # Solto da costura, com a borda de dentro 5 mm enfiada nela -- nao precisa colar.
    pol = [bm.verts[k].co.copy() for k in borda_idx]
    seg = [(pol[(k + 1) % len(pol)] - pol[k]).length for k in range(len(pol))]
    per = sum(seg)
    ondas = round(per / 0.022)
    n = ondas * 6
    pts, k, acum = [], 0, 0.0
    for m_ in range(n):
        alvo = per * m_ / n
        while acum + seg[k] < alvo:
            acum += seg[k]
            k += 1
        f_ = (alvo - acum) / seg[k]
        pts.append(pol[k].lerp(pol[(k + 1) % len(pol)], f_))
    fase = rng.uniform(0, 2 * np.pi, 6)
    aneis = []
    for passo in (0.0, 0.33, 0.66, 1.0):
        nova = []
        for k, p in enumerate(pts):
            tg = pts[(k + 1) % n] - pts[k - 1]
            nr = Vector((tg.y, -tg.x, 0)).normalized()
            if nr.dot(Vector((p.x, p.y, 0))) < 0:
                nr = -nr
            a = 2 * np.pi * k / n
            irr = 0.65 + 0.35 * np.sin(3 * a + fase[0]) * np.sin(7 * a + fase[1])
            z = amp * passo * irr * math.sin(2 * math.pi * ondas * k / n + 0.6 * np.sin(5 * a + fase[2]))
            larg = babado * passo * (0.85 + 0.15 * irr) - 0.005
            nova.append(bm.verts.new(p + nr * larg + Vector((0, 0, z))))
        aneis.append(nova)
    for r0, r1 in zip(aneis, aneis[1:]):
        for k in range(n):
            fc = bm.faces.new((r0[k], r0[(k + 1) % n], r1[(k + 1) % n], r1[k]))
            fc.material_index = 1
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    sd = o.modifiers.new("esp", "SOLIDIFY")
    sd.thickness = 0.002
    ss = o.modifiers.new("sub", "SUBSURF")
    ss.levels = ss.render_levels = 1
    zs = [v.co.z for v in me.vertices]
    xs = [v.co.x for v in me.vertices]
    print("%s: espessura %.3f, largura %.3f" % (nome, max(zs) - min(zs), max(xs) - min(xs)), flush=True)
    return o


def poe_travesseiro(o, x, y, h, tilt, yaw=0.0):
    t = math.radians(tilt)
    o.rotation_euler = (math.pi / 2 - t, 0, math.radians(yaw))
    o.location = (x, y, ZT + h / 2 * math.cos(t) - 0.03)


if SOLTEIRO:
    p1 = travesseiro_tecido("travesseiro_esq", 0.74, 0.56, M_TRAV, semente=1, mat_babado=M_BABADO)
    poe_travesseiro(p1, 0.0, Y1 - 0.22, 0.52, 10, 0)
else:
    p1 = travesseiro_tecido("travesseiro_esq", 0.76, 0.60, M_TRAV, semente=1, mat_babado=M_BABADO)
    poe_travesseiro(p1, -0.33, Y1 - 0.22, 0.56, 10, 10)
    p2 = travesseiro_tecido("travesseiro_dir", 0.76, 0.60, M_TRAV, semente=2, mat_babado=M_BABADO)
    poe_travesseiro(p2, 0.36, Y1 - 0.24, 0.56, 12, -20)
p3 = travesseiro_tecido("almofada", 0.56, 0.52, M_ALM, babado=0.035, amp=0.016, semente=3,
                        mat_babado=M_BABADO)
poe_travesseiro(p3, 0.0 if SOLTEIRO else -0.01, Y1 - 0.44, 0.48, 16, -4)

# ---------------------------------------------------------------- o quarto
caixa("piso", -4, 4, -4, 1.0, -0.02, 0.0, [M_PISO])
caixa("parede_fundo", -4, 4, 1.0, 1.1, 0, 3.0, [M_PAREDE])
caixa("parede_esq", -1.85, -1.75, -4, 1.0, 0, 3.0, [M_PAREDE])
caixa("tapete", -1.9, 0.55, -2.7, -1.05, 0.0, 0.008, [M_TAPETE], bevel=0.004)
caixa("criado", 0.80, 1.30, 0.58, 0.98, 0.0, 0.56, [M_CRIADO], bevel=0.008)


def cortina():
    bm = bmesh.new()
    nx, nz = 60, 20
    ys = np.linspace(-0.75, 0.02, nx)
    grid = []
    for k in range(nz + 1):
        z = 2.6 * k / nz
        grid.append([bm.verts.new((-1.70 + 0.035 * math.sin(y * 2 * math.pi / 0.16), y, z))
                     for y in ys])
    for k in range(nz):
        for i in range(nx - 1):
            bm.faces.new((grid[k][i], grid[k][i + 1], grid[k + 1][i + 1], grid[k + 1][i]))
    o = obj("cortina", mesh_bm("cortina", bm), [M_CORTINA])
    for p in o.data.polygons:
        p.use_smooth = True


cortina()


def planta(x, y):
    rng = np.random.default_rng(7)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=0.15, radius2=0.18,
                          depth=0.30)
    for v in bm.verts:
        v.co += Vector((x, y, 0.15))
    obj("vaso", mesh_bm("vaso", bm), [M_VASO])
    bm = bmesh.new()
    for s in range(13):
        ang = rng.uniform(0, 2 * math.pi)
        incl = rng.uniform(0.10, 0.50)
        alt = rng.uniform(1.0, 1.45)
        base = Vector((x + 0.05 * math.cos(ang), y + 0.05 * math.sin(ang), 0.30))
        dirc = Vector((math.cos(ang) * incl, math.sin(ang) * incl, 1)).normalized()
        topo = base + dirc * alt
        # haste
        bmesh.ops.create_cone(bm, segments=5, radius1=0.006, radius2=0.004, depth=alt,
                              matrix=__import__("mathutils").Matrix.Translation((base + topo) / 2)
                              @ dirc.to_track_quat("Z", "Y").to_matrix().to_4x4())
        for f_ in range(32):
            t = rng.uniform(0.35, 1.0)
            p = base + (topo - base) * t
            a = rng.uniform(0, 2 * math.pi)
            ln = rng.uniform(0.13, 0.21)
            d = Vector((math.cos(a), math.sin(a), rng.uniform(-0.6, 0.2))).normalized()
            lado = d.cross(Vector((0, 0, 1))).normalized() * 0.028
            ponta = p + d * ln
            meio = p + d * ln * 0.45 + Vector((0, 0, 0.02))
            q = [bm.verts.new(p), bm.verts.new(meio + lado), bm.verts.new(ponta),
                 bm.verts.new(meio - lado)]
            bm.faces.new(q)
    o = obj("planta", mesh_bm("planta", bm), [M_FOLHA])
    for p in o.data.polygons:
        p.use_smooth = True


planta(-1.25, 0.80)


def abajur():
    m = bpy.data.materials.new("cupula")
    try:
        m.use_nodes = True
    except Exception:
        pass
    bs = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bs.inputs["Base Color"].default_value = lin((235, 225, 210))
    bs.inputs["Emission Color"].default_value = lin((255, 220, 180))
    bs.inputs["Emission Strength"].default_value = 6.0
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=False, segments=32, radius1=0.15, radius2=0.10,
                          depth=0.22)
    for v in bm.verts:
        v.co += Vector((0.98, 0.78, 1.00))
    obj("cupula", mesh_bm("cupula", bm), [m])
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=0.012, radius2=0.012,
                          depth=0.34)
    for v in bm.verts:
        v.co += Vector((0.98, 0.78, 0.56 + 0.17))
    obj("haste", mesh_bm("haste", bm), [M_PE])


abajur()

# ---------------------------------------------------------------- luz
def luz(nome, tipo, loc, energia, cor=(1, 1, 1), tam=1.0, mira=None):
    ld = bpy.data.lights.new(nome, tipo)
    ld.energy, ld.color = energia, cor
    if tipo == "AREA":
        ld.size = tam
    else:
        ld.shadow_soft_size = tam
    o = bpy.data.objects.new(nome, ld)
    S.collection.objects.link(o)
    o.location = loc
    if mira:
        d = Vector(mira) - Vector(loc)
        o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return o


luz("chave", "AREA", (2.4, -0.6, 2.7), 210, (1.0, 0.98, 0.97), 1.0, (0.2, 0, 0.5))
luz("preenche", "AREA", (0.6, -3.2, 2.2), 115, (1.0, 0.98, 0.95), 2.5, (0, 0, 0.5))
luz("abajur", "POINT", (0.98, 0.78, 1.02), 40, (1.0, 0.82, 0.6), 0.09)

S.world = bpy.data.worlds.new("mundo")
try:
    S.world.use_nodes = True
except Exception:
    pass
bg = next(n for n in S.world.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs[0].default_value = lin((196, 196, 200))
bg.inputs[1].default_value = 0.18

# ---------------------------------------------------------------- camera (casada)
cd = bpy.data.cameras.new("cam")
cd.sensor_fit, cd.sensor_width = "HORIZONTAL", 36.0
cd.lens = CAM["lens_mm_sensor36"]
cd.shift_x, cd.shift_y = CAM["shift_x"], CAM["shift_y"]
co_ = bpy.data.objects.new("cam", cd)
S.collection.objects.link(co_)
co_.location = CAM["location"]
co_.rotation_euler = CAM["rotation_euler"]
S.camera = co_

# ---------------------------------------------------------------- render
S.render.engine = "CYCLES"
try:
    cp = bpy.context.preferences.addons["cycles"].preferences
    for tipo in ("OPTIX", "CUDA"):
        try:
            cp.compute_device_type = tipo
            cp.get_devices()
            if any(d.type == tipo for d in cp.devices):
                for d in cp.devices:
                    d.use = d.type == tipo
                S.cycles.device = "GPU"
                print("device", tipo, flush=True)
                break
        except TypeError:
            continue
except Exception as e:
    print("sem GPU:", e, flush=True)
S.cycles.samples = int(os.environ.get("AMOSTRAS", "96"))
S.cycles.use_denoising = True
S.render.resolution_x, S.render.resolution_y = 1210, 1190
S.render.resolution_percentage = 100
S.view_settings.view_transform = "AgX"
S.render.filepath = SAIDA
if os.environ.get("SO_CENA") != "1":         # assa.py so quer a cena montada
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(AQUI, "cena.blend"))
    bpy.ops.render.render(write_still=True)
    print("ok %s em %.0f s" % (SAIDA, time.time() - T0), flush=True)

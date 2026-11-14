# -*- coding: utf-8 -*-
"""La do tapete por FIOS (sugestao do usuario: "pontos verticais com gravidade que caem uns sobre os
outros"). Um pedaco de T x T que REPETE: tufos em fileiras; cada tufo e um feixe de fios que nasce em
pe e tomba pra um lado; uma altura acumulada faz o tufo que cai depois deitar POR CIMA dos que ja estao
no chao (gravidade + colisao barata). Renderizado de cima (ortografica) com 3 x 3 copias pra emendar,
em tres passadas de emissao pura (sem luz): cor, AO e normal -> materiais/la_fios_*.png.
    blender -b --factory-startup --python tapete/fios.py"""
import os, sys, math, time
import bpy
import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
SAI = os.path.join(os.path.dirname(AQUI), "materiais")
T = float(os.environ.get("TILE", "0.5"))       # lado do pedaco (m)
RES = int(os.environ.get("RES", "1024"))
rng = np.random.default_rng(int(os.environ.get("SEMENTE", "7")))
T0 = time.time()
bpy.ops.wm.read_factory_settings(use_empty=True)
S = bpy.context.scene

# ------------------------------------------------------------------ fios
LINHA, PASSO = 0.026, 0.011                    # fileira (com SULCO entre elas) e passo curto: tufo em telha
# numero INTEIRO de fileiras no pedaco: com 1,0/0,026 = 38,5 a ultima sobrava num sulco largo = linha no tapete
LINHA = T / round(T / LINHA)
NP = 9                                         # pontos por fio
G = 0.002                                      # grade da altura acumulada (2 mm)
NG = int(round(T / G))
H = np.zeros((NG, NG), np.float32)             # altura do que ja caiu (periodica)
R_FIO = 0.0006


def h_em(x, y):
    i, j = (np.floor(x / G).astype(int) % NG), (np.floor(y / G).astype(int) % NG)
    return H[j, i]


def marca(x, y, z):
    i, j = (np.floor(x / G).astype(int) % NG), (np.floor(y / G).astype(int) % NG)
    np.maximum.at(H, (j, i), z.astype(np.float32))


tufos = []
for r in range(int(round(T / LINHA))):
    y0 = (r + 0.5) * LINHA + rng.uniform(-0.002, 0.002)
    x = rng.uniform(0, PASSO)
    corte = rng.uniform(0, T)                  # onde a fileira "comeca" a cair: emenda em lugar diferente
    while x < T:
        tufos.append((x + rng.uniform(-0.003, 0.003), y0 + rng.uniform(-0.003, 0.003), (x - corte) % T))
        x += PASSO * rng.uniform(0.8, 1.2)
# cai de tras pra frente (o seguinte deita POR CIMA do anterior). Com o mesmo comeco em todas as fileiras a
# volta do pedaco (o ultimo cobrindo o primeiro) virava uma LINHA a cada 50 cm no tapete.
tufos.sort(key=lambda t: -t[2])
tufos = [(a, b) for a, b, _ in tufos]
pts, cores = [], []
for (cx, cy) in tufos:
    L = rng.uniform(0.035, 0.060)              # comprimento do tufo
    # todos tombam PRO MESMO LADO ao longo da fileira (a crista continua da foto); pouco desvio
    ang = np.radians(rng.uniform(-12, 12))
    dirx, diry = np.cos(ang), np.sin(ang)
    tomb = np.radians(rng.uniform(45, 80))     # quanto tomba (do vertical)
    claro = rng.uniform(0.94, 1.04)
    n = rng.integers(80, 120)
    for k in range(n):
        a, rr = rng.uniform(0, 2 * np.pi), 0.0055 * np.sqrt(rng.uniform())   # feixe estreito: o sulco fica
        ox, oy = rr * np.cos(a), rr * np.sin(a)
        Lk = L * rng.uniform(0.85, 1.12)
        tk = tomb * rng.uniform(0.85, 1.12)
        t = np.linspace(0, 1, NP)
        # sobe e deita (arco), o feixe abre pra fora na ponta, um pouco de crespo
        sobe = Lk * np.sin(tk * t + 1e-6) / (tk + 1e-6) * 0 + Lk * (np.sin(tk * t) / max(tk, 1e-3))
        anda = Lk * (1 - np.cos(tk * t)) / max(tk, 1e-3)
        abre = 1 + 1.6 * t
        px = cx + ox * abre + dirx * anda + 0.0015 * np.sin(7 * t + a)
        py = cy + oy * abre + diry * anda + 0.0015 * np.cos(6 * t + a)
        pz = sobe + R_FIO
        # gravidade + colisao: o fio nao atravessa o que ja caiu ali (deita POR CIMA)
        pz = np.maximum(pz, h_em(px, py) + R_FIO * 1.5)
        pts.append(np.stack([px, py, pz], 1))
        cores.append(claro * rng.uniform(0.97, 1.03))
    marca(np.concatenate([p[:, 0] for p in pts[-n:]]), np.concatenate([p[:, 1] for p in pts[-n:]]),
          np.concatenate([p[:, 2] for p in pts[-n:]]))
P = np.concatenate(pts).astype(np.float32)
print("fios %d (%d tufos), altura max %.1f mm, %.0f s" % (len(pts), len(tufos), P[:, 2].max() * 1000, time.time() - T0), flush=True)

crv = bpy.data.hair_curves.new("la")
crv.add_curves([NP] * len(pts))
crv.position_data.foreach_set("vector", P.ravel())
raio = crv.attributes.get("radius") or crv.attributes.new("radius", "FLOAT", "POINT")
raio.data.foreach_set("value", np.tile(np.linspace(R_FIO, R_FIO * 0.4, NP), len(pts)).astype(np.float32))
ac = crv.attributes.new("claro", "FLOAT", "CURVE")
ac.data.foreach_set("value", np.array(cores, np.float32))

# ------------------------------------------------------------------ materiais (emissao pura: sem luz)
def mat_emissao(nome, construir):
    m = bpy.data.materials.new(nome)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    construir(nt, em)
    nt.links.new(em.outputs[0], out.inputs[0])
    return m


def cor_fio(nt, em):
    at = nt.nodes.new("ShaderNodeAttribute"); at.attribute_name = "claro"
    mx = nt.nodes.new("ShaderNodeMath"); mx.operation = "MULTIPLY"; mx.inputs[1].default_value = 1.0
    nt.links.new(at.outputs["Fac"], mx.inputs[0])
    nt.links.new(mx.outputs[0], em.inputs["Strength"])
    em.inputs["Color"].default_value = (0.83, 0.79, 0.70, 1)       # creme (linear)


def ao(nt, em):
    a = nt.nodes.new("ShaderNodeAmbientOcclusion"); a.inputs["Distance"].default_value = 0.02; a.samples = 8
    nt.links.new(a.outputs["AO"], em.inputs["Color"])


def normal(nt, em):
    g = nt.nodes.new("ShaderNodeNewGeometry")
    v = nt.nodes.new("ShaderNodeVectorMath"); v.operation = "MULTIPLY_ADD"
    v.inputs[1].default_value = (0.5, 0.5, 0.5); v.inputs[2].default_value = (0.5, 0.5, 0.5)
    nt.links.new(g.outputs["Normal"], v.inputs[0])
    nt.links.new(v.outputs[0], em.inputs["Color"])


M_COR = mat_emissao("cor", cor_fio)
M_AO = mat_emissao("ao", ao)
M_NOR = mat_emissao("normal", normal)
M_BASE = {"cor": mat_emissao("base_cor", lambda nt, em: em.inputs["Color"].__setattr__("default_value", (0.45, 0.42, 0.36, 1))),
          "ao": mat_emissao("base_ao", lambda nt, em: em.inputs["Color"].__setattr__("default_value", (0.0, 0.0, 0.0, 1))),
          "normal": mat_emissao("base_nor", lambda nt, em: em.inputs["Color"].__setattr__("default_value", (0.5, 0.5, 1.0, 1)))}

# 3 x 3 copias (mesmo dado) e a base
objs = []
for dx in (-1, 0, 1):
    for dy in (-1, 0, 1):
        o = bpy.data.objects.new("la_%d_%d" % (dx, dy), crv)
        S.collection.objects.link(o)
        o.location = (dx * T, dy * T, 0)
        objs.append(o)
crv.materials.append(M_COR)
me = bpy.data.meshes.new("base")
me.from_pydata([(-T, -T, 0), (2 * T, -T, 0), (2 * T, 2 * T, 0), (-T, 2 * T, 0)], [], [(0, 1, 2, 3)])
base = bpy.data.objects.new("base", me)
S.collection.objects.link(base)
me.materials.append(M_BASE["cor"])

cd = bpy.data.cameras.new("cima")
cd.type, cd.ortho_scale = "ORTHO", T
cam = bpy.data.objects.new("cima", cd)
S.collection.objects.link(cam)
cam.location = (T / 2, T / 2, 1.0)
S.camera = cam
S.world = bpy.data.worlds.new("preto")
S.render.engine = "CYCLES"
try:
    cp = bpy.context.preferences.addons["cycles"].preferences
    cp.compute_device_type = "OPTIX"; cp.get_devices()
    for d in cp.devices:
        d.use = d.type == "OPTIX"
    S.cycles.device = "GPU"
except Exception as e:
    print("sem GPU", e)
S.render.resolution_x = S.render.resolution_y = RES
S.view_settings.view_transform = "Standard"
S.cycles.use_denoising = False
S.render.image_settings.file_format = "PNG"
S.render.image_settings.color_depth = "16"
for passo, amostras in (("cor", 24), ("ao", 48), ("normal", 24)):
    crv.materials[0] = {"cor": M_COR, "ao": M_AO, "normal": M_NOR}[passo]
    me.materials[0] = M_BASE[passo]
    S.cycles.samples = amostras
    # cor e normal sao DADO, nao imagem: sem curva de cor (Standard) e sem filtro de exposicao
    S.render.filepath = os.path.join(SAI, "_fios_%s.png" % passo)
    bpy.ops.render.render(write_still=True)
    print("passada %s em %.0f s" % (passo, time.time() - T0), flush=True)

# -*- coding: utf-8 -*-
"""Assa a cama pesada (cena.py) numa cama LEVE pro navegador.

    blender -b --factory-startup --python assa.py

Cama leve = caixas de chanfro curto (o mesmo desenho do pesado, poucas faces) +
travesseiros decimados. O detalhe vira imagem: COR (com a sombra dos vincos, AO,
multiplicada nela) e RELEVO (normal map em espaco tangente). Sai em formato proprio,
como o moveis_lib.json do app: assado/cama.json + cama.bin + texturas PNG (o WebP e
feito fora, no Python do sistema).

Sem operador de edicao em lugar nenhum: mode_set TRAVA em -b. A UV e feita a mao:
cada face vai pro mapa da sua peca e do seu eixo dominante, projetada no plano dele,
e os mapas sao empilhados em prateleiras no atlas."""
import os, sys, json, math, time
import bpy, bmesh
import numpy as np
from mathutils import Vector

AQUI = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(AQUI, os.environ.get("ASSADO", "assado"))
os.makedirs(OUT, exist_ok=True)
os.environ["SO_CENA"] = "1"
exec(compile(open(os.path.join(AQUI, "cena.py"), encoding="utf-8").read(), "cena.py", "exec"))
T1 = time.time()
AM = int(os.environ.get("AM_BAKE", "64"))


def marca(q):
    print("[%6.1fs] %s" % (time.time() - T1, q), flush=True)


ob = bpy.data.objects
QUARTO = ["piso", "parede_fundo", "parede_esq", "tapete", "criado", "cortina", "vaso",
          "planta", "cupula", "haste"]
TRAV = [n for n in ("travesseiro_esq", "travesseiro_dir", "almofada") if n in bpy.data.objects]


# ---------------------------------------------------------------- utilidades
def para_malha(o):
    """Curva/texto -> malha (selecionado-pro-ativo so confia em malha)."""
    me = bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    n = bpy.data.objects.new(o.name + "_m", me)
    S.collection.objects.link(n)
    n.matrix_world = o.matrix_world.copy()
    for m in o.data.materials:
        if m and not me.materials:
            me.materials.append(m)
    o.hide_render = True
    return n


def malha_avaliada(o, nome):
    """Aplica os modificadores (sem operador) e devolve um objeto novo no mundo."""
    me = bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    me.transform(o.matrix_world)
    n = bpy.data.objects.new(nome, me)
    S.collection.objects.link(n)
    return n


def caixa_baixa(nome, x0, x1, y0, y1, z0, z1, bevel):
    o = caixa(nome, x0, x1, y0, y1, z0, z1, [], bevel=bevel, seg=2)
    n = malha_avaliada(o, nome + "_lo")
    bpy.data.objects.remove(o)
    return n


def junta(nome, objs):
    """Junta malhas (ja em coordenada de mundo) numa so, guardando a PECA por face."""
    bm = bmesh.new()
    peca = bm.faces.layers.int.new("peca")
    for k, o in enumerate(objs):
        tmp = bmesh.new()
        tmp.from_mesh(o.data)
        mapa = {v: bm.verts.new(v.co) for v in tmp.verts}
        for f in tmp.faces:
            nf = bm.faces.new([mapa[v] for v in f.verts])
            nf[peca] = k
            nf.smooth = f.smooth
        tmp.free()
        bpy.data.objects.remove(o)
    me = bpy.data.meshes.new(nome)
    bm.to_mesh(me)
    bm.free()
    n = bpy.data.objects.new(nome, me)
    S.collection.objects.link(n)
    return n


def empacota(caixas, tam, pad=6):
    """Atlas por SKYLINE (canto inferior-esquerdo mais baixo) com rotacao de 90 graus.
    A versao de prateleira deixava 50% do atlas do colchao vazio: a prateleira tinha a
    altura do tampo (o mapa mais alto) e as faixas laterais iam UMA fileira ao lado dele.
    `caixas` = [(chave, (w, h) em metros, escala)]. Devolve (px por metro, {chave: (x, y, gira)})."""
    area = sum(sz[0] * sz[1] * e * e for _, sz, e in caixas)
    D = math.sqrt(tam * tam / area)
    while True:
        sky, pos, ok = [[0.0, 0.0, float(tam)]], {}, True       # segmentos [x, y, largura]
        for k, sz, e in sorted(caixas, key=lambda c: -max(c[1]) * c[2]):
            melhor = None
            for gira in (False, True):
                w = (sz[1] if gira else sz[0]) * D * e + pad
                h = (sz[0] if gira else sz[1]) * D * e + pad
                for i in range(len(sky)):
                    x = sky[i][0]
                    if x + w > tam + 1e-6:
                        break
                    y, j, fim = 0.0, i, x + w
                    while j < len(sky) and sky[j][0] < fim - 1e-9:
                        y = max(y, sky[j][1])
                        j += 1
                    if y + h <= tam + 1e-6 and (melhor is None or (y + h, x) < (melhor[0] + melhor[4], melhor[1])):
                        melhor = (y, x, w, gira, h)
            if melhor is None:
                ok = False
                break
            y, x, w, gira, h = melhor
            pos[k] = (x + pad / 2, y + pad / 2, gira)
            novo, fim = [], x + w
            for sx, sy, sw in sky:                               # recorta o que o retangulo cobre
                if sx + sw <= x or sx >= fim:
                    novo.append([sx, sy, sw])
                    continue
                if sx < x:
                    novo.append([sx, sy, x - sx])
                if sx + sw > fim:
                    novo.append([fim, sy, sx + sw - fim])
            novo.append([x, y + h, w])
            sky = sorted(novo)
        if ok:
            return D, pos
        D *= 0.97


def uv_atlas(o, tam, eixo_local=None, escala_oculta=None, pad=6):
    """UV por mapas: (peca, eixo dominante) -> projecao no plano do eixo; prateleiras.
    `escala_oculta(peca, eixo)` encolhe o que nunca aparece (fundo, face colada)."""
    me = o.data
    bm = bmesh.new()
    bm.from_mesh(me)
    peca = bm.faces.layers.int.get("peca")
    uvl = bm.loops.layers.uv.new("UVMap")
    R = eixo_local or (lambda co: co)
    mapas = {}
    for f in bm.faces:
        n = R(f.normal, normal=True) if eixo_local else f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        sg = 1 if n[ax] > 0 else -1
        k = (f[peca] if peca else 0, ax, sg)
        mapas.setdefault(k, []).append(f)

    def proj(co, ax, sg):
        x, y, z = co
        return {(0, 1): (y, z), (0, -1): (-y, z), (1, 1): (-x, z), (1, -1): (x, z),
                (2, 1): (x, y), (2, -1): (-x, y)}[(ax, sg)]

    caixas = []
    for k, fs in mapas.items():
        pts = [proj(R(l.vert.co), k[1], k[2]) for f in fs for l in f.loops]
        a = np.array(pts)
        mn, mx = a.min(0), a.max(0)
        e = escala_oculta(*k) if escala_oculta else 1.0
        caixas.append([k, mn, mx - mn, e])
    D, pos = empacota([(c[0], c[2], c[3]) for c in caixas], tam)
    cx = {c[0]: c for c in caixas}
    for k, fs in mapas.items():
        _, mn, sz, e = cx[k]
        ox, oy, gira = pos[k]
        for f in fs:
            for l in f.loops:
                p = proj(R(l.vert.co), k[1], k[2])
                u, v = p[0] - mn[0], p[1] - mn[1]
                if gira:
                    u, v = v, sz[0] - u
                l[uvl].uv = ((ox + u * D * e) / tam, (oy + v * D * e) / tam)
    bm.to_mesh(me)
    bm.free()
    marca("%s: %d mapas, %.0f px/m" % (o.name, len(mapas), D))
    return D


def alvo(o, nome, tam):
    """Material com a imagem-alvo ATIVA (e onde o bake escreve)."""
    img = bpy.data.images.new(nome, tam, tam, alpha=False, float_buffer=True)
    if "normal" in nome:
        img.colorspace_settings.name = "Non-Color"
    m = bpy.data.materials.new("bake_" + nome)
    try:
        m.use_nodes = True
    except Exception:
        pass
    t = m.node_tree.nodes.new("ShaderNodeTexImage")
    t.image = img
    m.node_tree.nodes.active = t
    o.data.materials.clear()
    o.data.materials.append(m)
    return img


def assa(baixo, altos, tipo, img, extr, dist, **kw):
    for x in bpy.context.view_layer.objects:
        x.select_set(False)
    for a in altos:
        a.select_set(True)
    baixo.select_set(True)
    bpy.context.view_layer.objects.active = baixo
    baixo.data.materials[0].node_tree.nodes.active.image = img
    S.cycles.samples = {"NORMAL": 4, "DIFFUSE": 4, "AO": AM}[tipo]
    t0 = time.time()
    bpy.ops.object.bake(type=tipo, use_selected_to_active=True, cage_extrusion=extr,
                        max_ray_distance=dist, margin=8, use_clear=True, **kw)
    marca("bake %s em %s: %.0f s" % (tipo, baixo.name, time.time() - t0))


def grava(img, nome):
    img.filepath_raw = os.path.join(OUT, nome + ".png")
    img.file_format = "PNG"
    img.save()


def px(img):
    a = np.empty(len(img.pixels), np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(img.size[1], img.size[0], 4)


def cor_com_ao(cor, ao, nome, forca=0.55):
    """Cor assada x AO (so a cama, sem quarto): o vinco escuro vai DENTRO da cor."""
    grava(cor, nome + "_crua")
    grava(ao, nome + "_ao")


# ---------------------------------------------------------------- preparo
S.render.engine = "CYCLES"
S.cycles.samples = AM
S.world.light_settings.distance = 0.12            # alcance do AO assado
for nome in QUARTO:
    ob[nome].hide_render = True
altos_corpo = [o for o in ob if o.name.startswith("box_")] + [ob["colchao"], ob["pillowtop"],
               ob["tufos"], ob["etiqueta"]]
for o in list(ob):
    if o.type in ("CURVE", "FONT"):
        altos_corpo.append(para_malha(o))

# ---------------------------------------------------------------- cama leve
pecas = [caixa_baixa("box%d" % i, x0, x1, Y0, Y1, ZF, ZB - 0.004, 0.025)
         for i, (x0, x1) in enumerate(METADES)] + [
    caixa_baixa("colch", -W / 2, W / 2, Y0, Y1, ZB, ZM, 0.035),
    # o topo leve fica no MEIO da altura dos tufos (eles vao de -1,2 a +3,5 cm de ZT)
    caixa_baixa("ptop", -W / 2 + 0.005, W / 2 - 0.005, Y0 + 0.005, Y1 - 0.005, ZM,
                ZT + 0.008, 0.032),
]
corpo = junta("cama_corpo", pecas)


NB = len(METADES)       # pecas 0..NB-1 = box, NB = colchao, NB+1 = pillow-top


def oculto(p, ax, sg):
    # fundo de tudo, topo do box e do colchao (cobertos), lado interno das metades
    if ax == 2 and (sg < 0 or p <= NB):
        return 0.15
    if NB == 2 and ax == 0 and ((p == 0 and sg > 0) or (p == 1 and sg < 0)):
        return 0.15
    return 1.0


def invisivel(o):
    """A malha leve fica DENTRO da pesada (no meio da altura dos tufos): se o raio do
    AO enxergar ela, cada vale de tufo sai preto. Some pro raio, segue alvo do bake."""
    for k in ("visible_camera", "visible_diffuse", "visible_glossy", "visible_shadow",
              "visible_transmission", "visible_volume_scatter"):
        setattr(o, k, False)


invisivel(corpo)
TAM_C = int(os.environ.get("TAM_CORPO", "2048"))
uv_atlas(corpo, TAM_C, escala_oculta=oculto)
for p in corpo.data.polygons:
    p.use_smooth = True

# travesseiros: decimados, UV frente/verso no plano do proprio travesseiro
trav_lo = []
for nome in TRAV:
    hi = ob[nome]
    lo_me = bpy.data.meshes.new_from_object(hi.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    tmp = bpy.data.objects.new(nome + "_tmp", hi.data.copy())
    S.collection.objects.link(tmp)
    tmp.matrix_world = hi.matrix_world.copy()
    dm = tmp.modifiers.new("dec", "DECIMATE")
    dm.ratio = float(os.environ.get("DECIMA", "0.09"))   # o relevo assado segura o detalhe
    lo = malha_avaliada(tmp, nome + "_lo")
    bpy.data.objects.remove(tmp)
    bpy.data.meshes.remove(lo_me)
    for p in lo.data.polygons:
        p.use_smooth = True
    trav_lo.append((hi, lo))
# os tres num atlas so (uma imagem, uma chamada de desenho a menos por mapa)
trav = junta("travesseiros", [lo for _, lo in trav_lo])
inv = {}
for k, (hi, _) in enumerate(trav_lo):
    inv[k] = hi.matrix_world.inverted()
bm = bmesh.new()
bm.from_mesh(trav.data)
peca = bm.faces.layers.int.get("peca")
uvl = bm.loops.layers.uv.new("UVMap")
# UV no referencial LOCAL de cada travesseiro (frente = +z local), em prateleiras
cx = {}
for f in bm.faces:
    k = f[peca]
    M = inv[k]
    nl = (M.to_3x3() @ f.normal)
    sg = 1 if nl.z > 0 else -1
    cx.setdefault((k, sg), []).append(f)
TAM_T = int(os.environ.get("TAM_TRAV", "1024"))
caixas = []
for (k, sg), fs in cx.items():
    a = np.array([(inv[k] @ l.vert.co)[:2] for f in fs for l in f.loops])
    caixas.append(((k, sg), a.min(0), a.max(0) - a.min(0)))
D, pos = empacota([(c[0], c[2], 1.0) for c in caixas], TAM_T)
cxs = {c[0]: c for c in caixas}
for (k, sg), fs in cx.items():
    ox, oy, gira = pos[(k, sg)]
    _, mn, sz = cxs[(k, sg)]
    for f in fs:
        for l in f.loops:
            p = inv[k] @ l.vert.co
            u = (p.x - mn[0]) if sg > 0 else (mn[0] + sz[0] - p.x)
            v = p.y - mn[1]
            if gira:
                u, v = v, sz[0] - u
            l[uvl].uv = ((ox + u * D) / TAM_T, (oy + v * D) / TAM_T)
bm.to_mesh(trav.data)
bm.free()
invisivel(trav)
marca("travesseiros: %d faces, %.0f px/m" % (len(trav.data.polygons), D))

# ---------------------------------------------------------------- bake
img_n = alvo(corpo, "corpo_normal", TAM_C)
if os.environ.get("REFAZ_NORMAL") == "1" or not os.path.exists(os.path.join(OUT, "corpo_normal.png")):
    assa(corpo, altos_corpo, "NORMAL", img_n, 0.05, 0.10, normal_space="TANGENT")
    grava(img_n, "corpo_normal")
img_c = bpy.data.images.new("corpo_cor_crua", TAM_C, TAM_C, alpha=False, float_buffer=True)
assa(corpo, altos_corpo, "DIFFUSE", img_c, 0.05, 0.10, pass_filter={"COLOR"})
img_a = bpy.data.images.new("corpo_ao", TAM_C, TAM_C, alpha=False, float_buffer=True)
for o in TRAV:
    ob[o].hide_render = True
assa(corpo, altos_corpo, "AO", img_a, 0.05, 0.10)
for o in TRAV:
    ob[o].hide_render = False
cor_com_ao(img_c, img_a, "corpo_cor")

altos_trav = [hi for hi, _ in trav_lo]
img_n = alvo(trav, "trav_normal", TAM_T)
assa(trav, altos_trav, "NORMAL", img_n, 0.03, 0.06, normal_space="TANGENT")
grava(img_n, "trav_normal")
img_c = bpy.data.images.new("trav_cor_crua", TAM_T, TAM_T, alpha=False, float_buffer=True)
assa(trav, altos_trav, "DIFFUSE", img_c, 0.03, 0.06, pass_filter={"COLOR"})
img_a = bpy.data.images.new("trav_ao", TAM_T, TAM_T, alpha=False, float_buffer=True)
assa(trav, altos_trav, "AO", img_a, 0.03, 0.06)
cor_com_ao(img_c, img_a, "trav_cor", 0.45)


# ---------------------------------------------------------------- exporta
def arrays(o, mundo=True):
    me = bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    if mundo:
        me.transform(o.matrix_world)
    me.calc_loop_triangles()
    nt = len(me.loop_triangles)
    li = np.empty(nt * 3, np.int32)
    me.loop_triangles.foreach_get("loops", li)
    vi = np.empty(len(me.loops), np.int32)
    me.loops.foreach_get("vertex_index", vi)
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)[vi[li]]
    nr = np.empty(len(me.loops) * 3, np.float32)
    me.corner_normals.foreach_get("vector", nr)
    nr = nr.reshape(-1, 3)[li]
    uv = None
    if me.uv_layers:
        u = np.empty(len(me.loops) * 2, np.float32)
        me.uv_layers[0].data.foreach_get("uv", u)
        uv = u.reshape(-1, 2)[li]
    bpy.data.meshes.remove(me)
    z = lambda a: np.stack([a[:, 0], a[:, 2], -a[:, 1]], 1)    # Blender z-cima -> three y-cima
    return z(co), z(nr), uv


def cor_de(o):
    m = o.active_material
    if not m:
        return [0.5, 0.5, 0.5]
    bs = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if not bs:
        return [0.5, 0.5, 0.5]
    c = bs.inputs["Base Color"].default_value
    return [round(c[0], 4), round(c[1], 4), round(c[2], 4)]


blob = bytearray()
cat = []


def poe(nome, o, extra):
    global blob
    co, nr, uv = arrays(o)
    item = {"nome": nome, "n": int(len(co)), "pos": len(blob)}
    blob += co.tobytes()
    item["nor"] = len(blob)
    blob += nr.tobytes()
    if uv is not None:
        item["uv"] = len(blob)
        blob += uv.astype(np.float32).tobytes()
    item.update(extra)
    cat.append(item)


poe("cama", corpo, {"map": "corpo_cor", "normalMap": "corpo_normal", "rough": 0.85})
poe("travesseiros", trav, {"map": "trav_cor", "normalMap": "trav_normal", "rough": 0.55})
pes = junta("pes", [malha_avaliada(o, "pe_m") for o in list(ob) if o.name.startswith("pe")
                    and o.type == "MESH" and not o.name.startswith("pe_m")])
pes.data.materials.append(ob["box_0"].active_material)
poe("pes", pes, {"cor": list(lin((70, 45, 32))[:3]), "rough": 0.5})
for nome in QUARTO:
    o = ob[nome]
    ex = {"cor": cor_de(o), "rough": 0.8, "quarto": 1}
    if nome == "cupula":
        ex["emissiva"] = 1
    if nome in ("cortina", "planta"):
        ex["duplo"] = 1
    poe(nome, o, ex)
open(os.path.join(OUT, "cama.bin"), "wb").write(bytes(blob))
json.dump({"objetos": cat, "camera": CAM}, open(os.path.join(OUT, "cama.json"), "w"), indent=1)
tri = {c["nome"]: c["n"] // 3 for c in cat}
marca("exportado: %s  (%d KB bin)" % (tri, len(blob) // 1024))

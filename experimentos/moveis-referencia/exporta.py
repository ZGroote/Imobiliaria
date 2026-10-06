# -*- coding: utf-8 -*-
"""Peca do Blender -> pacote pro navegador, nas DUAS estrategias com a MESMA geometria:

  B  material compartilhado: cada grupo de material usa a textura de materiais/ (repete, UV em
     metro) + um AO pequeno da peca inteira (UV2 de atlas). A madeira e uma imagem so pra casa.
  A  textura unica: a cor ja com a madeira E o AO assados num atlas so da peca (UV2).

    blender -b --factory-startup --python exporta.py -- peca [tam_atlas]
    -> web/<peca>/peca.json + geo.bin + ao.png + unica_crua.png (cor sem AO; o AO entra no prep)

Sem operador de edicao (mode_set TRAVA em -b) e sem bmesh: tudo vira sopa de triangulos em
numpy; UV2 por projecao de caixa, ilha = (objeto, eixo, sentido), empacotada por skyline (o
empacotador da cama). A malha do bake sai da sopa por from_pydata, com a normal de canto."""
import os, sys, json, math, time
import bpy
import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[sys.argv.index("--") + 1:]
PECA = ARGS[0]
TAM = int(ARGS[1]) if len(ARGS) > 1 else 1024
AM = int(os.environ.get("AM_BAKE", "64"))
DIST_AO = float(os.environ.get("DIST_AO", "0.15"))
EXTR = float(os.environ.get("EXTRUSAO", "0.004"))
OUT = os.path.join(AQUI, "web", PECA + os.environ.get("SUFIXO", ""))
os.makedirs(OUT, exist_ok=True)
os.environ["SO_CENA"] = "1"
sys.path.insert(0, AQUI)
exec(compile(open(os.path.join(AQUI, PECA, "cena.py"), encoding="utf-8").read(), "cena.py",
             "exec"), {"__file__": os.path.join(AQUI, PECA, "cena.py"), "__name__": "cena"})
import kit
S = kit.S
T1 = time.time()


def marca(q):
    print("[%6.1fs] %s" % (time.time() - T1, q), flush=True)


# ---------------------------------------------------------------- sopa de triangulos
pecas = [o for o in S.objects if o.type == "MESH" and o.name not in kit.AMB]
dg = bpy.context.evaluated_depsgraph_get()
P, N, U, MI, OB = [], [], [], [], []
mats = []
def baixa(o):
    """Malha do navegador: a avaliada, ou decimada ate o["tri_alvo"] (estofado de pano tem 30 mil
    tri por almofada; o detalhe volta como relevo assado da alta)."""
    alvo = o.get("tri_alvo")
    alvo = alvo and alvo * float(os.environ.get("TRI_ESCALA", "1"))
    if not alvo:
        return bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    me.calc_loop_triangles()
    nt = len(me.loop_triangles)
    bpy.data.meshes.remove(me)
    m = o.modifiers.new("dec", "DECIMATE")
    m.ratio = min(1.0, alvo / max(nt, 1))
    dg.update()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    o.modifiers.remove(m)
    dg.update()
    return me


for k, o in enumerate(pecas):
    me = baixa(o)
    me.transform(o.matrix_world)
    me.calc_loop_triangles()
    nt = len(me.loop_triangles)
    li = np.empty(nt * 3, np.int32)
    me.loop_triangles.foreach_get("loops", li)
    mi = np.empty(nt, np.int32)
    me.loop_triangles.foreach_get("material_index", mi)
    vi = np.empty(len(me.loops), np.int32)
    me.loops.foreach_get("vertex_index", vi)
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get("co", co)
    nr = np.empty(len(me.loops) * 3, np.float32)
    me.corner_normals.foreach_get("vector", nr)
    uv = np.zeros(len(me.loops) * 2, np.float32)
    if me.uv_layers:
        me.uv_layers[0].data.foreach_get("uv", uv)
    P.append(co.reshape(-1, 3)[vi[li]])
    N.append(nr.reshape(-1, 3)[li])
    U.append(uv.reshape(-1, 2)[li])
    for m in me.materials:
        if m.name not in mats:
            mats.append(m.name)
    MI.append(np.repeat([mats.index(me.materials[i].name) for i in mi] if nt else [], 3).astype(np.int32))
    OB.append(np.full(nt * 3, k, np.int32))
    bpy.data.meshes.remove(me)
P, N, U, MI, OB = (np.concatenate(a) for a in (P, N, U, MI, OB))
NT = len(P) // 3
marca("%d objetos, %d triangulos, materiais %s" % (len(pecas), NT, mats))


# ---------------------------------------------------------------- UV2: atlas por ilha
def empacota(caixas, tam, pad=10):
    """Skyline com giro de 90 graus (o da cama). caixas = [(chave, (w, h) m, escala)]."""
    area = sum(sz[0] * sz[1] * e * e for _, sz, e in caixas)
    D = math.sqrt(tam * tam / area)
    while True:
        sky, pos, ok = [[0.0, 0.0, float(tam)]], {}, True
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
            for sx, sy, sw in sky:
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


tri = P.reshape(NT, 3, 3)
fn = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
ax = np.argmax(np.abs(fn), 1)
sg = np.where(fn[np.arange(NT), ax] > 0, 1, -1)
# plano de projecao por eixo/sentido (u, v) -- espelhado pra a face nao sair invertida
PROJ = {(0, 1): (1, 2, 1), (0, -1): (1, 2, -1), (1, 1): (0, 2, -1), (1, -1): (0, 2, 1),
        (2, 1): (0, 1, 1), (2, -1): (0, 1, -1)}
chave = OB[::3] * 8 + ax * 2 + (sg > 0)
uv2 = np.zeros((NT * 3, 2), np.float32)
caixas, info = [], {}
for c in np.unique(chave):
    t = np.nonzero(chave == c)[0]
    a, s = int(ax[t[0]]), int(sg[t[0]])
    iu, iv, esp = PROJ[(a, s)]
    pts = tri[t].reshape(-1, 3)
    q = np.stack([pts[:, iu] * esp, pts[:, iv]], 1)
    mn, mx = q.min(0), q.max(0)
    # o que nunca aparece encolhe: costas (contra a parede) e fundo
    e = 0.2 if (a == 1 and s > 0) or (a == 2 and s < 0) else 1.0
    caixas.append((int(c), tuple(np.maximum(mx - mn, 1e-4)), e))
    info[int(c)] = (t, q, mn, e)
D, pos = empacota(caixas, TAM)
for c, (t, q, mn, e) in info.items():
    ox, oy, gira = pos[c]
    uu, vv = q[:, 0] - mn[0], q[:, 1] - mn[1]
    if gira:
        uu, vv = vv, (q[:, 0].max() - mn[0]) - uu
    idx = (t[:, None] * 3 + np.arange(3)).ravel()
    uv2[idx] = np.stack([(ox + uu * D * e) / TAM, (oy + vv * D * e) / TAM], 1)
marca("atlas %d px: %d ilhas, %.0f px/m" % (TAM, len(caixas), D))

# ---------------------------------------------------------------- malhas do bake (da sopa), UMA POR PECA
# Selecionado->ativo com tudo junto deixava o raio da almofada acertar o encosto (elas se
# interpenetram): o relevo saia com bloco verde-oliva e risco na borda da ilha. Cada baixa so
# enxerga a SUA alta; o AO continua vendo as vizinhas (elas seguem visiveis pro raio).
baixas = []
TG = np.zeros((NT * 3, 4), np.float32)
for k, o in enumerate(pecas):
    sel = OB == k
    if not sel.any():
        continue
    n = int(sel.sum())
    me = bpy.data.meshes.new(o.name + "_bake")
    # SOLDADA por posicao (a UV e a normal seguem por canto): em sopa o MikkTSpace da uma tangente
    # por triangulo -- o relevo saia assado em base facetada e a tangente nao fundia vertice
    vu, inv = np.unique(np.round(P[sel], 6), axis=0, return_inverse=True)
    f3 = inv.ravel().reshape(-1, 3).copy()
    # triangulo que a solda achataria (chanfro minusculo) ganha vertices proprios: degenerado
    # derruba o calc_tangents (EXCEPTION_ACCESS_VIOLATION na geladeira)
    deg = (f3[:, 0] == f3[:, 1]) | (f3[:, 1] == f3[:, 2]) | (f3[:, 0] == f3[:, 2])
    if deg.any():
        extra = P[sel].reshape(-1, 3, 3)[deg].reshape(-1, 3)
        f3[deg] = len(vu) + np.arange(len(extra)).reshape(-1, 3)
        vu = np.concatenate([vu, extra])
    me.from_pydata(vu.astype(np.float64).tolist(), [], f3.tolist())
    for m in mats:
        me.materials.append(bpy.data.materials[m])
    me.polygons.foreach_set("material_index", MI[sel][::3])
    lu = me.uv_layers.new(name="UVMap")
    lu.data.foreach_set("uv", U[sel].ravel())
    la = me.uv_layers.new(name="atlas")
    la.data.foreach_set("uv", uv2[sel].ravel())
    me.polygons.foreach_set("use_smooth", np.ones(n // 3, bool))
    me.normals_split_custom_set(N[sel].astype(np.float64).tolist())
    me.uv_layers.active = la                 # o bake escreve na UV ATIVA...
    lu.active_render = True                  # ...e o material le a textura na de RENDER (UV em metro)
    bko = bpy.data.objects.new(o.name + "_bake", me)
    S.collection.objects.link(bko)
    for k_ in ("visible_camera", "visible_diffuse", "visible_glossy", "visible_shadow", "visible_transmission",
               "visible_volume_scatter"):
        setattr(bko, k_, False)              # a baixa e alvo, nao obstaculo
    baixas.append((o, bko))
    me.calc_tangents(uvmap="atlas")
    tg = np.empty(len(me.loops) * 3, np.float32)
    me.loops.foreach_get("tangent", tg)
    sgn = np.empty(len(me.loops), np.float32)
    me.loops.foreach_get("bitangent_sign", sgn)
    TG[sel] = np.concatenate([tg.reshape(-1, 3), sgn[:, None]], 1)
for n in kit.AMB:
    S.objects[n].hide_render = True       # AO e cor so da peca: a casa poe o resto


def alvo_img(nome, cor):
    img = bpy.data.images.new(nome, TAM, TAM, alpha=False, float_buffer=True)
    if not cor:
        img.colorspace_settings.name = "Non-Color"
    for m in {bpy.data.materials[x] for x in mats}:
        nt = m.node_tree
        t = next((n for n in nt.nodes if n.name == "alvo_bake"), None) or nt.nodes.new("ShaderNodeTexImage")
        t.name = "alvo_bake"
        t.image = img
        nt.nodes.active = t
    return img


def assa(tipo, img, **kw):
    S.cycles.samples = {"DIFFUSE": 8, "AO": AM, "NORMAL": 4}[tipo]
    t0 = time.time()
    for i, (o, bko) in enumerate(baixas):
        for x in bpy.context.view_layer.objects:
            x.select_set(False)
        o.select_set(True)
        bko.select_set(True)
        bpy.context.view_layer.objects.active = bko
        # margem <= metade do respiro entre ilhas (pad 10): a peca seguinte nao pinta a anterior
        bpy.ops.object.bake(type=tipo, margin=4, use_clear=(i == 0), use_selected_to_active=True,
                            cage_extrusion=EXTR, max_ray_distance=EXTR * 2, **kw)
    marca("bake %s: %.0f s (%d pecas)" % (tipo, time.time() - t0, len(baixas)))


def grava(img, nome):
    img.filepath_raw = os.path.join(OUT, nome + ".png")
    img.file_format = "PNG"
    img.save()


S.render.engine = "CYCLES"
S.world.light_settings.distance = DIST_AO
img = alvo_img("ao", False)
assa("AO", img)
grava(img, "ao")
img = alvo_img("unica_crua", True)
assa("DIFFUSE", img, pass_filter={"COLOR"})
grava(img, "unica_crua")
img = alvo_img("relevo", False)
assa("NORMAL", img, normal_space="TANGENT")
grava(img, "relevo")

# ---------------------------------------------------------------- ambiente 360 (o reflexo igual no navegador)
# Equiretangular do centro da peca, sem a peca. Centro da imagem = +X do Blender (= +x do three);
# direita = -Y (= +z do three); linha 0 do Blender e a de BAIXO (= v 0 do three). Lampada fica de
# fora (vai como luz direcional, senao conta duas vezes); plano emissivo (softbox) entra.
for _, bko in baixas:
    bko.hide_render = True
for o in pecas:
    o.hide_render = True
for n in kit.AMB:
    o = S.objects[n]
    o.hide_render = False
    o.visible_camera = True
cd = bpy.data.cameras.new("pano")
cd.type = "PANO"
try:
    cd.panorama_type = "EQUIRECTANGULAR"
except AttributeError:
    cd.cycles.panorama_type = "EQUIRECTANGULAR"
cp = bpy.data.objects.new("pano", cd)
S.collection.objects.link(cp)
cp.location = tuple(((P.min(0) + P.max(0)) / 2).tolist())
cp.rotation_euler = (math.pi / 2, 0.0, -math.pi / 2)
cam0, S.camera = S.camera, cp
S.render.film_transparent = False
S.render.resolution_x, S.render.resolution_y, S.render.resolution_percentage = 512, 256, 100
S.cycles.samples = 64
S.render.image_settings.file_format = "OPEN_EXR"
pano = os.path.join(OUT, "_ambiente.exr")
S.render.filepath = pano
bpy.ops.render.render(write_still=True)
S.camera = cam0
im = bpy.data.images.load(pano)
px = np.empty(len(im.pixels), np.float32)
im.pixels.foreach_get(px)
px = px.reshape(256, 512, 4)
px[..., 3] = 1.0
open(os.path.join(OUT, "ambiente.bin"), "wb").write(px.astype(np.float16).tobytes())
marca("ambiente 512x256 (media %.3f, max %.2f)" % (px[..., :3].mean(), px[..., :3].max()))

# ---------------------------------------------------------------- geometria indexada e quantizada
blob = bytearray()


def alinha():
    while len(blob) % 4:
        blob.append(0)


def put(arr):
    alinha()
    o = len(blob)
    blob.extend(arr.tobytes())
    return o


z3 = lambda a: np.stack([a[:, 0], a[:, 2], -a[:, 1]], 1)      # Blender z-cima -> three y-cima
# Formato 2 (enxuga_geo.py mediu: sofa 132 -> 83 KB, cozinha 73 -> 22 KB com brotli, sem mudar forma):
#  - vertice renumerado pela 1a aparicao no indice (indice quase sequencial)
#  - posicao e UVs em 12 bits (0,5 mm numa peca de 2 m; 1/4 px no atlas de 1024), em DIFERENCA do
#    vertice anterior (Int16); indice em diferenca com zigzag. O leitor desfaz por soma acumulada.
Q = 4095
def delta(a):
    return np.diff(a.astype(np.int32), axis=0, prepend=np.zeros((1,) + a.shape[1:], np.int32)).astype(np.int16)


grupos = []
for mi_, nome in enumerate(mats):
    sel = MI == mi_
    if not sel.any():
        continue
    p, n, u, u2 = z3(P[sel]), z3(N[sel]), U[sel], uv2[sel]
    tg = np.concatenate([z3(TG[sel][:, :3]), TG[sel][:, 3:]], 1)
    qt = np.round(np.clip(tg, -1, 1) * 127).astype(np.int8)
    mn, mx = p.min(0), p.max(0)
    qp = np.round((p - mn) / np.maximum(mx - mn, 1e-9) * Q).astype(np.uint16)
    qn = np.round(np.clip(n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9), -1, 1) * 127).astype(np.int8)
    umn, umx = u.min(0), u.max(0)
    qu = np.round((u - umn) / np.maximum(umx - umn, 1e-9) * Q).astype(np.uint16)
    q2 = np.round(np.clip(u2, 0, 1) * Q).astype(np.uint16)
    tem_tan = bool(np.abs(TG[sel][:, :3]).sum() > 0)
    partes = [qp.view(np.uint8).reshape(len(p), -1), qn.view(np.uint8).reshape(len(p), -1),
              qu.view(np.uint8).reshape(len(p), -1), q2.view(np.uint8).reshape(len(p), -1)]
    if tem_tan:
        partes.append(qt.view(np.uint8).reshape(len(p), -1))
    _, prim, inv = np.unique(np.concatenate(partes, 1), axis=0, return_index=True, return_inverse=True)
    inv = inv.ravel()
    _, pr = np.unique(inv, return_index=True)            # renumera pela 1a aparicao
    ordem = np.argsort(pr)
    novo = np.empty(len(ordem), np.int64)
    novo[ordem] = np.arange(len(ordem))
    idx = novo[inv]
    vsel = prim[ordem]                                   # corner de origem de cada vertice novo
    nv = len(vsel)
    di = np.diff(idx, prepend=0)
    zz = ((di << 1) ^ (di >> 63)).astype(np.uint16 if nv < 32768 else np.uint32)
    g = {"material": nome, "nv": int(nv), "ni": int(len(idx)), "min": mn.round(5).tolist(), "max": mx.round(5).tolist(),
         "uvmin": umn.round(5).tolist(), "uvmax": umx.round(5).tolist(), "i32": nv >= 32768, "formato": 2, "q": Q}
    g["pos"] = put(delta(qp[vsel]))
    g["nor"] = put(np.concatenate([qn[vsel], np.zeros((nv, 1), np.int8)], 1))
    g["uv"] = put(delta(qu[vsel]))
    g["uv2"] = put(delta(q2[vsel]))
    if tem_tan:
        g["tan"] = put(qt[vsel])
    g["idx"] = put(zz)
    grupos.append(g)
open(os.path.join(OUT, "geo.bin"), "wb").write(bytes(blob))

# ---------------------------------------------------------------- cenario, luzes e mundo (so pra comparar)
amb, abin = [], bytearray()
for n in sorted(kit.AMB):
    o = S.objects[n]
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    me.transform(o.matrix_world)
    me.calc_loop_triangles()
    nt = len(me.loop_triangles)
    li = np.empty(nt * 3, np.int32)
    me.loop_triangles.foreach_get("loops", li)
    vi = np.empty(len(me.loops), np.int32)
    me.loops.foreach_get("vertex_index", vi)
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get("co", co)
    nr = np.empty(len(me.loops) * 3, np.float32)
    me.corner_normals.foreach_get("vector", nr)
    p, nn = z3(co.reshape(-1, 3)[vi[li]]).astype(np.float32), z3(nr.reshape(-1, 3)[li]).astype(np.float32)
    amb.append({"nome": n, "n": int(len(p)), "pos": len(abin), "material": me.materials[0].name})
    abin += p.tobytes()
    amb[-1]["nor"] = len(abin)
    abin += nn.tobytes()
    bpy.data.meshes.remove(me)
open(os.path.join(OUT, "amb.bin"), "wb").write(bytes(abin))
luzes = []
for o in S.objects:
    if o.type != "LIGHT":
        continue
    d = o.matrix_world.to_3x3() @ __import__("mathutils").Vector((0, 0, -1))
    L = o.data
    luzes.append({"nome": o.name, "tipo": L.type, "pos": z3(np.array([o.location[:]]))[0].round(4).tolist(),
                  "dir": z3(np.array([d[:]]))[0].round(4).tolist(), "w": L.energy, "cor": list(L.color),
                  "tam": getattr(L, "size", 0.1), "tam_y": getattr(L, "size_y", 0.0) if getattr(L, "shape", "") == "RECTANGLE" else None})
bg = next(n for n in S.world.node_tree.nodes if n.type == "BACKGROUND")
mundo = {"cor": list(bg.inputs[0].default_value)[:3], "forca": bg.inputs[1].default_value}

json.dump({"peca": PECA, "grupos": grupos, "materiais": {k: kit.MATS[k] for k in mats}, "atlas": TAM,
           "amb": amb, "amb_materiais": {o["material"]: kit.MATS[o["material"]] for o in amb}, "luzes": luzes, "mundo": mundo,
           "ambiente": [512, 256], "vista": S.view_settings.view_transform, "look": S.view_settings.look,
           "px_por_m": round(D, 1), "tri": NT, "camera": json.load(open(os.path.join(AQUI, PECA, "camera.json")))},
          open(os.path.join(OUT, "peca.json"), "w"), indent=1)
marca("geo.bin %d KB, %d tri, %d grupos" % (len(blob) // 1024, NT, len(grupos)))

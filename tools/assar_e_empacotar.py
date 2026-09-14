# -*- coding: utf-8 -*-
"""Assa a luz do apartamento no Cycles e empacota pro visualizador.

Roda no Blender, headless:

    blender -b --python tools/assar_e_empacotar.py

**Por que NAO ha atlas nem unwrap.** A primeira versao juntava tudo, abria uma UV de
lightmap com `smart_project` e assava numa imagem. Nao passa: `bpy.ops.object.mode_set`
TRAVA em modo background -- nao devolve, e fica queimando CPU indefinidamente (medido:
tudo antes dele leva 0,5 s; ele nunca retorna). E `smart_project` sem modo edicao
reprova no `poll()`. Entao o caminho de operador esta fechado dos dois lados.

Aqui a luz vai pra COR POR VERTICE, que nao precisa de UV nenhuma:

  1. cada malha e subdividida (modificador + `new_from_object`, sem operador) ate ter
     vertice suficiente pra segurar o degrade da luz;
  2. assa DIFFUSE sem cor -- irradiancia pura, nao aparencia;
  3. no export a irradiancia e multiplicada pelo albedo por vertice.

As malhas NAO sao juntadas: juntar obrigaria um material so, e o reboco e a tabua sao
texturas diferentes em malhas diferentes. Dezesseis draw calls num apartamento vazio
nao custam nada.
"""
import json, os, sys, time, bpy

RAIZ = r"C:\Users\respawn\Desktop\imobiliaria"
PACOTE = os.environ.get("PACOTE", os.path.join(RAIZ, "_apto_pacote.json"))
AM = int(os.environ.get("AM_BAKE", "64"))
SUB = int(os.environ.get("SUB", "2"))       # niveis de subdivisao simples
T0 = time.time()


def marca(q):
    print("[%7.1fs] %s" % (time.time() - T0, q), flush=True)


exec(open(os.path.join(RAIZ, "tools", "interior_para_blender.py"),
          encoding="utf-8").read().split("d = json.load(")[0])

d = json.load(open(DUMP, encoding="utf-8"))
montar(d)
marca("cena montada")

malhas = [o for o in bpy.data.objects if o.type == 'MESH']
marca("soldado na construcao (%d verts)" % sum(len(o.data.vertices) for o in malhas))

# --- densidade pro degrade da luz --------------------------------------------
# Sem operador: o modificador e aplicado lendo a malha JA AVALIADA do depsgraph.
for o in malhas:
    m = o.modifiers.new("sub", 'SUBSURF')
    m.subdivision_type = 'SIMPLE'
    m.levels = m.render_levels = SUB
dg = bpy.context.evaluated_depsgraph_get()
for o in malhas:
    nova = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    o.modifiers.clear()
    velha = o.data
    o.data = nova
    bpy.data.meshes.remove(velha)
    lz = nova.color_attributes.new("Luz", 'FLOAT_COLOR', 'CORNER')
    nova.color_attributes.active_color = lz
marca("subdividido (%d verts)" % sum(len(o.data.vertices) for o in malhas))

# --- assa IRRADIANCIA ---------------------------------------------------------
s = bpy.context.scene
s.render.engine = 'CYCLES'
try:
    cp = bpy.context.preferences.addons["cycles"].preferences
    for tipo in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI', 'METAL'):
        try:
            cp.compute_device_type = tipo
        except Exception:
            continue
        cp.get_devices()
        if any(dv.type == tipo for dv in cp.devices):
            for dv in cp.devices:
                dv.use = (dv.type == tipo)
            break
    else:
        cp.get_devices()
    usados = [dv.name for dv in cp.devices if dv.use and dv.type != 'CPU']
    s.cycles.device = 'GPU' if usados else 'CPU'
    marca("assando em " + ((", ".join(usados)) if usados else "CPU"))
except Exception as e:
    marca("dispositivo? %s" % e)

s.cycles.samples = AM
s.cycles.use_denoising = True
s.render.bake.target = 'VERTEX_COLORS'
s.render.bake.use_pass_direct = True
s.render.bake.use_pass_indirect = True
s.render.bake.use_pass_color = False        # irradiancia, nao aparencia
for o in bpy.data.objects:
    o.select_set(o.type == 'MESH')
bpy.context.view_layer.objects.active = malhas[0]
bpy.ops.object.bake(type='DIFFUSE')
marca("ASSADO")

# --- empacota -----------------------------------------------------------------
saida = {"unidade": d["unidade"], "malhas": [],
         "cam": d["cam"], "texturas": {}}
for t in d.get("texturas", {}).values():
    if t.get("png"):
        saida["texturas"][t["id"]] = t["png"]

# O bake em cor por vertice NAO passa pelo denoiser -- so bake em imagem passa. Com
# amostra de menos o resultado sai salpicado, e depois do ganho e da curva isso vira
# estilhaco. Irradiancia e campo de baixa frequencia, entao alisar pelas ARESTAS e
# legitimo: nao inventa luz, so tira o granulado da amostragem.
SUAV = int(os.environ.get("SUAV", "2"))

for o, md in zip(malhas, d["meshes"]):
    me = o.data
    luz = me.color_attributes["Luz"].data
    alb = me.color_attributes["Col"].data if "Col" in me.color_attributes else None
    uvl = me.uv_layers["UVMap"].data if "UVMap" in me.uv_layers else None
    nv = len(me.vertices)

    # canto -> vertice
    L = [[0.0, 0.0, 0.0] for _ in range(nv)]
    A = [[0.0, 0.0, 0.0] for _ in range(nv)]
    n = [0] * nv
    for li, lp in enumerate(me.loops):
        vi = lp.vertex_index
        c = luz[li].color
        a = alb[li].color if alb else (1.0, 1.0, 1.0)
        for i in range(3):
            L[vi][i] += c[i]; A[vi][i] += a[i]
        n[vi] += 1
    for vi in range(nv):
        k = n[vi] or 1
        for i in range(3):
            L[vi][i] /= k; A[vi][i] /= k

    viz = [[] for _ in range(nv)]
    for e in me.edges:
        a_, b_ = e.vertices
        viz[a_].append(b_); viz[b_].append(a_)
    for _ in range(SUAV):
        novo = []
        for vi in range(nv):
            vz = viz[vi]
            if not vz:
                novo.append(L[vi]); continue
            m = [0.0, 0.0, 0.0]
            for w_ in vz:
                for i in range(3):
                    m[i] += L[w_][i]
            novo.append([0.5 * L[vi][i] + 0.5 * m[i] / len(vz) for i in range(3)])
        L = novo

    P, C, U, IDX = [], [], [], []
    vistos = {}
    me.calc_loop_triangles()
    for t in me.loop_triangles:
        for li in t.loops:
            vi = me.loops[li].vertex_index
            uv = uvl[li].uv if uvl else (0.0, 0.0)
            k = (vi, round(uv[0], 4), round(uv[1], 4))
            j = vistos.get(k)
            if j is None:
                j = len(P) // 3
                v = o.matrix_world @ me.vertices[vi].co
                P += [round(v.x, 3), round(v.z, 3), round(-v.y, 3)]   # -> eixo Three
                C += [round(min(L[vi][i] * A[vi][i], 4.0), 3) for i in range(3)]
                U += [round(uv[0], 4), round(uv[1], 4)]
                vistos[k] = j
            IDX.append(j)
    mt = md["mat"] or {}
    saida["malhas"].append({"pos": P, "cor": C, "uv": U, "idx": IDX,
                            "map": mt.get("map"), "op": mt.get("op", 1.0)})

json.dump(saida, open(PACOTE, "w", encoding="utf-8"), separators=(",", ":"))
marca("OK %s  %d malhas  %d tris  %.1f MB"
      % (PACOTE, len(saida["malhas"]),
         sum(len(m["idx"]) for m in saida["malhas"]) // 3,
         os.path.getsize(PACOTE) / 1e6))

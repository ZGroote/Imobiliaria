"""Teste: a mesma jaqueta (tamanho fixo) simulada como tecido em manequins PP..GG.

O manequim começa estreito (cabe folgado dentro da peça) e cresce até as
medidas finais nos primeiros quadros; o Cloth do Blender simula o tecido
caindo e sendo empurrado pelo corpo. Depois, o resto da jaqueta (forro, gola,
botões) recebe o deslocamento dos vértices mais próximos da casca simulada
da mesma parte (forro do tronco <- tronco, forro da manga <- manga).

uso: python3 teste_tamanhos.py <pasta_saida> [PP P M G GG]
"""
import json
import math
import sys
import time
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import cena  # noqa: E402
import modelo  # noqa: E402

saida = Path(sys.argv[1]).resolve()
saida.mkdir(parents=True, exist_ok=True)
nomes = sys.argv[2:] or ["PP", "P", "M", "G", "GG"]
TEX = Path(__file__).parent.parent / "build" / "texturas"
QUADROS, CRESCE = 40, 18

pj = modelo.params_peca()
Hj = pj["altura"]


def proxy_da_jaqueta(m: modelo.Malha):
    """Só as cascas externas (tronco e mangas): é o que vai para o simulador."""
    v = m.vertices()
    sel = set(m.grupos["tronco_fora"]) | set(m.grupos["manga_fora"])
    faces = [f for f in m.f if all(i in sel for i in f)]
    usados = sorted({i for f in faces for i in f})
    remap = {o: n for n, o in enumerate(usados)}
    me = bpy.data.meshes.new("Proxy")
    me.from_pydata(v[usados].tolist(), [], [[remap[i] for i in f] for f in faces])
    ob = bpy.data.objects.new("Proxy", me)
    bpy.context.scene.collection.objects.link(ob)
    # pinos: decote e cabeça das mangas acompanham o ombro
    pino = ob.vertex_groups.new(name="pino")
    # grupo de EXCLUSÃO: triângulos só com estes vértices não colidem
    sem_colisao = ob.vertex_groups.new(name="sem_colisao")
    tronco = set(m.grupos["tronco_fora"])
    for n, o in enumerate(usados):
        x, y, z = v[o]
        livre = True
        if o in tronco:
            w = min(1.0, max(0.0, (z / Hj - 0.822) / 0.012))
            # cava: a lateral do tronco acima do peito fica sob a manga e cruza o braço
            lado = abs(math.cos(math.atan2(y, x)))
            if z / Hj > 0.69 and lado > 0.93:
                w, livre = 1.0, False
        else:
            s = 1 if x > 0 else -1
            d = np.array([s * math.sin(modelo.ANG_BRACO), 0, -math.cos(modelo.ANG_BRACO)])
            J = np.array([s * (0.5 * pj["ombros"] - 0.03), 0, 0.788 * Hj])
            t = float(np.dot(v[o] - J, d))
            w = min(1.0, max(0.0, (0.07 * Hj - t) / (0.05 * Hj)))
            if t < 0.05 * Hj:
                livre = False
        if w > 0:
            pino.add([n], w, "REPLACE")
        if not livre:
            sem_colisao.add([n], 1.0, "REPLACE")
    return ob, usados


def amarrar(m: modelo.Malha, usados):
    """Para cada vértice da jaqueta: 3 vértices do proxy (mesma parte) que o conduzem."""
    from mathutils.kdtree import KDTree
    v = m.vertices()
    pos = {o: n for n, o in enumerate(usados)}
    partes = {}
    for nome in ("tronco", "manga"):
        ids = [pos[o] for o in m.grupos[nome + "_fora"] if o in pos]
        kd = KDTree(len(ids))
        for i in ids:
            kd.insert(v[usados[i]], i)
        kd.balance()
        partes[nome] = kd
    geral = KDTree(len(usados))
    for n, o in enumerate(usados):
        geral.insert(v[o], n)
    geral.balance()
    dono = {}
    for nome in ("tronco", "manga"):
        for o in m.grupos[nome + "_dentro"]:
            dono[o] = partes[nome]
    lig = []
    for i, p in enumerate(v):
        if i in pos:
            lig.append([pos[i]])
            continue
        kd = dono.get(i, geral)
        lig.append([n for _, n, _ in kd.find_n(p, 3)])
    return lig


def simular(nome):
    t0 = time.time()
    cena.limpar()
    alvo = modelo.TAMANHOS[nome]
    inicio = dict(alvo)
    for k, lim in (("ombros", 0.40), ("busto", 0.82), ("cintura", 0.68), ("quadril", 0.80)):
        inicio[k] = min(alvo[k], lim)

    corpo = cena.objeto("Corpo", modelo.corpo(dict(modelo.MINIMO)), [cena.material_manequim()])
    cena.shape_keys(corpo, modelo.corpo)
    for quadro, p in ((1, inicio), (CRESCE, alvo)):
        cena.aplicar_medidas(corpo, p)
        for kb in corpo.data.shape_keys.key_blocks[1:]:
            kb.keyframe_insert("value", frame=quadro)
    col = corpo.modifiers.new("Colisao", "COLLISION")
    corpo.collision.thickness_outer = 0.004
    corpo.collision.cloth_friction = 3

    malha = cena.jaqueta_malha()
    jaq = cena.objeto("Jaqueta", malha, cena.materiais_jaqueta(TEX))
    prox, usados = proxy_da_jaqueta(malha)
    lig = amarrar(malha, usados)
    dz = modelo.deslocamento_peca(alvo["altura"])
    jaq.location.z = prox.location.z = dz

    cl = prox.modifiers.new("Tecido", "CLOTH")
    s = cl.settings
    s.quality = 8
    s.mass = 0.45
    s.air_damping = 2.0
    s.tension_stiffness = s.compression_stiffness = 35
    s.shear_stiffness = 15
    s.bending_stiffness = 6
    s.tension_damping = s.compression_damping = 8
    s.vertex_group_mass = "pino"
    s.pin_stiffness = 2.0
    c = cl.collision_settings
    c.collision_quality = 4
    c.distance_min = 0.005
    c.use_self_collision = False
    c.vertex_group_object_collisions = "sem_colisao"
    cl.point_cache.frame_start, cl.point_cache.frame_end = 1, QUADROS
    prox.hide_render = True

    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, QUADROS
    for f in range(1, QUADROS + 1):
        sc.frame_set(f)

    # quanto o tecido esticou (média por aresta, em relação à peça em repouso)
    dg = bpy.context.evaluated_depsgraph_get()
    ev = prox.evaluated_get(dg).data
    co = np.array([v.co[:] for v in ev.vertices])
    co0 = np.array([v.co[:] for v in prox.data.vertices])
    ed = np.array([e.vertices[:] for e in prox.data.edges])
    l0 = np.linalg.norm(co0[ed[:, 0]] - co0[ed[:, 1]], axis=1)
    l1 = np.linalg.norm(co[ed[:, 0]] - co[ed[:, 1]], axis=1)
    estica = float(np.percentile(l1 / l0, 95) - 1)
    desl = co - co0
    vj = malha.vertices() + np.array([desl[l].mean(0) for l in lig])
    jaq.data.vertices.foreach_set("co", vj.ravel())
    jaq.data.update()

    cena.estudio(alvo_z=1.2 * alvo["altura"] / 1.75, dist=3.4, lente=55, res=(600, 900), amostras=48,
                 azimute=-25)
    cena.render(saida / f"teste_{nome}.png")
    corpo_c = modelo.sondas_corpo(alvo)
    jaq_c = modelo.sondas_jaqueta()
    r = {"tamanho": nome, "corpo": alvo,
         "folga_cm": {k: round((jaq_c[k] - corpo_c[k]) * 100, 1) for k in corpo_c},
         "ombro_cm": round((modelo.PECA["ombros"] - alvo["ombros"]) * 100, 1),
         "estiramento_p95_pct": round(estica * 100, 1),
         "segundos": round(time.time() - t0, 1)}
    print(json.dumps(r, ensure_ascii=False), flush=True)
    return r


res = [simular(n) for n in nomes]
(saida / "resultado.json").write_text(json.dumps(res, indent=1, ensure_ascii=False))

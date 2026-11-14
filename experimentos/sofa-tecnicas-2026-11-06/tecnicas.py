# -*- coding: utf-8 -*-
"""Funcoes comuns dos sofas com as tecnicas novas (06/11/2026): costura (skill roupas), materiais (materiais-pbr),
luz (archviz-realista) e camera (composicao-de-cena).

blender -b --python sofa.py -- <saida.png> [geral|detalhe]
Variaveis: AMOSTRAS (padrao 256), TESTE=1 (meia resolucao, 48 amostras).
"""
import bpy, bmesh, math, os, sys, time
import numpy as np
from mathutils import Vector, geometry

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(AQUI, "..", ".."))
sys.path.insert(0, os.path.join(REPO, "experimentos", "moveis-referencia"))
import kit                                         # zera a cena (factory settings)
from kit import S, lin, obj, mesh_bm, poe, sock

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SAIDA = ARGS[0] if ARGS else os.path.join(AQUI, "sofa.png")
VISTA = ARGS[1] if len(ARGS) > 1 else "geral"
TESTE = os.environ.get("TESTE") == "1"
TEX = os.path.join(REPO, "blender", "textures")
T0 = time.time()


def log(*a):
    print("[%4.0f s]" % (time.time() - T0), *a, flush=True)


# ------------------------------------------------------------------ materiais (skill materiais-pbr)
def img(caminho, cor):
    im = bpy.data.images.load(caminho, check_existing=True)
    im.colorspace_settings.name = "sRGB" if cor else "Non-Color"
    return im


def no(nt, tipo, **kw):
    n = nt.nodes.new(tipo)
    for k, v in kw.items():
        setattr(n, k, v)
    return n


def mat_base(nome):
    m = bpy.data.materials.new(nome)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    return m, nt, next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")


def coord_por_peca(nt, escala, giro=0.0):
    """UV em metro -> 1 repeticao a cada `escala` m, deslocada pelo aleatorio do OBJETO: duas pecas
    vizinhas nao mostram o mesmo desenho (materiais-pbr: nada repetido 200 vezes)."""
    uv = no(nt, "ShaderNodeUVMap")
    oi = no(nt, "ShaderNodeObjectInfo")
    cx = no(nt, "ShaderNodeCombineXYZ")
    for k, f in (("X", 5.37), ("Y", 7.13)):
        mm = no(nt, "ShaderNodeMath", operation="MULTIPLY")
        nt.links.new(oi.outputs["Random"], mm.inputs[0])
        mm.inputs[1].default_value = f
        nt.links.new(mm.outputs[0], cx.inputs[k])
    mp = no(nt, "ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1 / escala, 1 / escala, 1)
    mp.inputs["Rotation"].default_value = (0, 0, math.radians(giro))
    nt.links.new(uv.outputs["UV"], mp.inputs["Vector"])
    nt.links.new(cx.outputs[0], mp.inputs["Location"])
    return mp.outputs["Vector"], oi


def variacao(nt, oi, cor_sock, amp_peca=0.03, amp_mancha=0.04, escala_mancha=2.5):
    """cor * (1 +- amp_peca por objeto) * (1 +- amp_mancha em mancha larga): nada da mesma cor."""
    mr = no(nt, "ShaderNodeMapRange")
    nt.links.new(oi.outputs["Random"], mr.inputs["Value"])
    mr.inputs["To Min"].default_value, mr.inputs["To Max"].default_value = 1 - amp_peca, 1 + amp_peca
    nz = no(nt, "ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value, nz.inputs["Detail"].default_value = escala_mancha, 3.0
    mr2 = no(nt, "ShaderNodeMapRange")
    nt.links.new(nz.outputs["Fac"], mr2.inputs["Value"])
    mr2.inputs["From Min"].default_value, mr2.inputs["From Max"].default_value = 0.3, 0.7
    mr2.inputs["To Min"].default_value, mr2.inputs["To Max"].default_value = 1 - amp_mancha, 1 + amp_mancha
    m1 = no(nt, "ShaderNodeMath", operation="MULTIPLY")
    nt.links.new(mr.outputs[0], m1.inputs[0])
    nt.links.new(mr2.outputs[0], m1.inputs[1])
    mx = no(nt, "ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
    sock(mx.inputs, "Factor").default_value = 1.0
    nt.links.new(cor_sock, sock(mx.inputs, "A"))
    cx = no(nt, "ShaderNodeCombineColor")
    for k in ("Red", "Green", "Blue"):
        nt.links.new(m1.outputs[0], cx.inputs[k])
    nt.links.new(cx.outputs[0], sock(mx.inputs, "B"))
    return sock(mx.outputs, "Result")


LINHO = os.path.join(TEX, "rough_linen", "rough_linen_%s_2k.jpg")
LINHO_L = 0.656            # luminancia media do scan (medida): a trama fica, a cor azul sai


def tecido(nome, cor, escala=0.4, sheen=0.5, relevo=1.0, rough=(0.78, 0.95), giro=0.0, slub=0.035, mescla=0.0, mescla_escala=350.0, sheen_rough=0.35):
    """Linho escaneado (Poly Haven, CC0). O scan e azul: vira so luminancia (trama, fio, falha) e a
    cor vem de `cor`. Sheen = o brilho aveludado de borda que tecido tem e plastico nao."""
    m, nt, bs = mat_base(nome)
    co, oi = coord_por_peca(nt, escala, giro)
    td = no(nt, "ShaderNodeTexImage")
    td.image = img(LINHO % "diff", True)
    nt.links.new(co, td.inputs["Vector"])
    bw = no(nt, "ShaderNodeRGBToBW")
    nt.links.new(td.outputs["Color"], bw.inputs[0])
    k = no(nt, "ShaderNodeMath", operation="MULTIPLY")
    nt.links.new(bw.outputs[0], k.inputs[0])
    k.inputs[1].default_value = 1 / LINHO_L
    mx = no(nt, "ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
    sock(mx.inputs, "Factor").default_value = 1.0
    cc = no(nt, "ShaderNodeCombineColor")
    for c in ("Red", "Green", "Blue"):
        nt.links.new(k.outputs[0], cc.inputs[c])
    nt.links.new(cc.outputs[0], sock(mx.inputs, "A"))
    sock(mx.inputs, "B").default_value = lin(cor)
    # SLUB: o fio de linho tem trechos grossos que correm na direcao do fio. A 3 m o fio some (menos de
    # 1 px) e o que a foto mostra e isso: risco comprido e mancha. Ruido esticado 40x no sentido do fio.
    uvs = no(nt, "ShaderNodeUVMap")
    ms = no(nt, "ShaderNodeMapping")
    ms.inputs["Scale"].default_value = (8.0 / escala * 0.22, 90.0 / escala * 0.22, 1)
    nt.links.new(uvs.outputs["UV"], ms.inputs["Vector"])
    nz = no(nt, "ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value, nz.inputs["Detail"].default_value = 1.0, 4.0
    nt.links.new(ms.outputs["Vector"], nz.inputs["Vector"])
    mr_s = no(nt, "ShaderNodeMapRange")
    nt.links.new(nz.outputs["Fac"], mr_s.inputs["Value"])
    mr_s.inputs["From Min"].default_value, mr_s.inputs["From Max"].default_value = 0.35, 0.65
    mr_s.inputs["To Min"].default_value, mr_s.inputs["To Max"].default_value = 1 - slub, 1 + slub
    ms2 = no(nt, "ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
    sock(ms2.inputs, "Factor").default_value = 1.0
    nt.links.new(sock(mx.outputs, "Result"), sock(ms2.inputs, "A"))
    cs_ = no(nt, "ShaderNodeCombineColor")
    for c in ("Red", "Green", "Blue"):
        nt.links.new(mr_s.outputs[0], cs_.inputs[c])
    nt.links.new(cs_.outputs[0], sock(ms2.inputs, "B"))
    cor_f = variacao(nt, oi, sock(ms2.outputs, "Result"), amp_mancha=0.05, escala_mancha=4.0)
    if mescla:            # chenille/mesclado: granulado miudo (~3 mm) por igual, sem direcao
        cor_f = variacao(nt, oi, cor_f, amp_peca=0.0, amp_mancha=mescla, escala_mancha=mescla_escala)
    nt.links.new(cor_f, bs.inputs["Base Color"])
    tr = no(nt, "ShaderNodeTexImage")
    tr.image = img(LINHO % "rough", False)
    nt.links.new(co, tr.inputs["Vector"])
    mr = no(nt, "ShaderNodeMapRange")
    nt.links.new(tr.outputs["Color"], mr.inputs["Value"])
    mr.inputs["To Min"].default_value, mr.inputs["To Max"].default_value = rough
    nt.links.new(mr.outputs[0], bs.inputs["Roughness"])
    tn = no(nt, "ShaderNodeTexImage")
    tn.image = img(LINHO % "nor_gl", False)
    nt.links.new(co, tn.inputs["Vector"])
    nm = no(nt, "ShaderNodeNormalMap")
    nm.inputs["Strength"].default_value = relevo
    nt.links.new(tn.outputs["Color"], nm.inputs["Color"])
    bp = no(nt, "ShaderNodeBump")                          # o slub tambem e relevo (fio grosso sobe)
    bp.inputs["Strength"].default_value, bp.inputs["Distance"].default_value = 0.25, 0.0008
    nt.links.new(nz.outputs["Fac"], bp.inputs["Height"])
    nt.links.new(nm.outputs["Normal"], bp.inputs["Normal"])
    nt.links.new(bp.outputs["Normal"], bs.inputs["Normal"])
    bs.inputs["Sheen Weight"].default_value = sheen
    bs.inputs["Sheen Roughness"].default_value = sheen_rough
    bs.inputs["Specular IOR Level"].default_value = 0.3
    return m


def madeira(nome, tinta, rough=0.42, escala=1.0, amp=0.08):
    """madeira_nature (veio periodico) + variacao por peca ~8% (cada tabua um tom) + rugosidade
    com mancha (reflexo nunca uniforme)."""
    m, nt, bs = mat_base(nome)
    co, oi = coord_por_peca(nt, escala)
    td = no(nt, "ShaderNodeTexImage")
    td.image = img(os.path.join(REPO, "experimentos", "moveis-referencia", "materiais", "madeira_nature_cor.png"), True)
    nt.links.new(co, td.inputs["Vector"])
    mx = no(nt, "ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
    sock(mx.inputs, "Factor").default_value = 1.0
    nt.links.new(td.outputs["Color"], sock(mx.inputs, "A"))
    sock(mx.inputs, "B").default_value = tuple(tinta) + (1,)
    nt.links.new(variacao(nt, oi, sock(mx.outputs, "Result"), amp_peca=amp, amp_mancha=0.05, escala_mancha=1.2),
                 bs.inputs["Base Color"])
    tn = no(nt, "ShaderNodeTexImage")
    tn.image = img(os.path.join(REPO, "experimentos", "moveis-referencia", "materiais", "madeira_nature_nor.png"), False)
    nt.links.new(co, tn.inputs["Vector"])
    nm = no(nt, "ShaderNodeNormalMap")
    nm.inputs["Strength"].default_value = 0.35
    nt.links.new(tn.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], bs.inputs["Normal"])
    nz = no(nt, "ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 6.0
    mr = no(nt, "ShaderNodeMapRange")
    nt.links.new(nz.outputs["Fac"], mr.inputs["Value"])
    mr.inputs["To Min"].default_value, mr.inputs["To Max"].default_value = rough - 0.08, rough + 0.10
    nt.links.new(mr.outputs[0], bs.inputs["Roughness"])
    return m


def tinta_parede(nome, cor, rough=0.9):
    """Tinta fosca: off-white quente, nunca branco 100%, com mancha e relevo de rolo bem fracos."""
    m, nt, bs = mat_base(nome)
    oi = no(nt, "ShaderNodeObjectInfo")
    cr = no(nt, "ShaderNodeRGB")
    cr.outputs[0].default_value = lin(cor)
    nt.links.new(variacao(nt, oi, cr.outputs[0], amp_peca=0.0, amp_mancha=0.025, escala_mancha=0.8), bs.inputs["Base Color"])
    bs.inputs["Roughness"].default_value = rough
    nz = no(nt, "ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value, nz.inputs["Detail"].default_value = 180.0, 6.0
    bp = no(nt, "ShaderNodeBump")
    bp.inputs["Strength"].default_value, bp.inputs["Distance"].default_value = 0.05, 0.001
    nt.links.new(nz.outputs["Fac"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], bs.inputs["Normal"])
    return m


def liso(nome, cor, rough=0.5, sheen=0.0):
    m, nt, bs = mat_base(nome)
    bs.inputs["Base Color"].default_value = lin(cor)
    bs.inputs["Roughness"].default_value = rough
    if sheen:
        bs.inputs["Sheen Weight"].default_value = sheen
    return m


# ------------------------------------------------------------------ costura (skill roupas)
def contorno_arredondado(w, d, r, passo):
    """Retangulo de canto arredondado (o molde do tampo), amostrado a cada ~passo, anti-horario."""
    pts = []
    cantos = [(w / 2 - r, d / 2 - r, 0), (-w / 2 + r, d / 2 - r, 90), (-w / 2 + r, -d / 2 + r, 180), (w / 2 - r, -d / 2 + r, 270)]
    for k, (cx, cy, a0) in enumerate(cantos):
        n_arco = max(3, round(math.pi / 2 * r / passo))
        for i in range(n_arco):
            a = math.radians(a0 + 90 * i / n_arco)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
        nx, ny, _ = cantos[(k + 1) % 4]
        x0, y0 = cx + r * math.cos(math.radians(a0 + 90)), cy + r * math.sin(math.radians(a0 + 90))
        comp = abs((nx if k % 2 == 0 else ny) - (cx if k % 2 == 0 else cy))
        n_reta = max(1, round(comp / passo))
        for i in range(n_reta):
            t = i / n_reta
            if k % 2 == 0:
                pts.append((x0 + (nx - cx) * t, y0))
            else:
                pts.append((x0, y0 + (ny - cy) * t))
    return pts


def reamostra(pts, passo):
    """Poligono fechado -> pontos a cada ~passo ao longo do perimetro."""
    P = [Vector((x, y)) for x, y in pts]
    seg = [(P[i], P[(i + 1) % len(P)]) for i in range(len(P))]
    tot = sum((b - a).length for a, b in seg)
    n = max(8, round(tot / passo))
    out, acc, k = [], 0.0, 0
    for i in range(n):
        alvo = tot * i / n
        while acc + (seg[k][1] - seg[k][0]).length < alvo:
            acc += (seg[k][1] - seg[k][0]).length
            k += 1
        a, b = seg[k]
        t = (alvo - acc) / max((b - a).length, 1e-9)
        q = a.lerp(b, t)
        out.append((q.x, q.y))
    return out


def painel(contorno, passo):
    """Molde plano triangulado (o mesmo da camiseta): contorno + grade hexagonal por dentro."""
    nb = len(contorno)
    xs, ys = [p[0] for p in contorno], [p[1] for p in contorno]
    pts = list(contorno)
    y, linha = min(ys) + passo / 2, 0
    while y < max(ys):
        x = min(xs) + passo / 2 + (passo / 2 if linha % 2 else 0)
        while x < max(xs):
            dentro = False
            for i in range(nb):
                (x1, y1), (x2, y2) = contorno[i], contorno[(i + 1) % nb]
                if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
                    dentro = not dentro
            if dentro and min(math.hypot(x - a, y - b) for a, b in contorno) > 0.7 * passo:
                pts.append((x, y))
            x += passo
        y += passo * 0.866
        linha += 1
    vs, es, fs, ov, oe, of = geometry.delaunay_2d_cdt([Vector(p) for p in pts], [(i, (i + 1) % nb) for i in range(nb)],
                                                      [], 1, 1e-5, True)
    novo = {}
    for k, origs in enumerate(ov):
        for o in origs:
            novo[o] = k
    return [tuple(v) for v in vs], fs, [novo[i] for i in range(nb)]


def almofada_costurada(nome, w, d, h, mat, raio=0.035, passo=0.02, pressao=0.6, gravidade=0.0,
                       quadros=40, tensao=90.0, dobra=0.4, contorno=None):
    """Almofada de caixa como na oficina: TAMPO e FUNDO (molde w x d de canto arredondado) + FAIXA
    lateral (perimetro x h), costurados nas duas bordas. Cada peca tem o seu fio (UV propria: no tampo
    o fio corre de tras pra frente, na faixa ele fica vertical). O pano nao estica (tensao alta); a
    pressao enche e a costura segura -- dali saem o vinco, o canto que puxa e a ruga."""
    # `contorno` (lista 2D) troca o retangulo por qualquer molde: o braco do sofa e o PERFIL do braco
    # (tampo = painel da frente, faixa = o pano que da a volta por cima e por fora), reamostrado a ~passo
    cont = contorno_arredondado(w, d, raio, passo) if contorno is None else reamostra(contorno, passo)
    vs2, fs2, borda = painel(cont, passo)
    nb = len(cont)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.verify()
    topo = [bm.verts.new((x, y, h / 2)) for x, y in vs2]
    fundo = [bm.verts.new((x, y, -h / 2)) for x, y in vs2]
    n_lin = max(2, round(h / passo))
    aneis = [[topo[i] for i in borda]]
    for k in range(1, n_lin):
        z = h / 2 - h * k / n_lin
        aneis.append([bm.verts.new((cont[i][0], cont[i][1], z)) for i in range(nb)])
    aneis.append([fundo[i] for i in borda])
    rng = np.random.default_rng(kit.semente(nome))
    off = rng.random(4)
    for f in fs2:
        ft = bm.faces.new([topo[i] for i in f])
        ff = bm.faces.new([fundo[i] for i in reversed(f)])
        for face, (du, dv) in ((ft, off[:2]), (ff, off[2:])):
            for l in face.loops:
                l[uv].uv = (l.vert.co.x + du, l.vert.co.y + dv)
    arco = [0.0]
    for i in range(1, nb + 1):
        a, b = cont[i - 1], cont[i % nb]
        arco.append(arco[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
    for k in range(n_lin):
        for i in range(nb):
            j = (i + 1) % nb
            q = (aneis[k][i], aneis[k + 1][i], aneis[k + 1][j], aneis[k][j])
            f = bm.faces.new(q)
            for l, (ii, kk) in zip(f.loops, ((i, k), (i, k + 1), (i + 1, k + 1), (i + 1, k))):
                l[uv].uv = (arco[ii], h / 2 - h * kk / n_lin)
    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.verts.index_update()
    anel_cima = [v.index for v in aneis[0]]
    anel_baixo = [v.index for v in aneis[-1]]
    o = obj(nome, mesh_bm(nome, bm), [mat])
    return o, (anel_cima, anel_baixo), dict(pressao=pressao, gravidade=gravidade, quadros=quadros,
                                             tensao=tensao, dobra=dobra)


def simula(o, pressao=0.6, gravidade=0.0, quadros=40, tensao=90.0, dobra=0.4, massa=0.4, auto=False,
           ondas=0.0, ar=2.0, colisao=None, checa_topo=True, volume_max=2.2):
    """Roda o pano e APLICA (new_from_object do depsgraph: em -b nada de operador)."""
    if ondas:                                # ondas iniciais em direcoes aleatorias (regular = caixa de ovo)
        rng = np.random.default_rng(kit.semente(o.name))
        for v in o.data.vertices:
            p = v.co
            v.co.z += ondas * sum(math.sin(a * p.x + b * p.y + c) for a, b, c in rng.normal(0, 9, (4, 3))) / 4
    S.frame_start, S.frame_end = 1, quadros
    # REGRA 1 (teste 1 do sofa reto): a massa do Cloth e POR VERTICE. 0,4 x 5 mil vertices = 2 t e a
    # almofada murcha. Com gravidade, pense no peso da peca INTEIRA e divida.
    n_v = len(o.data.vertices)
    if gravidade and massa * n_v > 50:
        raise RuntimeError("%s: %.0f kg no total (%.3f por vertice x %d) -- ela vai murchar; use ~1-15 kg"
                           % (o.name, massa * n_v, massa, n_v))
    # REGRA 2 (teste 1 do sofa nuvem): peca SEM gravidade e solta (encosto, almofada) e simulada na
    # origem -- com a colisao dos assentos ligada ela nasce dentro deles e amassa. Sem gravidade nao
    # ha contato a resolver: a colisao sai sozinha durante a simulacao dela.
    # colisao=True: capa sem gravidade que PRECISA da espuma por dentro (assento estavel)
    colisao = bool(gravidade) if colisao is None else colisao
    if not colisao:
        colisoes(False)
    co0 = np.array([v.co[:] for v in o.data.vertices])
    m = o.modifiers.new("pano", "CLOTH")
    cs = m.settings
    cs.quality, cs.mass = 10, massa
    cs.tension_stiffness = cs.compression_stiffness = tensao
    cs.shear_stiffness, cs.bending_stiffness = tensao / 4, dobra
    cs.air_damping = ar                      # com massa pequena o ar freia tudo: a manta boiava
    if pressao:
        cs.use_pressure, cs.uniform_pressure_force = True, pressao
    cs.effector_weights.gravity = gravidade
    cc = m.collision_settings
    cc.collision_quality, cc.distance_min = 4, 0.003
    cc.use_self_collision = auto
    cc.self_distance_min = 0.003
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
    if not colisao:
        colisoes(True)
    co = np.array([v.co[:] for v in me.vertices])
    e0, e1 = co0.max(0) - co0.min(0), co.max(0) - co.min(0)
    log("pano %s: %s -> %s" % (o.name, e0.round(3).tolist(), e1.round(3).tolist()))
    # REGRA 3: conferir a forma ANTES de seguir (os dois sustos so apareceram no render, 3 min depois).
    # Estofado (com pressao) que perdeu volume murchou ou amassou; que dobrou, estourou.
    if pressao:
        # entortou: o topo deixou de ser plano (almofada espremida por vizinho/braco vira rampa) --
        # o volume da caixa nao pega isso (teste 6 do sofa nuvem). Medida: inclinacao do plano dos
        # vertices de cima.
        topo = co[co[:, 2] > co[:, 2].max() - 0.25 * e1[2]]
        if len(topo) > 20:
            A = np.c_[topo[:, 0], topo[:, 1], np.ones(len(topo))]
            gx, gy, _ = np.linalg.lstsq(A, topo[:, 2], rcond=None)[0]
            if math.degrees(math.atan(math.hypot(gx, gy))) > 6 and gravidade and checa_topo:
                raise RuntimeError("%s: o topo entortou %.0f graus -- espremida (falta folga pro vizinho?)"
                                   % (o.name, math.degrees(math.atan(math.hypot(gx, gy)))))
        r = np.prod(np.maximum(e1, 1e-3)) / np.prod(np.maximum(e0, 1e-3))
        if r < 0.7 or r > volume_max or e1.min() < 0.5 * e0.min():   # almofada fina infla ~3x: volume_max=4
            raise RuntimeError("%s: volume da caixa x%.2f (%s -> %s) -- murchou/amassou ou estourou"
                               % (o.name, r, e0.round(3).tolist(), e1.round(3).tolist()))
    return o


def vivo(nome, o, anel, mat, r=0.0045, seg=10):
    """Vivo (piping) = cordao encapado que corre na costura. Segue o anel DEPOIS da simulacao, no
    mundo, um pouco pra fora (ele fica por cima da emenda)."""
    mw = o.matrix_world
    P = [mw @ o.data.vertices[i].co for i in anel]
    n = len(P)
    P = [(P[i - 1] + P[i] * 2 + P[(i + 1) % n]) / 4 for i in range(n)]       # alisa o serrilhado da malha
    c = sum(P, Vector()) / n
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    aneis, arco = [], [0.0]
    for i in range(n):
        t = (P[(i + 1) % n] - P[i - 1]).normalized()
        fora = P[i] - c
        fora = (fora - t * fora.dot(t)).normalized()
        b = t.cross(fora)
        base = P[i] + fora * r * 0.6
        aneis.append([bm.verts.new(base + (fora * math.cos(a) + b * math.sin(a)) * r)
                      for a in (2 * math.pi * k / seg for k in range(seg))])
        if i:
            arco.append(arco[-1] + (P[i] - P[i - 1]).length)
    arco.append(arco[-1] + (P[0] - P[-1]).length)
    for i in range(n):
        a, b2 = aneis[i], aneis[(i + 1) % n]
        for k in range(seg):
            f = bm.faces.new((a[k], b2[k], b2[(k + 1) % seg], a[(k + 1) % seg]))
            for l, (ii, kk) in zip(f.loops, ((i, k), (i + 1, k), (i + 1, k + 1), (i, k + 1))):
                l[uvl].uv = (arco[ii], 2 * math.pi * r * kk / seg)
    bm.normal_update()
    ov = obj(nome, mesh_bm(nome, bm), [mat])
    for p in ov.data.polygons:
        p.use_smooth = True
    return ov


def caixa_estofada(nome, x0, x1, y0, y1, z0, z1, mat, pressao=0.1):
    """Estrutura (braco, base, encosto fixo) = caixa de pano inflada do kit (pressao firme)."""
    o = kit.estofado(nome, x1 - x0, y1 - y0, z1 - z0, mat, pressao=pressao, passo=0.025, sub=1)
    poe(o, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    return o


def colide(*objs):
    for o in objs:
        if "colisao" not in o.modifiers:
            o.modifiers.new("colisao", "COLLISION")
            o.collision.thickness_outer = 0.003
            o.collision.cloth_friction = 8


def colisoes(ligar):
    """Peca solta (encosto, almofada) e simulada na ORIGEM: com a colisao dos assentos ligada ela nasce
    dentro deles e amassa (sofa nuvem, teste 1). Desligue durante a simulacao dela."""
    for o in S.objects:
        for m in o.modifiers:
            if m.type == "COLLISION":
                m.show_viewport = m.show_render = ligar
    bpy.context.view_layer.update()


def solto(fn, *a, **kw):
    """REGRA 2 para os panos do KIT (kit.estofado, kit.travesseiro, que nao passam pelo simula):
    sem colisao durante a simulacao. No teste 4 do sofa nuvem as almofadas soltas amassaram porque o
    simula() do encosto religou a colisao antes delas."""
    colisoes(False)
    try:
        return fn(*a, **kw)
    finally:
        colisoes(True)


def topo_z(o):
    ev = o.evaluated_get(bpy.context.evaluated_depsgraph_get())
    return max((o.matrix_world @ v.co).z for v in ev.to_mesh().vertices)


# ------------------------------------------------------------------ geometria simples
def caixa(nome, x0, x1, y0, y1, z0, z1, mat, bevel=0.0015):
    return kit.caixa(nome, x0, x1, y0, y1, z0, z1, mat, bevel=bevel, seg=2)


def cilindro(nome, r1, r2, alt, mat, seg=32, loc=(0, 0, 0), sub=0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=alt)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, alt / 2))
    kit.uv_metro(bm, "z", nome)
    o = obj(nome, mesh_bm(nome, bm), [mat])
    o.location = loc
    m = o.modifiers.new("bevel", "BEVEL")
    m.width, m.segments, m.limit_method = 0.0015, 2, "ANGLE"
    for p in o.data.polygons:
        p.use_smooth = True
    if sub:
        s = o.modifiers.new("sub", "SUBSURF")
        s.levels = s.render_levels = sub
    return o



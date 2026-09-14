# -*- coding: utf-8 -*-
"""Georreferencia uma planta ja vetorizada: acha a semelhanca (rotacao+translacao+escala)
que encaixa as quadras do desenho nas quadras oficiais do loteamento (EPSG:29193)."""
import json, sys, math, itertools
import numpy as np
from shapely.geometry import shape, Polygon, mapping
from shapely.ops import unary_union, transform as shptransform
from pyproj import Transformer

PROJ = "C:/Users/respawn/Desktop/imobiliaria/"
FWD = Transformer.from_crs("EPSG:4326", "EPSG:29193", always_xy=True)
INV = Transformer.from_crs("EPSG:29193", "EPSG:4326", always_xy=True)

FONTES_AREA = ["loteamentos_saocarlos_oficial.geojson", "bairros_centro_saocarlos.geojson"]

def quadras_oficiais(nome_lot):
    alvo = []
    for fn in FONTES_AREA:
        try: d = json.load(open(PROJ + fn, encoding="utf-8"))
        except FileNotFoundError: continue
        for f in d["features"]:
            p = f["properties"]
            nome = p.get("nome") or p.get("bairro") or p.get("name") or ""
            if nome_lot.upper() == nome.upper() or nome_lot.upper() in nome.upper():
                alvo.append(f)
    if not alvo: raise SystemExit("loteamento nao encontrado: " + nome_lot)
    P = unary_union([shape(f["geometry"]) for f in alvo])
    q = json.load(open(PROJ + "quadras_saocarlos.geojson", encoding="utf-8"))
    # folga pequena so pra pegar quadra na divisa. Folga grande (500 m) contamina o
    # palpite de escala com quadra de loteamento vizinho e estraga o encaixe.
    Pb = P.buffer(50.0 / 111320.0)
    dentro = [shape(f["geometry"]) for f in q["features"]
              if shape(f["geometry"]).representative_point().within(Pb)]
    return [shptransform(lambda x, y, z=None: FWD.transform(x, y), g) for g in dentro], \
           shptransform(lambda x, y, z=None: FWD.transform(x, y), P)

def quadras_planta(js):
    """Une os lotes em quadras. Coordenadas em metros, y invertido (imagem -> plano)."""
    mpp = js["mpp"]
    polys = []
    for l in js["lotes"]:
        p = [(x * mpp, -y * mpp) for x, y in l["poly"]]
        if len(p) >= 3:
            g = Polygon(p)
            if g.is_valid and g.area > 1: polys.append((g, l))
    uni = unary_union([g.buffer(1.2) for g, _ in polys])
    partes = list(uni.geoms) if uni.geom_type == "MultiPolygon" else [uni]
    partes = [p for p in partes if p.area > 300]
    return polys, partes

def similaridade(p1, p2, q1, q2):
    """transforma p1->q1, p2->q2 (rotacao+escala uniforme+translacao)"""
    dp = p2 - p1; dq = q2 - q1
    np_, nq = np.hypot(*dp), np.hypot(*dq)
    if np_ < 1e-6: return None
    s = nq / np_
    a = math.atan2(dq[1], dq[0]) - math.atan2(dp[1], dp[0])
    R = np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]]) * s
    t = q1 - R @ p1
    return R, t, s, a

ESCALAS = (0.5, 1.0, 1.25, 1.5, 2.0, 2.5, 4.0, 5.0)   # 1:500 .. 1:5000, assumindo 1:1000

def snap(s, tol=0.03):
    for e in ESCALAS:
        if abs(s - e) / e <= tol: return e
    return None

def escala_provavel(partes, qof):
    """Palpite de escala pela razao de tamanho das quadras (mediana, robusta a
    planta que cobre so parte do loteamento). Evita o RANSAC escolher 1:1000
    quando a prancha e 1:2000."""
    ap = np.median([p.area for p in partes]); ao = np.median([q.area for q in qof])
    return math.sqrt(ao / ap) if ap > 0 else 1.0

def casar(Cp, Cq, Pp, Pq, tol=25.0, s0=None, banda=(0.72, 1.40), forcar=None,
          max_pares=400, max_cands=4000):
    """RANSAC por pares de centroides de quadra. So aceita escala de prancha usual e
    desempata os melhores candidatos por IoU das quadras (nao so distancia de centroide).

    Custo: com 40 quadras no desenho e 60 oficiais sao 2,7 milhoes de combinacoes.
    Por isso: amostra os pares do desenho (os maiores primeiro, que sao os mais
    informativos) e busca o par oficial por distancia com busca binaria."""
    import bisect, random
    dq = []
    for a in range(len(Cq)):
        for b in range(len(Cq)):
            if a != b: dq.append((float(np.hypot(*(Cq[b] - Cq[a]))), a, b))
    dq.sort()
    dists = [x[0] for x in dq]

    pares = [(i, j) for i, j in itertools.combinations(range(len(Cp)), 2)]
    pares = [(i, j) for i, j in pares if np.hypot(*(Cp[j] - Cp[i])) >= 40]
    pares.sort(key=lambda ij: -np.hypot(*(Cp[ij[1]] - Cp[ij[0]])))
    if len(pares) > max_pares:
        rnd = random.Random(7)
        pares = pares[:max_pares // 2] + rnd.sample(pares[max_pares // 2:], max_pares // 2)

    escalas = [forcar] if forcar else [e for e in ESCALAS
                                       if s0 is None or banda[0] * s0 <= e <= banda[1] * s0]
    if not escalas: escalas = list(ESCALAS)

    cands = []
    for i, j in pares:
        dij = float(np.hypot(*(Cp[j] - Cp[i])))
        for e in escalas:
            lo = bisect.bisect_left(dists, dij * e * 0.97)
            hi = bisect.bisect_right(dists, dij * e * 1.03)
            for k in range(lo, hi):
                _, a, b = dq[k]
                r = similaridade(Cp[i], Cp[j], Cq[a], Cq[b])
                if r is None: continue
                R, t, s, ang = r
                if snap(s) is None: continue
                if forcar is not None and abs(s - forcar) / forcar > 0.04: continue
                T = (R @ Cp.T).T + t
                d = np.hypot(*(T[:, None, :] - Cq[None, :, :]).transpose(2, 0, 1))
                dm = d.min(axis=1)
                n = int((dm < tol).sum())
                if n < 3: continue
                cands.append((n, -float(dm[dm < tol].mean()), R, t, s, ang))
                if len(cands) >= max_cands: break
            if len(cands) >= max_cands: break
        if len(cands) >= max_cands: break
    if not cands: return None
    cands.sort(key=lambda c: (c[0], c[1]), reverse=True)
    melhor = None
    for n, negerr, R, t, s, ang in cands[:40]:
        g = shapely_affine(Pp, R, t)
        try:
            iou = g.intersection(Pq).area / max(g.union(Pq).area, 1e-9)
        except Exception:
            continue
        val = iou
        if melhor is None or val > melhor[0]:
            melhor = (val, R, t, s, ang, n, -negerr, iou)
    if melhor is None: return None
    return (melhor[7],) + melhor[1:7]                  # devolve o IoU de verdade


def shapely_affine(g, R, t):
    from shapely.affinity import affine_transform
    return affine_transform(g, [R[0, 0], R[0, 1], R[1, 0], R[1, 1], t[0], t[1]])


def umeyama(A, B):
    """similaridade (R*s, t) que leva A em B (Nx2, pareados)."""
    ma, mb = A.mean(0), B.mean(0)
    X, Y = A - ma, B - mb
    U, D, Vt = np.linalg.svd(Y.T @ X / len(A))
    S = np.eye(2)
    if np.linalg.det(U @ Vt) < 0: S[1, 1] = -1
    R = U @ S @ Vt
    s = (D * np.diag(S)).sum() / max((X ** 2).sum() / len(A), 1e-12)
    return R * s, mb - (R * s) @ ma

def cantos(poly):
    r = np.array(poly.minimum_rotated_rectangle.exterior.coords)[:4]
    return r

# A PLANTA E O GABARITO. O poligono de quadra (quadras_saocarlos.geojson) e
# vetorizado de raster com dilatacao (~6% inflado) e serve so pra dizer ONDE por o
# desenho - nunca pra mudar o tamanho dele. Por isso o ajuste por quadra e RIGIDO:
# rotacao + translacao, escala travada na escala da prancha. Deixar a escala solta
# faz qualquer quadra "encaixar" em qualquer quadra e a IoU vira mentira
# (Jardim Alvorada: IoU 0,78 com o desenho 28% fora de escala).
ROT_MAX = math.radians(8.0)      # torto de scan/papel, nao correspondencia errada
DESL_MAX = 25.0                  # o refino local so ajeita; nao escorrega a quadra de lugar

def contido(g, Q):
    """Fracao da quadra-do-desenho que cai DENTRO da quadra oficial.
    E este o criterio, nao IoU: a uniao dos lotes nunca preenche a quadra inteira
    (sobram recuos, area institucional e a gordura do poligono raster), entao exigir
    IoU alta so premia quem estica o desenho ate encher - que e justamente o erro."""
    try:
        a = g.area
        return (g.intersection(Q).area / a) if a > 0 else 0.0
    except Exception:
        return 0.0

def rigido(A, B, s):
    """rotacao + translacao que leva A em B, com a escala FIXA em s (Kabsch)."""
    ma, mb = A.mean(0), B.mean(0)
    X, Y = A - ma, B - mb
    U, _, Vt = np.linalg.svd(Y.T @ X)
    D = np.eye(2)
    if np.linalg.det(U @ Vt) < 0: D[1, 1] = -1
    R = U @ D @ Vt
    M = s * R
    return M, mb - M @ ma

def ajusta_local(P, Q, s, ang_global=None, t_global=None, livre=False):
    """melhor encaixe da quadra P do desenho na quadra oficial Q, testando as 4
    rotacoes do retangulo minimo. Sem esticar: so gira e desloca, pouco."""
    A0, B0 = cantos(P), cantos(Q)
    melhor = None
    for k in range(4):
        if livre:
            Rl, tl = umeyama(A0, np.roll(B0, k, axis=0))
        else:
            Rl, tl = rigido(A0, np.roll(B0, k, axis=0), s)
            if ang_global is not None:
                d = (math.atan2(Rl[1, 0], Rl[0, 0]) - ang_global + math.pi) % (2 * math.pi) - math.pi
                if abs(d) > ROT_MAX: continue
            if t_global is not None:
                c = np.array(P.centroid.coords[0])
                if np.hypot(*((Rl @ c + tl) - (t_global[0] @ c + t_global[1]))) > DESL_MAX: continue
        g = shapely_affine(P, Rl, tl)
        c = contido(g, Q)
        if melhor is None or c > melhor[0]: melhor = (c, Rl, tl)
    return melhor

def refina_por_quadra(partes, qof, R, t, s, ang, tol=0.20, passes=2):
    """Ajuste local quadra a quadra: absorve a distorcao de scan/papel que a
    semelhanca global nao pega. Testa as 3 quadras oficiais mais provaveis."""
    locais = None
    for _ in range(passes):
        locais = []
        pares = []
        for P in partes:
            g = shapely_affine(P, R, t)
            cands = []
            for Q in qof:
                i = contido(g, Q)
                if i > 0: cands.append((i, Q))
            cands.sort(key=lambda c: c[0], reverse=True)
            if not cands or cands[0][0] < tol:
                locais.append((P, R, t, cands[0][0] if cands else 0.0, None)); continue
            melhor = None
            for i0, Q in cands[:3]:
                r = ajusta_local(P, Q, s, ang, (R, t))
                if r and (melhor is None or r[0] > melhor[0]): melhor = r + (Q,)
            if melhor and melhor[0] >= cands[0][0]:
                locais.append((P, melhor[1], melhor[2], melhor[0], melhor[3]))
                pares.append((P.centroid, melhor[3].centroid))
            else:
                locais.append((P, R, t, cands[0][0], cands[0][1]))
        if len(pares) >= 3:      # refaz a global so com as quadras que casaram - sem esticar
            A = np.array([[p.x, p.y] for p, _ in pares]); B = np.array([[q.x, q.y] for _, q in pares])
            R, t = rigido(A, B, s)
    return locais

def finaliza(js, polys, locais, qof, R, t, s, ang, n, err, iou, saida, usadas=None):
    """Aplica o ajuste (global + local por quadra), corta o que cai fora de quadra
    oficial e grava o geojson em WGS84."""
    from shapely.strtree import STRtree
    # a folga de 500 m serve pra ACHAR o encaixe; pra recortar vale so a quadra que casou
    alvo = usadas if usadas else qof
    qbuf = [q.buffer(4.0) for q in alvo]
    tree_q = STRtree(qbuf)
    prep = [(P.buffer(0.5), Rl, tl) for P, Rl, tl, *_ in locais]
    feats, fora = [], 0
    for g, l in polys:
        rp = g.representative_point()
        Rl, tl = R, t
        for P, Ra, ta in prep:
            if P.contains(rp): Rl, tl = Ra, ta; break
        c = np.array(g.exterior.coords)
        c = (Rl @ c.T).T + tl
        gu = Polygon(c)
        if not gu.is_valid: gu = gu.buffer(0)
        if gu.is_empty: continue
        p2 = gu.representative_point()
        cand = tree_q.query(p2)
        if not len(cand) or not any(qbuf[k].contains(p2) for k in cand):
            fora += 1
            continue
        # medir DEPOIS de projetar: assim vale a escala local da quadra, nao a global.
        # (a global pode errar - 000003 deu 1:2518 num desenho 1:2000 - e o refino
        #  por quadra esconde isso no IoU.)
        gm = shptransform(lambda x, y, z=None: INV.transform(x, y), gu)
        feats.append({"type": "Feature", "geometry": mapping(gm),
                      "properties": {"area_m2": round(l["area"] * s * s, 2),
                                     "frente_m": round(l["frente"] * s, 2),
                                     "fundo_m": round(l["fundo"] * s, 2)}})
    json.dump({"type": "FeatureCollection", "crs_origem": "EPSG:29193",
               "ajuste": {"quadras_casadas": n, "erro_medio_m": round(err, 2), "iou": round(iou, 3),
                          "escala": round(s, 5), "rotacao_graus": round(math.degrees(ang), 3)},
               "features": feats}, open(saida, "w"))
    import statistics
    A = [f["properties"]["area_m2"] for f in feats]
    print("descartados fora de quadra: %d" % fora)
    print("escala implicita do desenho: 1:%.0f" % (js["escala"] * s))
    if A:
        print("LOTES GEO %d | area mediana %.1f m2 | soma %.0f m2 | frente med %.2f | fundo med %.2f"
              % (len(A), statistics.median(A), sum(A),
                 statistics.median([f["properties"]["frente_m"] for f in feats]),
                 statistics.median([f["properties"]["fundo_m"] for f in feats])))
    print("-> %s (%d lotes)" % (saida, len(feats)))


def main(js_path, nome_lot, saida, escala_selo=None):
    js = json.load(open(js_path))
    polys, partes = quadras_planta(js)
    if not partes: raise SystemExit("nenhuma quadra achada no desenho")
    Cp = np.array([[p.centroid.x, p.centroid.y] for p in partes])
    qof, Plot = quadras_oficiais(nome_lot)
    Cq = np.array([[g.centroid.x, g.centroid.y] for g in qof])
    print("quadras: planta %d | oficiais %d" % (len(Cp), len(Cq)))
    if not len(Cq):
        raise SystemExit("sem quadra oficial dentro deste loteamento: nao da pra georreferenciar")

    if len(Cp) < 2:
        # planta de uma quadra so: sem par pro RANSAC, testa encaixe direto em cada quadra oficial
        melhor = None
        for Q in qof:
            r = ajusta_local(partes[0], Q, 1.0, livre=True)
            if r and (melhor is None or r[0] > melhor[0]): melhor = r
        if not melhor: raise SystemExit("nao casou (planta de quadra unica)")
        iou, R, t = melhor
        s = math.sqrt(abs(np.linalg.det(R)))
        print("encaixe: 1/1 quadras | IoU %.3f | erro medio 0.0 m | escala %.4f | rotacao %.2f graus"
              % (iou, s, math.degrees(math.atan2(R[1, 0], R[0, 0]))))
        print("refino por quadra: 1 quadras | IoU mediano %.3f | %d quadras com IoU>=0.5"
              % (iou, 1 if iou >= 0.5 else 0))
        return finaliza(js, polys, [(partes[0], R, t, iou, None)], qof, R, t, s,
                        math.atan2(R[1, 0], R[0, 0]), 1, 0.0, iou, saida)

    Pp = unary_union(partes); Pq = unary_union(qof)
    s0 = escala_provavel(partes, qof)
    print("escala provavel pelo tamanho das quadras: %.3f%s"
          % (s0, (" | selo diz 1:%d" % escala_selo) if escala_selo else ""))

    # Com o ajuste local RIGIDO a escala errada nao consegue mais se disfarcar:
    # da pra ESCOLHER a escala testando cada uma e vendo qual encaixa de verdade.
    # s0 e enviesado pra cima: a "quadra do desenho" e a uniao dos LOTES, que cobre
    # so parte da quadra oficial. Entao nao da pra usar s0 como trava - testa todas
    # as escalas de prancha e deixa o encaixe rigido decidir.
    if escala_selo:
        cand_esc = [escala_selo / js["escala"]]
    else:
        cand_esc = [e for e in ESCALAS if 0.35 * s0 <= e <= 1.20 * s0] or list(ESCALAS)
    melhor_tot = None
    for e in cand_esc:
        m = casar(Cp, Cq, Pp, Pq, s0=s0, forcar=e)
        if not m: continue
        iou, R, t, sc, ang, n, err = m
        loc = refina_por_quadra(partes, qof, R, t, sc, ang)
        iq = [l[3] for l in loc]
        if not iq: continue
        # nota = (o quanto do desenho cai dentro da quadra) x (o quanto da quadra
        # o desenho preenche). So containment premiaria escala pequena demais
        # (tudo cabe); so preenchimento premiaria escala grande demais.
        inter = a_g = a_q = 0.0
        for P, Rl, tl, _, Q in loc:
            g = shapely_affine(P, Rl, tl); a_g += g.area
            if Q is not None:
                inter += g.intersection(Q).area; a_q += Q.area
        dentro = inter / a_g if a_g else 0.0
        enche  = inter / a_q if a_q else 0.0
        nota = dentro * enche
        print("  escala 1:%-6.0f -> %d/%d quadras | dentro %.3f | enche %.3f | nota %.3f"
              % (js["escala"] * sc, n, len(Cp), dentro, enche, nota))
        if melhor_tot is None or nota > melhor_tot[0]:
            melhor_tot = (nota, iou, R, t, sc, ang, n, err, loc)
    if melhor_tot is None:
        m = casar(Cp, Cq, Pp, Pq, s0=s0) or casar(Cp, Cq, Pp, Pq)
        if not m: raise SystemExit("nao casou")
        iou, R, t, s, ang, n, err = m
        locais = refina_por_quadra(partes, qof, R, t, s, ang)
    else:
        _, iou, R, t, s, ang, n, err, locais = melhor_tot
    print("encaixe: %d/%d quadras | IoU %.3f | erro medio %.1f m | escala %.4f | rotacao %.2f graus"
          % (n, len(Cp), iou, err, s, math.degrees(ang)))
    ious = [l[3] for l in locais if l[3] > 0]
    print("encaixe por quadra: %d quadras | dentro mediano %.3f | %d quadras com dentro>=0.85"
          % (len(locais), float(np.median(ious)) if ious else 0,
             sum(1 for x in ious if x >= 0.85)))
    # recorta contra TODAS as quadras do loteamento: uma "parte" do desenho pode
    # cobrir varias quadras oficiais (o union junta quadras vizinhas coladas).
    finaliza(js, polys, locais, qof, R, t, s, ang, n, err, iou, saida)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3],
         int(sys.argv[4]) if len(sys.argv) > 4 and sys.argv[4].isdigit() else None)

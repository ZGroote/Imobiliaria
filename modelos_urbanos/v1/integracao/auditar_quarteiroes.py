# -*- coding: utf-8 -*-
"""Mede quarteirao a quarteirao: terreno, muro, ocupacao e uso da biblioteca.

E a etapa 1 do plano de proporcao/ocupacao: escolher tres trechos de teste com
MEDIDA, e nao no olho. Nao altera nada -- so le e escreve o relatorio.

    python modelos_urbanos/v1/integracao/auditar_quarteiroes.py
    python modelos_urbanos/v1/integracao/auditar_quarteiroes.py --raio 900

Cada linha do relatorio responde as seis perguntas do plano para um quarteirao:
largura (frente), profundidade (fundo), area, ocupacao, ORIGEM do lote e se o muro
desenhado bate com esse lote. A ultima e a que importa: `muros_segs.json` foi gerado
da fonte `lotes` configurada, que hoje NAO existe no disco -- o encaixe cai na fonte
alternativa `lotes_visualizacao`. Se as duas divergirem, a divergencia aparece aqui
como muro longe de qualquer divisa, e nao como bug visual no meio da cidade.
"""
import json, math, os, statistics, sys

sys.stdout.reconfigure(encoding="utf-8")
RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
sys.path.insert(0, RAIZ)
from padrao.cidade import carrega
from shapely.geometry import shape, Polygon, LineString, Point
from shapely.ops import unary_union, transform, polygonize
from shapely.strtree import STRtree
from pipeline.encaixar_casas_lotes import paths

CID = carrega(os.environ.get("CIDADE", "sao-carlos"))
a = sys.argv
RAIO = float(a[a.index("--raio") + 1]) if "--raio" in a else 1200.0
CX = float(a[a.index("--cx") + 1]) if "--cx" in a else -525.0
CZ = float(a[a.index("--cz") + 1]) if "--cz" in a else -1598.0
AQUI = os.path.dirname(os.path.abspath(__file__))

M = lambda g: transform(lambda x, y, z=None: CID.geo_para_mapa(x, y), g)
p = lambda v, q: (sorted(v)[min(len(v) - 1, int(q * len(v)))] if v else 0.0)


def area_int(a, b):
    """Area da intersecao que nao derruba a auditoria inteira num poligono torto.

    Tanto o telhado do city.json quanto a celula saida do polygonize aparecem com
    `side location conflict` em alguns milhares de casos; abandonar a medida do
    quarteirao por causa de um deles seria pior que medir o pior caso dele."""
    try:
        return a.intersection(b).area
    except Exception:
        try:
            return a.buffer(0).intersection(b.buffer(0)).area
        except Exception:
            return 0.0


def fonte_de_lotes():
    """A MESMA escolha do encaixar_casas_lotes: configurada, senao a alternativa."""
    cfg = CID.caminho("lotes")
    if os.path.exists(cfg):
        return cfg, "lotes (configurada)"
    alt = CID.caminhos("lotes_visualizacao", obrigatoria=False)
    if not alt:
        raise SystemExit("sem fonte de lotes")
    return alt[0], "lotes_visualizacao (alternativa: a configurada nao existe)"


def origem(props):
    """Procedencia declarada pelo proprio lote. Sem declaracao != cadastral."""
    f = props.get("fonte")
    if f:
        return f
    return "sintetico (grade lid/quadra)" if "lid" in props and "nx" in props else "nao declarada"


def frente_fundo(lot, vias, t_via):
    """Frente = o lado do retangulo minimo mais perto da RUA; fundo = o perpendicular.

    Mede contra o eixo da via, e nao contra a borda da quadra nem contra o nx/ny
    gravado: o nx/ny so existe em lote sintetico, e a borda da quadra so serve
    enquanto o lote e a quadra vierem da mesma rodada -- que e justamente o que nao
    se pode assumir com a fonte configurada ausente."""
    c = list(lot.minimum_rotated_rectangle.exterior.coords)
    lados = [(LineString([c[i], c[i + 1]]), math.dist(c[i], c[i + 1])) for i in range(4)]
    if min(L for _, L in lados) < 1e-6:
        return 0.0, 0.0
    perto = [int(j) for j in t_via.query(lot.buffer(60))]
    if not perto:
        seg = min(lados, key=lambda t: t[1])[0]
    else:
        seg = min(lados, key=lambda t: min(vias[j].distance(t[0].interpolate(.5, normalized=True))
                                           for j in perto))[0]
    L = seg.length
    outro = [x for _, x in lados if abs(x - L) > 0.05]
    return L, (outro[0] if outro else L)


def main():
    lot_path, rotulo = fonte_de_lotes()
    print("fonte de lotes: %s -> %s" % (rotulo, lot_path))
    mio = [M(shape(f["geometry"])) for f in
           json.load(open(CID.caminho("miolo"), encoding="utf-8"))["features"]]
    lots_raw = json.load(open(lot_path, encoding="utf-8"))["features"]
    lots, props = [], []
    for f in lots_raw:
        g = M(shape(f["geometry"]))
        if not g.is_valid:
            g = g.buffer(0)                     # lote com no repetido derruba o recorte
        if g.geom_type == "MultiPolygon":
            g = max(g.geoms, key=lambda h: h.area)
        if g.geom_type != "Polygon" or g.is_empty:
            continue
        lots.append(g); props.append(f["properties"])
    print("%d quarteiroes (miolo), %d lotes" % (len(mio), len(lots)))

    city = json.load(open(CID.caminho("city_saida"), encoding="utf-8"))
    q = city.get("q", 10)
    decod = list(paths(city["b"], 2, q))
    predios = [Polygon(r) for _, r in decod]
    predios = [g if g.is_valid else g.buffer(0) for g in predios]

    raw = json.load(open(CID.caminho("muros"), encoding="utf-8"))
    muros = []
    x = z = 0
    for i in range(0, len(raw), 4):
        x += raw[i]; z += raw[i + 1]
        if raw[i + 2] or raw[i + 3]:
            muros.append(LineString([(x / 10, z / 10), ((x + raw[i + 2]) / 10, (z + raw[i + 3]) / 10)]))

    vias = [LineString(r) for _, r in paths(city["r"], 2, q) if len(r) > 1]
    t_via = STRtree(vias)

    enc = json.load(open(os.path.join(AQUI, "encaixes-%s.json" % CID.slug), encoding="utf-8"))
    encaixes = [Point(v[1], v[2]) for v in enc["placements"].values()]

    t_lot, t_pred, t_muro, t_enc = (STRtree(lots), STRtree(predios), STRtree(muros), STRtree(encaixes))
    sel = [m for m in mio if m.is_valid and m.area > 400
           and abs(m.centroid.x - CX) < RAIO and abs(m.centroid.y - CZ) < RAIO]
    print("recorte de %.0f m em torno de (%.0f, %.0f): %d quarteiroes\n" % (RAIO, CX, CZ, len(sel)))

    linhas = []
    for m in sel:
        borda = m.exterior
        idx = [int(j) for j in t_lot.query(m) if lots[j].representative_point().within(m)]
        if len(idx) < 4:
            continue
        u = unary_union([lots[j].buffer(0).intersection(m.buffer(0)) for j in idx])
        fr, fu, ar, fora, per = [], [], [], 0.0, 0.0
        for j in idx:
            L = lots[j]
            f, d = frente_fundo(L, vias, t_via)
            fr.append(f); fu.append(d); ar.append(L.area)
            fora += max(0.0, L.area - area_int(L, m))
            per += L.exterior.length
        # ocupacao: telhado dentro do lote / area do lote
        ocup = []
        for j in idx:
            L = lots[j]
            b = sum(area_int(predios[k], L) for k in t_pred.query(L))
            ocup.append(min(1.0, b / L.area) if L.area else 0.0)
        # muro que nao encontra divisa: a prova de divergencia entre as fontes
        dm, comp = [], 0.0
        for k in t_muro.query(m):
            w = muros[k]
            if not m.contains(w.interpolate(0.5, normalized=True)):
                continue
            comp += w.length
            dm.append(min((lots[j].exterior.distance(w) for j in t_lot.query(w.buffer(6))), default=99.0))
        # O TERRENO QUE SE VE: a celula fechada pelos muros desenhados, e nao o
        # poligono de nenhum geojson. E a unica medida que nao depende de qual fonte
        # de lote gerou o que -- e e nela que o defeito foi reportado.
        seg_q = [muros[k] for k in t_muro.query(m)
                 if m.contains(muros[k].interpolate(.5, normalized=True))]
        cel = [c for c in polygonize(seg_q + [borda])
               if c.area >= 35 and c.representative_point().within(m)]
        cfr, cfu = [], []
        for c in cel:
            f, dd = frente_fundo(c, vias, t_via)
            cfr.append(f); cfu.append(dd)
        # PONTA SOLTA: muro que termina no meio do quintal, sem encontrar outro muro
        # nem a rua. Divisa que fecha lote nao tem ponta solta -- ela para na frente
        # (rua) ou encontra a divisa do fundo. Cada ponta solta e uma parede avulsa
        # atravessando o vazio, que e o que a foto do trecho A mostra.
        grau = {}
        for w in seg_q:
            for pt in (w.coords[0], w.coords[-1]):
                grau[(round(pt[0] * 2), round(pt[1] * 2))] =                     grau.get((round(pt[0] * 2), round(pt[1] * 2)), 0) + 1
        pontas = solt = 0
        for w in seg_q:
            for pt in (w.coords[0], w.coords[-1]):
                pontas += 1
                if grau[(round(pt[0] * 2), round(pt[1] * 2))] == 1 and borda.distance(Point(pt)) > 1.5:
                    solt += 1
        # buraco: onde a quadra nao e lote de ninguem
        falta = m.difference(u)
        nucleo = sum(g.area for g in (falta.geoms if falta.geom_type == "MultiPolygon" else [falta])
                     if g.geom_type == "Polygon" and g.area >= 2
                     and g.representative_point().distance(borda) >= 15)
        mrr = m.minimum_rotated_rectangle
        linhas.append(dict(
            x=round(m.centroid.x, 1), z=round(m.centroid.y, 1),
            quadra_m2=round(m.area), lotes=len(idx),
            frente_p50=round(statistics.median(fr), 1), fundo_p50=round(statistics.median(fu), 1),
            fundo_p90=round(p(fu, .9), 1), lote_m2_p50=round(statistics.median(ar)),
            cobertura=round(u.area / m.area, 3), nucleo_vazio_m2=round(nucleo),
            lote_fora_da_quadra_m2=round(fora),
            ocupacao_p50=round(statistics.median(ocup), 3),
            muro_m=round(comp),
            # quanto da divisa da quadra chegou a virar muro. Divisa e compartilhada,
            # entao o esperado e METADE da soma dos perimetros. Bem abaixo de 100%
            # significa fileira inteira de lote sem muro nenhum -- e e isso que faz a
            # celula fechada pelos muros ficar do tamanho de meia quadra.
            muro_cobertura=round(comp / (per / 2), 3) if per else None, muro_solto_p50_m=round(statistics.median(dm), 2) if dm else None,
            muro_solto_pct=round(100 * sum(1 for d in dm if d > 1.0) / len(dm), 1) if dm else None,
            celulas=len(cel),
            celula_frente_p50=round(statistics.median(cfr), 1) if cfr else None,
            celula_fundo_p50=round(statistics.median(cfu), 1) if cfu else None,
            celula_fundo_p90=round(p(cfu, .9), 1) if cfu else None,
            muro_ponta_solta_pct=round(100 * solt / pontas, 1) if pontas else None,
            encaixes=sum(1 for j in t_enc.query(m) if encaixes[j].within(m)),
            irregular=round(m.area / mrr.area, 3), vertices=len(m.exterior.coords) - 1,
            origem=origem(props[idx[0]])))
    linhas.sort(key=lambda r: (-r["fundo_p50"]))

    tudo = dict(
        cidade=CID.slug, fonte_lotes=lot_path, fonte_rotulo=rotulo,
        muros=CID.caminho("muros"), recorte=dict(cx=CX, cz=CZ, raio=RAIO),
        html_bytes=os.path.getsize(CID.caminho("html_comprimido"))
        if os.path.exists(CID.caminho("html_comprimido")) else None,
        quarteiroes=linhas)
    saida = os.path.join(AQUI, "auditoria-quarteiroes-%s.json" % CID.slug)
    json.dump(tudo, open(saida, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    fu = [r["fundo_p50"] for r in linhas]
    frv = [r["frente_p50"] for r in linhas]
    print("RESUMO de %d quarteiroes medidos" % len(linhas))
    print("  frente  p10 %.1f | mediana %.1f | p90 %.1f m" % (p(frv, .1), statistics.median(frv), p(frv, .9)))
    print("  fundo   p10 %.1f | mediana %.1f | p90 %.1f m" % (p(fu, .1), statistics.median(fu), p(fu, .9)))
    print("  fundo acima de 35 m (teto do lote da cidade): %d quarteiroes"
          % sum(1 for r in linhas if r["fundo_p50"] > 35))
    print("  ocupacao mediana do lote: %.1f%%"
          % (100 * statistics.median([r["ocupacao_p50"] for r in linhas])))
    cf = [r["celula_fundo_p50"] for r in linhas if r["celula_fundo_p50"]]
    cv = [r["muro_ponta_solta_pct"] for r in linhas if r["muro_ponta_solta_pct"] is not None]
    print("  TERRENO NA TELA (celula fechada pelos muros):")
    print("    frente p10 %.1f | mediana %.1f | p90 %.1f m"
          % (p([r["celula_frente_p50"] for r in linhas if r["celula_frente_p50"]], .1),
             statistics.median([r["celula_frente_p50"] for r in linhas if r["celula_frente_p50"]]),
             p([r["celula_frente_p50"] for r in linhas if r["celula_frente_p50"]], .9)))
    print("    fundo  p10 %.1f | mediana %.1f | p90 %.1f m | acima de 35 m: %d quarteiroes"
          % (p(cf, .1), statistics.median(cf), p(cf, .9), sum(1 for v in cf if v > 35)))
    print("    ponta de muro que morre no vazio: mediana %.1f%% das pontas" % statistics.median(cv))
    mc = [r["muro_cobertura"] for r in linhas if r["muro_cobertura"] is not None]
    print("  muro desenhado / divisa esperada: p10 %.2f | mediana %.2f | p90 %.2f"
          % (p(mc, .1), statistics.median(mc), p(mc, .9)))
    ms = [r["muro_solto_pct"] for r in linhas if r["muro_solto_pct"] is not None]
    print("  muro a mais de 1 m de qualquer divisa: mediana %.1f%% do quarteirao" % statistics.median(ms))
    print("  encaixes da biblioteca: %d em %d volumes de origem"
          % (sum(r["encaixes"] for r in linhas), len(predios)))
    print("-> %s" % saida)
    return linhas


if __name__ == "__main__":
    main()

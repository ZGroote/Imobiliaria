# -*- coding: utf-8 -*-
"""Portao de qualidade: mede o que o olho reclamou, com numero e limite.

Cada defeito que o usuario apontou virou uma medida com limiar em
`cidades/<slug>.json`. Rodar isto antes de publicar um build e a diferenca entre
"parece certo nesta janela" e "esta certo na cidade inteira".

  python padrao/rodar_qa.py sao-carlos

Sai 1 se algum portao reprovar - da pra pendurar no fim do pipeline.
"""
import io, json, math, os, collections
import numpy as np
import shapely
from shapely.geometry import Polygon, LineString, shape
from shapely.strtree import STRtree

from . import vias, pagina

ERODE = 0.25   # 25 cm pra dentro da borda: muro ENCOSTADO na rua nao e muro EM CIMA
               # dela. Sem isso, o conserto certo mede 221 km de "invasao" - que e
               # exatamente o encosto que foi pedido.


class Portao(object):
    # `familia` separa o que mede POLIGONO do que mede a PAGINA aberta: sao custos e
    # pre-requisitos diferentes (o segundo precisa de Chrome e leva minutos), e o
    # relatorio precisa dizer qual dos dois deixou de ser medido.
    def __init__(self, nome, valor, limite, unidade="", maior_e_pior=True, detalhe="",
                 familia="geometria"):
        # numpy escalar nao serializa em JSON: normaliza na entrada
        if isinstance(valor, np.generic): valor = valor.item()
        if isinstance(valor, float): valor = float(valor)
        self.nome = nome; self.valor = valor; self.limite = limite
        self.unidade = unidade; self.detalhe = detalhe; self.familia = familia
        if limite is None:
            self.passou = None
        elif isinstance(limite, bool):
            self.passou = bool(bool(valor) == limite)
        else:
            self.passou = bool((valor <= limite) if maior_e_pior else (valor >= limite))


def _pecas_da_fita(cid, city, folga, so_dirigivel=True):
    """So via DIRIGIVEL: e ela que o recorte de quadra respeita. Calcada e trilha
    (footway/path/cycleway/steps) o renderizador desenha, mas o pipeline nao corta por
    elas de proposito - caminho atravessando praca nao pode comer lote. O que cai sobre
    trilha e medido a parte, como informacao."""
    p = vias.fita(city, cid, folga=folga, juntar=False, so_dirigivel=so_dirigivel)
    arr = np.array([g for g in p if not g.is_empty], dtype=object)
    return arr, STRtree(arr)


def _cobertura(alvos, pecas, tree, medida):
    """Quanto de cada alvo cai dentro da fita (comprimento ou area), sem contar duas
    vezes o trecho coberto por duas vias que se sobrepoem."""
    out = np.zeros(len(alvos))
    ai, bi = tree.query(alvos, predicate="intersects")
    porA = collections.defaultdict(list)
    for a, b in zip(ai, bi): porA[a].append(b)
    for a, bs in porA.items():
        u = shapely.union_all(pecas[bs])
        out[a] = medida(shapely.intersection(alvos[a], u))
    return out


def decode_predios(city):
    """b[] do city.json -> aneis em METROS do mapa (o b[] vem em decimetros)."""
    b = city["b"]; Q = city.get("q", 10); out = []
    i = 0; n = len(b)
    while i < n:
        _cls, _h, npt = b[i], b[i + 1], b[i + 2]; i += 3
        lx = lz = 0; ring = []
        for _ in range(npt):
            lx += b[i]; lz += b[i + 1]; i += 2
            ring.append((lx / Q, lz / Q))
        if len(ring) >= 3: out.append(ring)
    return out


# ---------------------------------------------------------------- portoes
def portao_tabela_de_vias(cid):
    """A tabela de largura do navegador tem que ser a do JSON da cidade.

    Enquanto forem duas copias, elas divergem - e foi assim que o miolo passou a ser
    cortado com uma largura e a rua desenhada com outra."""
    html = cid.caminho("html_saida")
    if not os.path.exists(html):
        return Portao("tabela de vias (HTML x JSON)", False, True, detalhe="HTML nao encontrado")
    hw, rw = vias.tabela_do_html(html)
    if hw is None:
        return Portao("tabela de vias (HTML x JSON)", False, True, detalhe="nao achei HW/ROAD_W no HTML")
    dif = [k for k in set(list(rw) + list(cid.ROAD_W))
           if abs(rw.get(k, -1) - cid.ROAD_W.get(k, -2)) > 1e-9]
    ordem_ok = hw == cid.HW
    ok = (not dif) and ordem_ok
    det = "identicas" if ok else ("difere em: %s%s" % (", ".join(sorted(dif)[:6]),
                                                       "" if ordem_ok else " | ordem HW diferente"))
    return Portao("tabela de vias (HTML x JSON)", ok, True, detalhe=det)


def portao_muro_sobre_rua(cid, city):
    m = json.load(open(cid.caminho("muros"), encoding="utf-8"))
    Q = 10.0; px = pz = 0; segs = []
    for i in range(0, len(m), 4):
        x0 = px + m[i]; z0 = pz + m[i + 1]; x1 = x0 + m[i + 2]; z1 = z0 + m[i + 3]
        px, pz = x0, z0
        segs.append(LineString([(x0 / Q, z0 / Q), (x1 / Q, z1 / Q)]))
    segs = np.array(segs, dtype=object)
    L = shapely.length(segs)
    pecas, tree = _pecas_da_fita(cid, city, -ERODE)
    dentro = np.minimum(_cobertura(segs, pecas, tree, shapely.length), L)
    pct = 100.0 * dentro.sum() / max(L.sum(), 1e-9)
    return Portao("muro sobre a rua", pct, cid.limiar("muro_sobre_rua_pct"), "%",
                  detalhe="%.1f km de %.0f km | %.2f%% dos segmentos"
                          % (dentro.sum() / 1000, L.sum() / 1000, 100.0 * (dentro > 0.3).mean())), segs


def portao_lote(cid, city):
    d = json.load(open(cid.caminho("lotes"), encoding="utf-8"))
    occ = set(json.load(open(cid.caminho("lotes_ocupados"), encoding="utf-8")))
    polys = []; fonte = []; quadra = []; ocupado = []
    for i, f in enumerate(d["features"]):
        g = f["geometry"]
        if g["type"] != "Polygon": continue
        ring = [cid.geo_para_mapa(x, y) for x, y in g["coordinates"][0]]
        if len(ring) < 4: continue
        polys.append(shapely.make_valid(Polygon(ring)))
        p = f["properties"]
        fonte.append(p.get("fonte")); quadra.append(p.get("quadra")); ocupado.append(i in occ)
    polys = np.array(polys, dtype=object)
    areas = shapely.area(polys)
    pecas, tree = _pecas_da_fita(cid, city, -ERODE)
    sobre = np.minimum(_cobertura(polys, pecas, tree, shapely.area), areas)
    pct = 100.0 * sobre.sum() / max(areas.sum(), 1e-9)
    g1 = Portao("lote sobre a rua", pct, cid.limiar("lote_sobre_rua_pct"), "%",
                detalhe="%d lotes | %.0f ha" % (len(polys), areas.sum() / 1e4))

    # encosto: a frente tem que BATER na rua, nao parar 2 m antes
    pfull, tfull = _pecas_da_fita(cid, city, 0.0)
    ocu = np.array(ocupado)
    dist = []
    for i in np.nonzero(ocu)[0]:
        js = tfull.query(polys[i].buffer(40))
        if len(js) == 0: continue
        dist.append(min(pfull[j].distance(polys[i]) for j in js))
    med = float(np.median(dist)) if dist else 99.0
    g2 = Portao("frente do lote encostada na rua (mediana)", med,
                cid.limiar("lote_encosta_mediana_m"), "m",
                detalhe="%d lotes ocupados" % len(dist))

    # Lote gerado precisa ter uma testada na malha viaria. A mediana acima deixa
    # milhares de lotes cegos passarem desde que a maioria esteja certa; aqui o
    # aceite e absoluto e se restringe às fontes sinteticas. Planta confirmada pode
    # representar condominio com circulacao interna ausente da malha de ruas.
    geradas = {"sintetico", "planta_refeita", "planta_complemento"}
    cegos = []
    for i, f in enumerate(fonte):
        if f not in geradas: continue
        js = tfull.query(polys[i].buffer(60))
        d = min((pfull[j].distance(polys[i]) for j in js), default=99.0)
        if d > 0.5: cegos.append((i, round(d, 1), quadra[i]))
    g3 = Portao("lote sintetico sem acesso a rua", len(cegos), 0, "lotes",
                detalhe=("limpo" if not cegos else "piores: " + str(cegos[:5])))
    return g1, g2, g3, polys, fonte, quadra


def portao_quadra_alinhada(cid, polys, fonte, quadra, so_fonte=("planta",)):
    """Os lotes da quadra apontam pra rua da quadra?

    delta = angulo dominante dos lotes x eixo do quarteirao, PERIODO 90 GRAUS. Periodo
    180 nao serve: lote de testada e perpendicular ao lado comprido da quadra e lote de
    esquina e paralelo - os dois certos - e a media circular dos dois se cancela.

    O portao vale so pras quadras que importaram o DESENHO de uma planta (`so_fonte`):
    e ali que um carimbo torto entra sem ninguem ver. Quadra gerada pelo perimetro do
    proprio miolo e alinhada por construcao; quando ela acusa desalinho, e o eixo do
    retangulo minimo da quadra que nao significa nada (quadra em L, ponta de rua curva).
    """
    # Cidade sem cadastro nao tem esse arquivo -- e sem planta oficial este portao
    # nao tem o que medir de qualquer forma (ele so olha quadra de fonte "planta").
    _q = cid.caminho("quadras")
    if not os.path.exists(_q):
        return Portao("quadra com lote fora do eixo da rua", 0,
                      cid.limiar("quadras_desalinhadas"), "quadras",
                      detalhe="sem cadastro de quadra: nada de planta pra examinar")
    q = json.load(open(_q, encoding="utf-8"))
    eixo_q = {}
    for f in q["features"]:
        g = shape(f["geometry"])
        if g.geom_type != "Polygon": continue
        eixo_q[f["properties"]["id"]] = _eixo(Polygon([cid.geo_para_mapa(x, y)
                                                       for x, y in g.exterior.coords]))
    por = collections.defaultdict(list)
    for i, p in enumerate(polys):
        if fonte[i] not in so_fonte: continue
        a = _eixo(p)
        if a is not None: por[quadra[i]].append(a)
    ruins = 0; total = 0; piores = []
    lim = cid.exame.get("desalinho_max_graus", 15.0)
    for qi, angs in por.items():
        if len(angs) < 4 or eixo_q.get(qi) is None: continue
        total += 1
        v = np.array(angs) * 4 * math.pi / 180.0
        dom = math.degrees(math.atan2(np.sin(v).mean(), np.cos(v).mean())) / 4 % 90
        d = abs(dom - (eixo_q[qi] % 90)) % 90
        d = min(d, 90 - d)
        if d > lim:
            ruins += 1; piores.append((round(d, 1), qi, len(angs)))
    piores.sort(reverse=True)
    return Portao("quadra com lote fora do eixo da rua", ruins,
                  cid.limiar("quadras_desalinhadas"), "quadras",
                  detalhe="de %d quadras de planta%s" % (total,
                          "" if not piores else " | piores: " + ", ".join(
                              "q%d %.0f graus" % (p[1], p[0]) for p in piores[:4])))


def portao_casa_sobre_rua(cid, city):
    aneis = decode_predios(city)
    polys = np.array([shapely.make_valid(Polygon(a)) for a in aneis], dtype=object)
    areas = shapely.area(polys)
    pecas, tree = _pecas_da_fita(cid, city, -ERODE)
    sobre = np.minimum(_cobertura(polys, pecas, tree, shapely.area), areas)
    pct = 100.0 * sobre.sum() / max(areas.sum(), 1e-9)
    return Portao("casa sobre a rua", pct, cid.limiar("casa_sobre_rua_pct"), "%",
                  detalhe="%d volumes | %d com mais de 2 m2 no asfalto"
                          % (len(polys), int((sobre > 2).sum())))


def portao_muro_no_chao(cid):
    """O muro segue o relevo? Medido DENTRO da pagina, no artefato final.

    1,1 m e metade da altura do muro (2,2 m): acima disso o pedaco esta claramente
    enterrado ou no ar. Nao ha versao em Python desta medida de proposito - a regra
    de como o muro amostra o relevo mora no renderizador, e reimplementa-la aqui
    recriaria a divergencia que o projeto acabou de matar."""
    html = cid.caminho("html_saida")
    if not pagina.disponivel() or not os.path.exists(html):
        return Portao("muro fora do chao (na pagina)", None, None, detalhe="sem Chrome/HTML: nao medido")
    d = pagina.roda(html, pagina.JS_MURO_NO_CHAO)
    if not d or "fora_do_chao" not in d:
        return Portao("muro fora do chao (na pagina)", 100.0, cid.limiar("muro_fora_do_chao_pct"), "%",
                      detalhe="sonda nao respondeu: %s" % (d or "sem resposta"))
    return Portao("muro fora do chao (na pagina)", 100.0 * d["fora_do_chao"],
                  cid.limiar("muro_fora_do_chao_pct"), "%",
                  detalhe="%d vertices | erro p50 %.2f p99 %.2f max %.1f m"
                          % (d["vertices"], d["p50"], d["p99"], d["max"]))


def portao_arvore_na_calcada(cid, city):
    """A arvore de rua nasce na CALCADA? Medido na pagina, sobre a fita do Python.

    Ate o v9 nao havia arvore de rua: ela foi desligada no v6 porque caia em cima da
    casa e do asfalto. O v10 devolve a arvore plantando o tronco na faixa entre a borda
    da pista (ROAD_W/2 x mul_pista) e o fim da fita (x mul_fita) -- a calcada que o
    renderizador ja desenha, e onde quadra, lote e muro nao entram.

    As duas metades da medida vem de fontes independentes de proposito: a POSICAO sai
    da pagina montada (`userData.pesRua`, o que o usuario ve), e a FITA sai de
    `padrao/vias.py` em Python. Recalcular a regra de plantio aqui provaria so que a
    formula e igual a ela mesma."""
    lim = cid.limiar("arvore_fora_da_calcada_pct")
    html = cid.caminho("html_saida")
    if not pagina.disponivel() or not os.path.exists(html):
        return Portao("arvore fora da calcada (na pagina)", None, None,
                      detalhe="sem Chrome/HTML: nao medido")
    # O headless monta a cidade por software: 75 s de orcamento davam pagina em
    # branco em uma tentativa de cada duas. O plantio so existe depois que o
    # streaming entrega o primeiro quarteirao.
    d = pagina.roda(html, pagina.JS_ARVORES, exporta=("cena",), espera_ms=180000)
    if not d or "pes" not in d:
        return Portao("arvore fora da calcada (na pagina)", 100.0, lim, "%",
                      detalhe="sonda nao respondeu: %s" % (d or "sem resposta"))
    pes = d["pes"]
    if not pes:
        return Portao("arvore fora da calcada (na pagina)", None, None,
                      detalhe="a sonda nao montou nenhuma arvore de rua "
                              "(%d especies vivas)" % d.get("especies_vivas", 0))
    pts = shapely.points(np.array(pes, dtype=float))
    # so_dirigivel=False: a lista de vias arborizadas e da cidade, e nao coincide com
    # a de vias que recortam quadra -- medir contra a fita errada acusaria invasao onde
    # nao ha.
    _ext, t_ext = _pecas_da_fita(cid, city, folga=0.0, so_dirigivel=False)
    asfalto = np.array([g for g in vias.fita(city, cid, mul=cid.mul_pista, juntar=False)
                        if not g.is_empty], dtype=object)
    t_asf = STRtree(asfalto)
    dentro_fita = np.zeros(len(pts), dtype=bool)
    for a, _b in zip(*t_ext.query(pts, predicate="intersects")):
        dentro_fita[a] = True
    no_asfalto = np.zeros(len(pts), dtype=bool)
    for a, _b in zip(*t_asf.query(pts, predicate="intersects")):
        no_asfalto[a] = True
    fora = (~dentro_fita) | no_asfalto
    return Portao("arvore fora da calcada (na pagina)", 100.0 * fora.mean(), lim, "%",
                  detalhe="%d arvores de rua | %d alem da fita, %d sobre o asfalto | "
                          "%d especies vivas, %d arvores, %s tris de arvore"
                          % (len(pes), int((~dentro_fita).sum()), int(no_asfalto.sum()),
                             d.get("especies_vivas", 0), d.get("arvores", 0),
                             "{:,}".format(int(d.get("tris_arvores", 0))).replace(",", ".")))


def _eixo(poly):
    try:
        mrr = poly.minimum_rotated_rectangle
        if mrr.geom_type != "Polygon": return None
        cs = list(mrr.exterior.coords)[:4]
        e = sorted(((math.dist(cs[k], cs[(k + 1) % 4]), cs[k], cs[(k + 1) % 4])
                    for k in range(4)), reverse=True)
        _L, a, b = e[0]
        return math.degrees(math.atan2(b[1] - a[1], b[0] - a[0])) % 180
    except Exception:
        return None


def portao_cidade_fora_do_codigo(cid):
    """Nenhuma constante DESTA cidade escrita dentro do renderizador.

    Era exatamente isto que travava "qualquer cidade": `const CENTER = {-22.01725,
    -47.89080}` e `const Q = 10` moravam no codigo, e o city.json ja trazia os mesmos
    valores nos campos `c` e `q` -- que o renderizador ignorava. A geometria ate
    desenhava (as coordenadas sao metros relativos ao centro), mas POI, grade de relevo
    e rotulo de rua saiam no lugar errado.

    O portao existe pra isso nao voltar: quem reintroduzir a coordenada no codigo
    reprova o build. Comentario nao conta -- explicar o historico e permitido. E o
    array HOUSES (as vitrines de imovel) tambem nao: e conteudo de demonstracao,
    declarado como divida no PIPELINE.md, nao configuracao do renderizador."""
    import re as _re
    raiz = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    alvo = os.path.join(raiz, "renderizador")
    if not os.path.isdir(alvo):
        return Portao("cidade fora do codigo do renderizador", None, None, detalhe="sem renderizador/")
    proibidos = ["%.5f" % cid.clat, "%.5f" % cid.clon,
                 ("%.5f" % cid.clat).rstrip("0"), ("%.5f" % cid.clon).rstrip("0")]
    achados = []
    for pasta, _, arqs in os.walk(alvo):
        if "lib" in pasta.replace(raiz, "").split(os.sep): continue      # three.js/earcut
        for a in arqs:
            if not a.endswith((".js", ".html", ".css")): continue
            p = os.path.join(pasta, a)
            for n, linha in enumerate(io.open(p, encoding="utf-8", errors="replace"), 1):
                nu = linha.strip()
                if nu.startswith("//") or nu.startswith("*") or nu.startswith("<!--"): continue
                if "roca.com.br" in nu or "titulo:" in nu: continue      # vitrine HOUSES
                if any(x in linha for x in proibidos):
                    achados.append("%s:%d" % (a, n))
    return Portao("cidade fora do codigo do renderizador", len(achados), 0, "ocorrencias",
                  detalhe=("limpo" if not achados else "coordenada da cidade em " + ", ".join(achados[:5])))


def roda(cid, comportamento=True):
    """Os portoes da cidade: primeiro a GEOMETRIA, depois o COMPORTAMENTO.

    A separacao e de natureza, nao de gosto. Os de geometria abrem arquivo e medem
    poligono; os de comportamento (`padrao/comportamento.py`) abrem a PAGINA num Chrome
    headless e mexem nela -- e a unica forma de provar o que o v11..v13 acrescentou, que
    e interface e nao coordenada. Custam ~3 min por cidade e precisam de Chrome, dai o
    `--rapido` do rodar_qa; mas o padrao e rodar os dois, senao volta o buraco que este
    modulo existe pra fechar: build aprovado por nove medidas de geometria enquanto o
    que mudou era o clique."""
    city = json.load(open(cid.caminho("city_saida"), encoding="utf-8"))
    portoes = [portao_tabela_de_vias(cid), portao_cidade_fora_do_codigo(cid)]
    g, _segs = portao_muro_sobre_rua(cid, city)
    portoes.append(g)
    g1, g2, g3, polys, fonte, quadra = portao_lote(cid, city)
    portoes += [g1, g2, g3, portao_quadra_alinhada(cid, polys, fonte, quadra),
                portao_casa_sobre_rua(cid, city), portao_muro_no_chao(cid),
                portao_arvore_na_calcada(cid, city)]
    if comportamento:
        # importado AQUI de proposito: `comportamento` importa `Portao` deste modulo, e
        # no topo os dois se importariam em circulo.
        from padrao import comportamento as comp
        portoes += comp.roda(cid)
    return portoes

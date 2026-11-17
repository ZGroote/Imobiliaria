"""Audita as duas bases e reproduz cinco geometrias de ensaio, sem alterar fontes.

Execute: python -I viabilidade/terreno/gerar_lotes.py
Verifique a saída existente: python -I viabilidade/terreno/gerar_lotes.py --testar
Dependências existentes: numpy, shapely >= 2, pyproj.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import site
import sys
from collections import Counter

import numpy as np
import shapely as sh
from shapely.geometry import LineString, Point, Polygon, shape
from shapely.ops import substring

try:
    from pyproj import Transformer
except ModuleNotFoundError:
    # O pyproj já instalado no computador fica fora do site usado por python -I.
    sys.path.append(site.getusersitepackages())
    from pyproj import Transformer

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
BASES = ["lotes_saocarlos.geojson", "sao-carlos/dados/lotes_saocarlos_completo.geojson"]
UTM = Transformer.from_crs(4326, 31983, always_xy=True)
GEO = Transformer.from_crs(31983, 4326, always_xy=True)
CONFIG = json.loads((ROOT / "padrao/cidades/sao-carlos.json").read_text(encoding="utf-8"))
CLON, CLAT = CONFIG["centro"]["lon"], CONFIG["centro"]["lat"]
MLON, MLAT = 111319.49 * math.cos(math.radians(CLAT)), 111132.92
CENTRO = Point(UTM.transform(CLON, CLAT))


def ler(nome):
    return json.loads((ROOT / nome).read_text(encoding="utf-8"))


def gravar(path, dado):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(dado, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def auditoria(nome):
    features = ler(nome)["features"]
    geos = np.array([shape(f["geometry"]) for f in features], dtype=object)
    geos = sh.transform(geos, UTM.transform, interleaved=False)
    areas, validos = sh.area(geos), sh.is_valid(geos)
    ids = np.flatnonzero(validos & ~sh.is_empty(geos))
    tree = sh.STRtree(geos[ids])
    a, b = tree.query(geos[ids], predicate="intersects")
    unico = a < b
    a, b = ids[a[unico]], ids[b[unico]]
    inter = sh.area(sh.intersection(geos[a], geos[b]))
    relevantes = inter > 0.1
    maiores = np.argsort(inter)[-5:][::-1]
    retangulos = sh.area(sh.minimum_rotated_rectangle(geos[ids]))
    qualidade = {
        "arquivo": nome,
        "sha256": hashlib.sha256((ROOT / nome).read_bytes()).hexdigest(),
        "feicoes": len(features), "geometrias": dict(Counter(g.geom_type for g in geos)),
        "fontes": dict(Counter(f["properties"].get("fonte", "sem_rotulo") for f in features)),
        "invalidas": int((~validos).sum()), "vazias": int(sh.is_empty(geos).sum()),
        "com_buracos": sum(bool(g.interiors) for g in geos if g.geom_type == "Polygon"),
        "area_m2_percentis_0_1_50_95_99_100": np.percentile(areas, [0, 1, 50, 95, 99, 100]).round(3).tolist(),
        "area_menor_35_m2": int((areas < 35).sum()), "area_maior_1500_m2": int((areas > 1500).sum()),
        "area_maior_10000_m2": int((areas > 10000).sum()),
        "ocupacao_retangulo_menor_0_5": int((areas[ids] / retangulos < 0.5).sum()),
        "pares_sobrepostos_mais_0_1_m2": int(relevantes.sum()),
        "feicoes_em_sobreposicao": len(set(a[relevantes].tolist() + b[relevantes].tolist())),
        "soma_intersecoes_pares_m2_nao_area_unica": round(float(inter[relevantes].sum()), 3),
        "maiores_intersecoes": [{"indices_zero_based": [int(a[k]), int(b[k])], "area_m2": round(float(inter[k]), 3)} for k in maiores],
        "exemplos_invalidos": [{"indice": int(k), "motivo": sh.is_valid_reason(geos[k])} for k in np.flatnonzero(~validos)[:5]],
    }
    print(json.dumps(qualidade, ensure_ascii=False), flush=True)
    return features, geos, qualidade


def ruas():
    dados = np.array(ler("sao-carlos/dados/street_tris.json"), dtype=float).reshape(-1, 3, 2)
    lon = CLON + dados[:, :, 0] / MLON
    lat = CLAT - dados[:, :, 1] / MLAT
    x, y = UTM.transform(lon, lat)
    tris = sh.polygons(np.stack([x, y], axis=-1))
    return tris[sh.is_valid(tris) & (sh.area(tris) > 0)], len(dados)


GIRO_MAX = 10  # graus: arestas contíguas que não desviam mais que isso da primeira formam um lado só
TOLERANCIA_M = 12  # asfalto a mais de 6 m e até isso só vale com aviso e sem lote no meio (largura do corredor entre quadras)


def cadeias(coords):
    """Arestas contíguas quase colineares (a base picota o lado da rua): [(índices, pontos)], a partir de uma quina."""
    n = len(coords) - 1
    rumo = [math.atan2(coords[k+1][1] - coords[k][1], coords[k+1][0] - coords[k][0]) for k in range(n)]
    desvio = lambda a, b: abs(math.degrees((rumo[a] - rumo[b] + math.pi) % (2*math.pi) - math.pi))
    inicio = next((k for k in range(n) if desvio(k, k-1) > GIRO_MAX), None)
    if inicio is None:
        return []  # sem quina (quase círculo): não há lado reto pra juntar
    grupos = [[inicio]]
    for k in (j % n for j in range(inicio + 1, inicio + n)):
        if desvio(k, grupos[-1][0]) > GIRO_MAX:
            grupos.append([])
        grupos[-1].append(k)
    return [(ks, [coords[k] for k in ks] + [coords[ks[-1] + 1]]) for ks in grupos]


def frentes_ampliadas(g, indice, geos, tree, rua, minimo=8):
    """Só quando nenhuma aresta passa: junta arestas colineares e aceita asfalto até TOLERANCIA_M sem lote no meio."""
    frentes = []
    for ks, pts in cadeias(list(g.exterior.coords)):
        corda = math.dist(pts[0], pts[-1])
        if corda < minimo:
            continue
        linha = LineString(pts)
        amostras = [linha.interpolate(t, normalized=True) for t in (0.15, 0.5, 0.85)]
        distancias = [p.distance(rua) for p in amostras]
        if max(distancias) <= 6:
            regra = "arestas_colineares"
        elif max(distancias) <= TOLERANCIA_M:
            # o caminho até o asfalto não pode cortar o próprio lote nem outro (fundo de quadra, miolo)
            caminhos = [sh.shortest_line(p, rua) for p in amostras]
            if any(g.intersection(c).length > 0.5 or any(j != indice and geos[j].intersection(c).length > 0.5
                                                         for j in tree.query(c, predicate="intersects"))
                   for c in caminhos):
                continue
            regra = "tolerancia_asfalto_12m"
        else:
            continue
        frentes.append({"aresta": ks[0], "arestas": ks, "pontos": [list(pts[0]), list(pts[-1])],
                        "comprimento_m": round(corda, 3), "distancia_max_asfalto_m": round(max(distancias), 3),
                        "regra": regra})
    frentes.sort(key=lambda f: (f["regra"] != "arestas_colineares", -f["comprimento_m"], f["aresta"]))
    return frentes


VAO_M = (8, 30)  # largura do corredor livre de lote em frente a uma borda de quadra (rua sem asfalto na malha)
ALEM_M = 30  # faixa além do vão: a quadra do outro lado tem que estar lá (vazio grande = praça, área verde, gleba)
LIVRE_MAX = 0.5  # fração livre de lote nessa faixa acima disso: não é corredor, recusa
EIXO_M = (60, 250)  # o eixo do corredor segue livre de lote por 60 m ou mais (procura até 250 m para cada lado)


def frentes_borda(g, indice, geos, tree, tree_ruas):
    """Regra 3, só sem asfalto que sirva: lado que não encosta em lote e dá para um corredor de 8 a 30 m até a quadra
    do outro lado, aberto nas duas pontas e ligado à malha de asfalto (viela, fundo de quadra e lote faltando no miolo
    não passam)."""
    def lote(j):  # vizinho inválido no cadastro (laço, anel de 3 pontos) é consertado antes de cruzar com qualquer coisa
        return geos[j] if geos[j].is_valid else sh.make_valid(geos[j])

    def livre(geom, minimo=0.5):  # nenhum lote (nem o próprio) ocupa mais que `minimo` m² de geom
        return all(lote(j).intersection(geom).area <= minimo for j in tree.query(geom, predicate="intersects"))
    frentes = []
    for ks, pts in cadeias(list(g.exterior.coords)):
        corda = math.dist(pts[0], pts[-1])
        if corda < 8:
            continue
        a, b = np.array(pts[0]), np.array(pts[-1])
        u = (b - a) / corda
        n = np.array([u[1], -u[0]])
        if g.contains(Point(*(a + b) / 2 + n * 0.5)):
            n = -n  # normal para fora do lote
        linha = LineString(pts)
        # (a) lado livre: nenhum lote a 0,5 m do miolo do lado (as pontas podem encostar no vizinho de divisa)
        miolo = substring(linha, 0.1, 0.9, normalized=True)
        if any(j != indice and lote(j).distance(miolo) <= 0.5 for j in tree.query(miolo, predicate="dwithin", distance=0.5)):
            continue
        # (b) vão: faixa de 8 m à frente sem lote; raios (2 m de largura) de 30 m em 3 pontos batem num lote entre 8 e 30 m
        p0, p1 = a + u * corda * 0.1, b - u * corda * 0.1
        if not livre(Polygon([p0 + n * 0.3, p1 + n * 0.3, p1 + n * VAO_M[0], p0 + n * VAO_M[0]])):
            continue
        vaos = []
        for t in (0.15, 0.5, 0.85):
            p = a + (b - a) * t
            raio = LineString([p + n * 0.3, p + n * VAO_M[1]]).buffer(1.0, cap_style="flat")  # faixa de 2 m: fresta entre lotes não vaza
            batidas = [Point(*p).distance(lote(j).intersection(raio)) for j in tree.query(raio, predicate="intersects")
                       if not lote(j).intersection(raio).is_empty]
            vaos.append(min(batidas, default=math.inf))
        if not all(VAO_M[0] <= v <= VAO_M[1] for v in vaos):
            continue
        w = float(np.median(vaos))
        # (c) corredor aberto nas duas pontas: o eixo do vão continua livre 10 m além de cada ponta do lado
        if not all(livre(Point(*q).buffer(1.0), 0.0) for q in (a - u * 10 + n * w / 2, b + u * 10 + n * w / 2)):
            continue
        # (c) praça/área verde: atrás do vão tem que haver quadra; faixa de ALEM_M além do vão mais da metade vazia = recusa
        faixa = Polygon([a + n * (w + 1), b + n * (w + 1), b + n * (w + 1 + ALEM_M), a + n * (w + 1 + ALEM_M)])
        ocupado = sh.union_all([lote(j) for j in tree.query(faixa, predicate="intersects")]).intersection(faixa).area
        if 1 - ocupado / faixa.area > LIVRE_MAX:
            continue
        # (c) é rua: o eixo do vão, até o primeiro lote de cada lado, tem 60 m ou mais e passa a até 6 m do asfalto
        m = (a + b) / 2 + n * w / 2
        alcance = []
        for s in (u, -u):
            eixo = LineString([m, m + s * EIXO_M[1]])
            alcance.append(min((Point(*m).distance(lote(j).intersection(eixo)) for j in tree.query(eixo, predicate="intersects")
                                if not lote(j).intersection(eixo).is_empty), default=EIXO_M[1]))
        eixo = LineString([m - u * alcance[1], m + u * alcance[0]])
        if eixo.length < EIXO_M[0] or not len(tree_ruas.query(eixo, predicate="dwithin", distance=6)):
            continue
        frentes.append({"aresta": ks[0], "arestas": ks, "pontos": [list(pts[0]), list(pts[-1])],
                        "comprimento_m": round(corda, 3), "largura_vao_m": round(w, 3), "regra": "borda_de_quadra"})
    frentes.sort(key=lambda f: (-f["comprimento_m"], f["aresta"]))
    # a principal é a que chega mais perto do asfalto (o cruzamento encosta na rua de verdade, o vazio do miolo fica longe
    # dele); diferença de até 1 m fica a mais comprida
    perto = [float(tree_ruas.query_nearest(LineString(f["pontos"]), return_distance=True)[1][0]) for f in frentes]
    k = int(np.argmin(perto)) if frentes else 0
    if frentes and perto[k] < perto[0] - 1:
        frentes.insert(0, frentes.pop(k))
    return frentes


OSM_FRENTE = {"residential", "primary", "secondary", "tertiary", "living_street"}  # track/unclassified/service: fora
OSM_EIXO_M = 8  # o lado (3 pontos) a até isso do eixo da via: meia pista + calçada de rua local
OSM_EIXO_LARGA_M = 11  # avenida (primary/secondary) é mais larga: o eixo fica mais longe da calçada (T26: 8,7 a 10,5 m)
OSM_LARGAS = {"primary", "secondary"}
OSM_ANGULO = 20  # graus entre o lado e o trecho da via: 2x o GIRO_MAX que já junta o lado picotado; a lateral de esquina dá ~90


def vias_osm(caminho, tree_ruas):
    """Vias de carro do OSM (dados/osm-vias-sao-carlos.json.gz) em UTM; `ligada` = o grupo de vias que se tocam chega
    a 6 m da malha de asfalto (trecho solto na mata não conta)."""
    import gzip
    dado = json.loads(gzip.decompress(Path(caminho).read_bytes()))
    vias = dado["vias"]
    linhas = np.array([LineString([UTM.transform(*c) for c in v["coords"]]) for v in vias], dtype=object)
    tree = sh.STRtree(linhas)
    pai = list(range(len(vias)))

    def raiz(k):
        while pai[k] != k:
            pai[k] = pai[pai[k]]
            k = pai[k]
        return k
    for a, b in zip(*tree.query(linhas, predicate="intersects")):
        pai[raiz(a)] = raiz(b)
    perto = {raiz(k) for k in np.flatnonzero([len(tree_ruas.query(l, predicate="dwithin", distance=6)) > 0 for l in linhas])}
    ligada = np.array([raiz(k) in perto for k in range(len(vias))])
    return {"vias": vias, "linhas": linhas, "tree": tree, "ligada": ligada, "data_osm": dado["data_osm"]}


def frentes_osm(g, indice, geos, tree, osm, minimo=8):
    """Regra 4, só quando a malha não deu frente: lado livre de lote (>= 8 m) a até OSM_EIXO_M do eixo de uma via de carro
    do OSM ligada à rede (OSM_EIXO_LARGA_M em avenida), quase paralelo a ela e sem lote no caminho. Frente provável, não
    testada legal nem acesso público."""
    def lote(j):
        return geos[j] if geos[j].is_valid else sh.make_valid(geos[j])
    frentes = []
    for ks, pts in cadeias(list(g.exterior.coords)):
        corda = math.dist(pts[0], pts[-1])
        if corda < minimo:
            continue
        linha = LineString(pts)
        miolo = substring(linha, 0.1, 0.9, normalized=True)
        if any(j != indice and lote(j).distance(miolo) <= 0.5 for j in tree.query(miolo, predicate="dwithin", distance=0.5)):
            continue  # lado encostado em lote: divisa, não frente
        amostras = [linha.interpolate(t, normalized=True) for t in (0.15, 0.5, 0.85)]
        rumo = math.atan2(pts[-1][1] - pts[0][1], pts[-1][0] - pts[0][0])
        melhor = None
        for k in osm["tree"].query(linha, predicate="dwithin", distance=max(OSM_EIXO_M, OSM_EIXO_LARGA_M)):
            via, eixo = osm["vias"][k], osm["linhas"][k]
            if via["highway"] not in OSM_FRENTE or not osm["ligada"][k]:
                continue
            d = max(p.distance(eixo) for p in amostras)
            if d > (OSM_EIXO_LARGA_M if via["highway"] in OSM_LARGAS else OSM_EIXO_M):
                continue
            s = eixo.project(amostras[1])  # rumo do trecho da via em frente ao meio do lado
            q0, q1 = eixo.interpolate(max(0, s - 5)), eixo.interpolate(min(eixo.length, s + 5))
            ang = abs(math.degrees((math.atan2(q1.y - q0.y, q1.x - q0.x) - rumo + math.pi / 2) % math.pi - math.pi / 2))
            if ang > OSM_ANGULO:
                continue
            caminho = sh.shortest_line(amostras[1], eixo)  # do meio do lado até o eixo, sem cortar lote (nem o próprio)
            if g.intersection(caminho).length > 0.5 or any(j != indice and lote(j).intersection(caminho).length > 0.5
                                                           for j in tree.query(caminho, predicate="intersects")):
                continue
            if melhor is None or d < melhor[0]:
                melhor = (d, ang, via)
        if melhor:
            d, ang, via = melhor
            frentes.append({"aresta": ks[0], "arestas": ks, "pontos": [list(pts[0]), list(pts[-1])],
                            "comprimento_m": round(corda, 3), "regra": "rua_osm",
                            "via_osm": {"id": via["id"], "nome": via["nome"], "classe": via["highway"], "data_osm": osm["data_osm"]},
                            "distancia_eixo_osm_m": round(d, 3), "angulo_via_graus": round(ang, 1)})
    frentes.sort(key=lambda f: (f["distancia_eixo_osm_m"], -f["comprimento_m"], f["aresta"]))  # principal: a mais perto
    return frentes


FRENTE_ESTREITA_M = 5  # testada mínima da Lei 6.766/79, art. 4º, II (T27); abaixo disso nem lote estreito
LARGURA_FRACAO = 0.5  # trava da frente estreita: o lado na rua tem >= metade da largura média do lote (corredor de fundo não passa)
PECA_MIN_M = 2  # pedaço de lado que entra na soma da frente quebrada
JUNTAR_ANG = 30  # graus entre os pedaços e o primeiro do grupo: esquina (~90) e lote passante (~180) não somam
JUNTAR_VAO_M = 5  # buraco entre um pedaço e o seguinte (recorte, quina) acima disso: não é a mesma frente
JUNTAR_FOLGA_M = 1  # T28: a reta do 1º ao último pedaço (o que o motor lê como testada) passa a soma em até isso


def largura_media(g, pontos):
    """Área do lote dividida pela profundidade medida na perpendicular à frente (extensão do polígono nessa direção)."""
    a, b = np.array(pontos[0]), np.array(pontos[1])
    u = (b - a) / np.linalg.norm(b - a)
    proj = (np.array(g.exterior.coords) - a) @ np.array([-u[1], u[0]])
    return g.area / (proj.max() - proj.min())


def frentes_curtas(g, indice, geos, tree, rua, osm):
    """T27, só quando nenhum lado de 8 m passou: pedaços de lado (>= PECA_MIN_M) que passam na regra do asfalto (6 m, ou
    12 m sem lote no caminho) ou na do OSM. (B) Pedaços seguidos da mesma via, no mesmo rumo e sem buraco grande entre eles
    somam numa frente só se chegam a 8 m. (A) Sobrando de FRENTE_ESTREITA_M a 8 m, vale como frente estreita se tiver pelo
    menos LARGURA_FRACAO da largura média do lote."""
    coords = list(g.exterior.coords)
    n, grupos_lado = len(coords) - 1, cadeias(coords)
    if not grupos_lado:
        return []
    pecas = frentes_ampliadas(g, indice, geos, tree, rua, minimo=PECA_MIN_M) if not rua.is_empty else []
    usadas = {f["aresta"] for f in pecas}
    pecas += [f for f in frentes_osm(g, indice, geos, tree, osm, minimo=PECA_MIN_M) if f["aresta"] not in usadas] if osm else []
    inicio = grupos_lado[0][0][0]
    pecas.sort(key=lambda f: (f["aresta"] - inicio) % n)  # na ordem do contorno

    def rumo(f):
        return math.atan2(f["pontos"][1][1] - f["pontos"][0][1], f["pontos"][1][0] - f["pontos"][0][0])

    def junta(f, h, primeira):  # h vem logo depois de f no contorno
        mesma = ("via_osm" in f) == ("via_osm" in h) and (
            "via_osm" not in f or f["via_osm"]["id"] == h["via_osm"]["id"] or (f["via_osm"]["nome"] and f["via_osm"]["nome"] == h["via_osm"]["nome"]))
        giro = abs(math.degrees((rumo(h) - rumo(primeira) + math.pi) % (2 * math.pi) - math.pi))
        return mesma and giro <= JUNTAR_ANG and math.dist(f["pontos"][1], h["pontos"][0]) <= JUNTAR_VAO_M

    def cabe(gr):  # a reta não pode inflar a testada: vão grande ou serrilhado fazem a reta passar muito a soma
        return math.dist(gr[0]["pontos"][0], gr[-1]["pontos"][1]) <= sum(f["comprimento_m"] for f in gr) + JUNTAR_FOLGA_M
    grupos = []
    for f in pecas:
        if grupos and junta(grupos[-1][-1], f, grupos[-1][0]) and cabe(grupos[-1] + [f]):
            grupos[-1].append(f)
        else:
            grupos.append([f])
    if len(grupos) > 1 and junta(grupos[-1][-1], grupos[0][0], grupos[-1][0]) and cabe(grupos[-1] + grupos[0]):  # a frente pode cruzar a quina do começo
        grupos[0] = grupos.pop() + grupos[0]
    frentes = []
    for gr in grupos:
        soma = sum(f["comprimento_m"] for f in gr)
        f = dict(gr[0], pontos=[gr[0]["pontos"][0], gr[-1]["pontos"][1]], comprimento_m=round(soma, 3))
        if len(gr) > 1:  # do começo do primeiro pedaço ao fim do último, com o recorte no meio
            ini, fim = gr[0]["arestas"][0], gr[-1]["arestas"][-1]
            f["arestas"] = [(ini + k) % n for k in range((fim - ini) % n + 1)]
        for chave in ("distancia_max_asfalto_m", "distancia_eixo_osm_m", "angulo_via_graus"):
            if chave in f:
                f[chave] = max(h[chave] for h in gr)
        f["pedacos_m"] = [h["comprimento_m"] for h in gr]
        if len(gr) > 1 and soma >= 8:
            f["frente_curta"] = "juntada"
        elif soma >= FRENTE_ESTREITA_M:
            f["largura_media_m"] = round(largura_media(g, f["pontos"]), 3)
            if soma < LARGURA_FRACAO * f["largura_media_m"]:
                continue
            f["frente_curta"] = "estreita"
        else:
            continue
        frentes.append(f)
    frentes.sort(key=lambda f: (-f["comprimento_m"], f["aresta"]))
    return frentes


def avaliar(g, indice, geos, tree, malha, tree_ruas, ampliar=False, osm=None):
    vizinhos = tree.query(g, predicate="intersects")
    vizinhos = vizinhos[vizinhos != indice]
    inter = sh.area(sh.intersection(g, geos[vizinhos]))
    if np.any(inter > 0.1):
        return None
    perto = tree_ruas.query(g.buffer(12), predicate="intersects")
    rua = sh.union_all(malha[perto])
    invasao = g.intersection(rua).area
    if (rua.is_empty and not ampliar) or (not rua.is_empty and invasao / g.area > 0.02):
        return None
    frentes = []
    coords = list(g.exterior.coords)
    for k, (a, b) in enumerate(zip(coords, coords[1:])):
        lado = LineString([a, b])
        if lado.length < 8:
            continue
        distancias = [lado.interpolate(t, normalized=True).distance(rua) for t in (0.15, 0.5, 0.85)]
        if not rua.is_empty and max(distancias) <= 6:
            frentes.append({"aresta": k, "pontos": [list(a), list(b)], "comprimento_m": round(lado.length, 3),
                            "distancia_max_asfalto_m": round(max(distancias), 3)})
    if not frentes and ampliar and not rua.is_empty:
        frentes = frentes_ampliadas(g, indice, geos, tree, rua)
    if not frentes and ampliar:
        frentes = frentes_borda(g, indice, geos, tree, tree_ruas)
        if not frentes and osm is not None:
            osm = osm() if callable(osm) else osm  # carrega o OSM só se precisar
            frentes = frentes_osm(g, indice, geos, tree, osm)
        asfalto = round(float(tree_ruas.query_nearest(g, return_distance=True)[1][0]), 3)
        for f in frentes:  # o motor lê este campo em toda frente com `regra`
            f["distancia_max_asfalto_m"] = asfalto
        if not frentes:  # pedaço do asfalto guarda a distância dele; o do OSM leva a do asfalto mais perto
            frentes = frentes_curtas(g, indice, geos, tree, rua, osm)
            for f in frentes:
                f.setdefault("distancia_max_asfalto_m", asfalto)
    if not frentes:
        return None
    esquina = False
    for i, f in enumerate(frentes):
        for h in frentes[i + 1:]:
            u = np.subtract(f["pontos"][1], f["pontos"][0])
            v = np.subtract(h["pontos"][1], h["pontos"][0])
            ang = math.degrees(math.acos(np.clip(np.dot(u, v) / np.linalg.norm(u) / np.linalg.norm(v), -1, 1)))
            juntas = any(math.dist(a, b) < 2 for a in f["pontos"] for b in h["pontos"])
            if juntas and 45 <= ang <= 135:
                esquina = True
    if "regra" not in frentes[0]:
        frentes.sort(key=lambda f: (-f["comprimento_m"], f["aresta"]))
    return {"frentes": frentes, "esquina_indicada_pela_malha": esquina,
            "sobreposicao_asfalto_m2": round(invasao, 3), "maior_sobreposicao_vizinho_m2": round(float(max(inter, default=0)), 6)}


def checar(lotes):
    assert len(lotes) in (5, 7) and len({l["id"] for l in lotes}) == len(lotes)
    originais = {"SC-completo-30516", "SC-completo-37607", "SC-completo-22426", "SC-completo-22421", "SC-completo-25297"}
    assert originais <= {l["id"] for l in lotes}
    assert sum(l["categoria"] == "grande" for l in lotes) == 2
    assert sum(l["categoria"] == "medio" for l in lotes) == 2
    assert sum(l["categoria"] == "esquina" for l in lotes) == 1
    origem = ler(BASES[1])["features"]
    for l in lotes:
        g = Polygon(l["poligono_utm"])
        assert l["fonte"]["arquivo"] == BASES[1]
        if "indices_feicoes_zero_based" in l["fonte"]:
            indices = l["fonte"]["indices_feicoes_zero_based"]
            assert len(set(indices)) == len(indices) > 1
            partes = [origem[i] for i in indices]
            assert len({p["properties"]["quadra"] for p in partes}) == 1
        else:
            partes = [origem[l["fonte"]["indice_feicao_zero_based"]]]
        geometrias = [sh.transform(shape(p["geometry"]), UTM.transform, interleaved=False) for p in partes]
        assert all(p.is_valid for p in geometrias)
        assert all(a.intersection(b).area <= 0.1 for i, a in enumerate(geometrias) for b in geometrias[i + 1:])
        esperado = sh.union_all(geometrias)
        assert esperado.geom_type == "Polygon" and esperado.is_valid
        assert g.hausdorff_distance(esperado) < 0.000002
        assert g.symmetric_difference(esperado).area < 0.02
        assert g.is_valid and not g.interiors and abs(g.area - l["area_m2"]) < 0.02
        assert LineString(l["frente"]).difference(g.boundary).length < 0.001
        assert l["crs"] == "EPSG:31983"
        if l["zona_id"] is not None:
            assert l["zona_id"] in {z["id"] for z in ler("viabilidade/lei/zonas.json")}
            assert l["zona_origem"] == "anotada_a_mao" and l["zona_conferida"] is False
            assert "zona_anotada_a_mao" not in l
        assert isinstance(l.get("areas_especiais", []), list)
        for especial in l.get("areas_especiais", []):
            assert especial["tipo"] and especial["fonte"]
            if especial.get("altura_max_m") is not None:
                assert math.isfinite(especial["altura_max_m"]) and especial["altura_max_m"] > 0
        if l["relevo"] is not None:
            r = l["relevo"]
            assert r["fonte"] and r["resolucao_m"] > 0
            assert all(math.isfinite(r[k]) for k in ("cota_min_m", "cota_max_m", "declividade_pct"))
            assert r["cota_min_m"] <= r["cota_max_m"] and r["declividade_pct"] >= 0
        assert l["qualidade"]["maior_sobreposicao_vizinho_m2"] <= 0.1
        if l["categoria"] == "grande":
            assert g.area > 1500
        elif l["categoria"] == "medio":
            assert 600 <= g.area <= 1500
        elif l["categoria"] == "esquina":
            assert l["qualidade"]["esquina_indicada_pela_malha"]
        else:
            assert l["categoria"] in ("eixo", "z2") and 1200 <= g.area <= 3000
            assert l["zona_id"] == {"eixo": "SC-EIXO", "z2": "SC-Z2"}[l["categoria"]]
        for x, y in l["poligono_utm"]:
            assert math.dist((x, y), UTM.transform(*GEO.transform(x, y))) < 0.001
    gs = [Polygon(l["poligono_utm"]) for l in lotes]
    assert all(a.intersection(b).area < 0.1 for i, a in enumerate(gs) for b in gs[i + 1:])
    if len(lotes) == 7:
        assert sum(l["categoria"] == "eixo" for l in lotes) == sum(l["categoria"] == "z2" for l in lotes) == 1


def main():
    if (OUT / "lotes-piloto.json").exists():
        raise FileExistsError("Pilotos já existem; use --testar. A geração não sobrescreve anotações e relevo.")
    relatorio = {"crs_medicoes": "EPSG:31983", "bases": [], "conferido_em_campo": False}
    for nome in BASES:
        features, geos, qualidade = auditoria(nome)
        relatorio["bases"].append(qualidade)
    malha, ntris = ruas()
    relatorio["ruas"] = {"arquivo": "sao-carlos/dados/street_tris.json", "triangulos": ntris,
                         "validos_nao_degenerados": len(malha), "arredondamento_coordenadas_m": 1}
    tree, tree_ruas = sh.STRtree(geos), sh.STRtree(malha)
    areas = sh.area(geos)
    dist = sh.distance(sh.centroid(geos), CENTRO)
    lotes = []
    usados = set()
    for categoria, quantidade in (("grande", 2), ("medio", 2), ("esquina", 1)):
        indices = np.flatnonzero((areas > 1500) if categoria == "grande" else ((areas >= (600 if categoria == "medio" else 300)) & (areas <= 1500) & (dist <= 2500)))
        # shortcut: proximidade ao centro é proxy espacial; verticalização exige inventário verificado.
        indices = sorted(indices, key=lambda k: (features[k]["properties"].get("fonte") != "planta", dist[k], int(k)))
        escolhidos = 0
        for k in indices:
            g = geos[k]
            if k in usados or not g.is_valid or g.geom_type != "Polygon" or g.interiors:
                continue
            regularidade = g.area / g.minimum_rotated_rectangle.area
            if regularidade < 0.7:
                continue
            q = avaliar(g, k, geos, tree, malha, tree_ruas)
            if q is None or (categoria == "esquina" and not q["esquina_indicada_pela_malha"]):
                continue
            p = features[k]["properties"]
            q["ocupacao_retangulo_minimo"] = round(regularidade, 5)
            coords = [[round(x, 6), round(y, 6)] for x, y in g.exterior.coords]
            frente = [coords[q["frentes"][0]["aresta"]], coords[q["frentes"][0]["aresta"] + 1]]
            lotes.append({"id": f"SC-completo-{k}", "lid": p.get("lid"), "poligono_utm": coords,
                          "frente": frente, "area_m2": round(Polygon(coords).area, 3),
                          "zona_id": None, "relevo": None, "areas_especiais": [], "crs": "EPSG:31983", "categoria": categoria,
                          "centroide_lonlat": [round(v, 8) for v in GEO.transform(g.centroid.x, g.centroid.y)],
                          "distancia_centro_referencia_m": round(float(dist[k]), 1),
                          "fonte": {"arquivo": BASES[1], "indice_feicao_zero_based": int(k), "propriedades": p},
                          "qualidade": q, "conferido": False,
                          "observacoes": "Geometria de ensaio derivada da maquete; não comprova lote cadastral, disponibilidade ou aptidão legal. Frente e eventual esquina inferidas da malha de asfalto, sem vistoria ou nome de rua confirmado. LID ausente na origem; ID local usa índice da feição. Relevo e zona pendentes. " + ("Há mais de uma frente candidata; o motor deve considerar as demais testadas antes de validar recuos." if len(q["frentes"]) > 1 else "")})
            usados.add(k)
            escolhidos += 1
            print("SELECIONADO", categoria, int(k), round(g.area, 2), p.get("loteamento"), round(float(dist[k])), flush=True)
            if escolhidos == quantidade:
                break
        if escolhidos != quantidade:
            raise ValueError(f"Faltam candidatos aprovados na categoria {categoria}: {escolhidos}/{quantidade}")
    checar(lotes)
    relatorio["selecionados"] = [l["id"] for l in lotes]
    relatorio["self_check"] = "5 IDs únicos; categorias; área; validade; frente na borda; projeção ida/volta; esquina; sobreposição de vizinhos e entre pilotos."
    gravar(OUT / "dados/qualidade-lotes.json", relatorio)
    gravar(OUT / "lotes-piloto.json", lotes)
    print("OK: auditoria e cinco lotes escritos; self-check passou.", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--testar", action="store_true")
    if parser.parse_args().testar:
        checar(ler("viabilidade/terreno/lotes-piloto.json"))
        print("OK: lotes existentes verificados, sem regravar.")
    else:
        main()

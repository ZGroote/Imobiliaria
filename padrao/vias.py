# -*- coding: utf-8 -*-
"""A malha viaria e a FITA da rua, tiradas do city.json - uma implementacao so.

A regra do projeto: **a rua e a fita que o renderizador desenha**, largura
`ROAD_W[tipo]/2 * mul_fita` a partir do eixo. Quadra, lote, muro e casa param na borda
externa dela. Quem precisar dessa geometria (recorte de quadra, QA, diagnostico) chama
daqui em vez de reescrever o buffer - a versao anterior tinha a conta escrita em quatro
arquivos, com tres valores diferentes, e foi exatamente ai que o muro saiu do lugar.
"""
import math
from shapely.geometry import LineString


def eixos(city, cid, so_dirigivel=False, min_seg=0.2):
    """Decodifica `city['r']` -> lista de (tipo, [(x,z), ...]) em METROS do mapa."""
    r = city.get("r", [])
    Q = city.get("q", 10)
    out = []
    i = 0; n = len(r)
    while i + 2 < n:
        k = r[i]; i += 2                      # r[i+1] = indice do nome
        npt = r[i]; i += 1
        lx = lz = 0.0; pts = []
        for _ in range(npt):
            lx += r[i]; lz += r[i + 1]; i += 2
            pts.append((lx / Q, lz / Q))
        tipo = cid.tipo_da_via(k)
        if len(pts) < 2: continue
        if so_dirigivel and tipo not in cid.dirigivel: continue
        out.append((tipo, pts))
    return out


def fita(city, cid, mul=None, so_dirigivel=False, folga=0.0, juntar=True):
    """A fita da rua como POLIGONOS.

    `juntar=False` devolve um poligono por TRECHO (centenas de milhares de pecas
    pequenas): e o que serve pra consulta espacial - unir a cidade inteira da 13
    multipoligonos gigantes e cada `intersection` passa a custar segundos.
    `folga` negativa erode a fita: use -0.25 pra medir 'muro EM CIMA da rua' sem contar
    o muro que apenas ENCOSTA nela (depois do conserto a divisa cai sobre a linha).
    """
    pedacos = []
    for tipo, pts in eixos(city, cid, so_dirigivel=so_dirigivel):
        h = cid.meia_largura(tipo, mul) + folga
        if h <= 0: continue
        if juntar:
            try: pedacos.append(LineString(pts).buffer(h, cap_style=2, join_style=2))
            except Exception: pass
        else:
            for j in range(len(pts) - 1):
                if math.dist(pts[j], pts[j + 1]) < 0.2: continue
                try:
                    pedacos.append(LineString([pts[j], pts[j + 1]]).buffer(h, cap_style=2, join_style=2))
                except Exception: pass
    if not juntar: return pedacos
    from shapely.ops import unary_union
    return unary_union(pedacos)


def fita_utm(city, cid, mul=None, so_dirigivel=True, folga=0.0):
    """A mesma fita em UTM (uma peca por via), que e onde o pipeline de lotes trabalha.

    Devolve LISTA - quem quiser um poligono so chama `unary_union` no resultado."""
    out = []
    for tipo, pts in eixos(city, cid, so_dirigivel=so_dirigivel):
        h = cid.meia_largura(tipo, mul) + folga
        if h <= 0: continue
        u = [cid.mapa_para_utm(x, z) for x, z in pts]
        try: out.append(LineString(u).buffer(h, cap_style=2, join_style=2))
        except Exception: pass
    return out


def tabela_do_html(caminho_html):
    """Le `HW` e `ROAD_W` de dentro do renderizador (JS).

    Existe pra UMA coisa: provar que a tabela do navegador e a do
    `cidades/<slug>.json` sao a mesma. Enquanto forem duas copias, elas divergem.
    """
    import io, json, re
    s = io.open(caminho_html, encoding="utf-8", errors="replace").read()
    mh = re.search(r"const\s+HW\s*=\s*\[(.*?)\]\s*;", s, re.S)
    mr = re.search(r"const\s+ROAD_W\s*=\s*\{(.*?)\}\s*;", s, re.S)
    if not mh or not mr: return None, None
    hw = re.findall(r'"([^"]+)"', mh.group(1))
    rw = {}
    for k, v in re.findall(r'([A-Za-z_]+)\s*:\s*([0-9.]+)', mr.group(1)):
        rw[k] = float(v)
    return hw, rw

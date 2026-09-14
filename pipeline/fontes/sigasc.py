# -*- coding: utf-8 -*-
"""Extrair vetor do MapServer da prefeitura (SigaSC) -- a UNICA implementacao.

O SigaSC roda MapServer 5.0.3 sobre PostGIS com **WFS e WMS trancados** (WFS sem
DUMP TRUE, WMS sem wms_srs -> InvalidSRS). Nao da pra pedir vetor por OGC. O que
funciona e o modo nativo CGI, que devolve PNG transparente:

    cgi-bin/mapserv?map=<PATH>&mode=map&layers=<L>&mapext=E0+N0+E1+N1&mapsize=W+H

Entao TODA fonte da prefeitura sai do mesmo caminho de quatro fases, e e por isso
que este arquivo existe em vez de um script por layer (eram sete, com a mesma conta
escrita sete vezes):

    sonda(...)    varre a cidade em celulas grossas e diz onde tem tinta.
                  Sem isso, renderizar a cidade inteira em alta e horas de download.
    tiles(...)    renderiza so as celulas com tinta, em 2048px, e guarda manifest.
    mosaico(...)  aplica a mascara de cor daquele layer, reduz por maxpool e costura
                  tudo num array unico no grid nativo (UTM).
    faces(...)    layer DESENHADO A LINHA (quadra, parcelamento): a feicao e o vao
                  ENTRE as linhas. Dilata a linha, rotula o complemento, joga fora o
                  fundo, e cresce os rotulos de volta na faixa da divisa.
    pontos(...)   layer de BOLINHA (enderecamento): rotula o blob e pega o centroide.

**Pegadinha da projecao:** o mapfile rotula `zone=21`, mas o dado esta em UTM 23S
(easting ~200k, northing ~7554k). Reprojetar como EPSG:29193 (SAD69/UTM23S) encaixa.
O CRS vem do JSON da cidade (`crs.utm`), nao daqui.

**Por que a dilatacao e 4px e os rotulos crescem de volta:** com 2px, poligono grande
e alongado vazava por gaps de ~4px nas emendas de tile e caia no fundo -- foi assim
que o Santa Angelina sumiu. Dilatar fecha o gap; crescer de volta (distance_transform)
devolve a area que a dilatacao comeu.

**O layer pode simplesmente NAO TER dado numa regiao** -- e nao ha aviso nenhum, o
PNG volta transparente igual a "fora da escala". Antes de concluir que a raspagem
ficou curta, rode `sonda` no extent em duvida e compare com um bairro que voce sabe
que existe. Foi o que provou que o `quadras_pol` nao cobre o Jardim Araucaria.
"""
import io, json, os, time, urllib.request
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

BASE = "http://geo.saocarlos.sp.gov.br/cgi-bin/mapserv"
MAPFILES = {
    "gerais":     "/var/www/sp.gov.br/saocarlos/geo/public/data/saocarlos_mapa_informacoes_gerais.map",
    "legislacao": "/var/www/sp.gov.br/saocarlos/geo/public/data/saocarlos_mapa_legislacao.map",
    "censo":      "/var/www/sp.gov.br/saocarlos/geo/public/data/saocarlos_mapa_ibge_censo_2010.map",
}
UA = {"User-Agent": "mapa3d/1.0 (pipeline de cidade)"}


def render(mapa, layer, e0, n0, e1, n1, w, h, tentativas=3, timeout=150):
    """Um PNG do MapServer. Levanta se o servidor devolver outra coisa."""
    u = ("%s?map=%s&mode=map&layers=%s&mapext=%d+%d+%d+%d&mapsize=%d+%d"
         % (BASE, MAPFILES[mapa], layer, e0, n0, e1, n1, w, h))
    erro = None
    for _ in range(tentativas):
        try:
            d = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=timeout).read()
            if d[:4] == b"\x89PNG":
                return Image.open(io.BytesIO(d)).convert("RGBA")
            erro = RuntimeError("resposta nao-PNG: %r" % d[:160])
        except Exception as ex:
            erro = ex
        time.sleep(3)
    raise erro


def sonda(mapa, layer, e0, n0, e1, n1, cell=3000, px=300, minimo=50):
    """Celulas de `cell` metros que tem tinta. Imprime o mapa em ASCII enquanto varre.

    Sondar antes vale a pena e muda de layer pra layer: em Sao Carlos o `quadras_pol`
    acendeu 22 de 132 celulas. Renderizar as 132 em 2048px seria 6x o download."""
    cols = list(range(e0, e1, cell)); rows = list(range(n0, n1, cell)); acesas = []
    for r in reversed(rows):
        linha = ""
        for c in cols:
            try:
                a = np.array(render(mapa, layer, c, r, c + cell, r + cell, px, px,
                                    tentativas=1, timeout=60))
                k = int((a[..., 3] > 10).sum())
            except Exception:
                k = -1
            linha += "#" if k > minimo else ("." if k >= 0 else "x")
            if k > minimo: acesas.append((c, r))
        print("N%d: %s" % (r, linha))
    print("celulas com tinta: %d de %d" % (len(acesas), len(cols) * len(rows)))
    return acesas


def tiles(mapa, layer, acesas, destino, cell=3000, px=2048):
    """Renderiza as celulas acesas. Retomavel: pula PNG que ja existe."""
    os.makedirs(destino, exist_ok=True); man = []
    for i, (e0, n0) in enumerate(acesas):
        fn = os.path.join(destino, "t_%d_%d.png" % (e0, n0))
        if not (os.path.exists(fn) and os.path.getsize(fn) > 0):
            render(mapa, layer, e0, n0, e0 + cell, n0 + cell, px, px).save(fn)
            print("  %d/%d %s (%d KB)" % (i + 1, len(acesas), os.path.basename(fn),
                                          os.path.getsize(fn) // 1024))
        man.append({"file": fn, "native": [e0, n0, e0 + cell, n0 + cell]})
    json.dump(man, open(os.path.join(destino, "manifest.json"), "w"))
    return man


# ---- mascaras de cor, uma por layer -----------------------------------------
def _canais(a):
    return (a[..., 0].astype(int), a[..., 1].astype(int),
            a[..., 2].astype(int), a[..., 3])


def mascara_linha_cinza(a):
    """quadras_pol: linha cinza media, r=g=b."""
    r, g, b, al = _canais(a)
    return ((al > 10) & (abs(r - g) < 25) & (abs(g - b) < 25) & (abs(r - b) < 25)
            & (r < 210) & (r > 60))


def mascara_linha_vermelha(a):
    """parcelamentos: divisa em vermelho 237,28,36 (o rotulo laranja NAO entra)."""
    r, g, b, al = _canais(a)
    return ((al > 10) & (r > 170) & (g < 90) & (b < 95)
            & ((r - g) > 120) & ((r - b) > 110))


def mascara_ponto_azul(a):
    """enderecamento: bolinha azul 0,0,255, uma por lote."""
    r, g, b, al = _canais(a)
    return (al > 10) & (b > 150) & (r < 100) & (g < 100)


def mosaico(man, mascara, cell=3000, px=2048, ds=2):
    """Costura os tiles num array unico. `ds` reduz por maxpool (2 -> ~2,93 m/px).

    maxpool e nao media: a linha tem 1-2 px de largura, media a apaga."""
    tp = px // ds
    Es = [m["native"][0] for m in man]; Ns = [m["native"][1] for m in man]
    Emin = min(Es); Emax = max(Es) + cell; Nmin = min(Ns); Nmax = max(Ns) + cell
    cols = (Emax - Emin) // cell; rows = (Nmax - Nmin) // cell
    grid = {"Emin": Emin, "Nmax": Nmax, "res": cell / float(tp),
            "W": cols * tp, "H": rows * tp}
    out = np.zeros((grid["H"], grid["W"]), np.uint8)
    for mm in man:
        e0, n0, e1, n1 = mm["native"]
        a = np.array(Image.open(mm["file"]).convert("RGBA"))
        m = mascara(a).astype(np.uint8)
        H, W = m.shape; m = m[:H // ds * ds, :W // ds * ds]
        m = m.reshape(H // ds, ds, W // ds, ds).max(axis=(1, 3))
        cx = (e0 - Emin) // cell; cy = (Nmax - n1) // cell
        alvo = out[cy * tp:(cy + 1) * tp, cx * tp:(cx + 1) * tp]
        out[cy * tp:(cy + 1) * tp, cx * tp:(cx + 1) * tp] = np.maximum(alvo, m[:tp, :tp])
    print("  mosaico %dx%d px | %.2f m/px | %d px de tinta"
          % (grid["W"], grid["H"], grid["res"], int(out.sum())))
    return out, grid


def faces(mask, grid, dilata=4, area_min_m2=2600):
    """Layer desenhado a LINHA -> a feicao e o vao entre as linhas.

    Devolve um array de rotulos (int32) pronto pro rasterio.features.shapes."""
    st = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]])
    bnd = ndi.binary_dilation(mask.astype(bool), iterations=dilata)
    lab, n = ndi.label(~bnd, structure=st)
    areas = ndi.sum(np.ones_like(lab), lab, index=np.arange(1, n + 1))
    fundo = int(np.argmax(areas)) + 1                 # a maior regiao e o lado de fora
    minpx = area_min_m2 / (grid["res"] ** 2)
    manter = [i + 1 for i in range(n) if i + 1 != fundo and areas[i] >= minpx]
    guardado = np.isin(lab, manter)
    labimg = np.where(guardado, lab, 0).astype(np.int32)
    # cresce os rotulos de volta na faixa que a dilatacao comeu -- SEM invadir o fundo
    dist, idx = ndi.distance_transform_edt(labimg == 0, return_indices=True)
    cresc = labimg[tuple(idx)]
    regioes = np.where(guardado, lab,
                       np.where((lab != fundo) & (dist <= dilata + 2), cresc, 0)).astype(np.int32)
    print("  faces: %d (area minima %.0f m2)" % (len(manter), area_min_m2))
    return regioes


def poligonos(regioes, grid, cid, area_min_m2, simplify_m, buraco_min_m2=0):
    """Rotulos -> lista de (id, poligono lon/lat). Junta pedacos do mesmo id."""
    import rasterio.features as rf
    from affine import Affine
    from shapely.geometry import shape, Polygon
    from shapely.ops import unary_union, transform as sht
    tr = Affine(grid["res"], 0, grid["Emin"], 0, -grid["res"], grid["Nmax"])
    partes = {}
    for geom, val in rf.shapes(regioes, mask=regioes > 0, transform=tr, connectivity=4):
        if not val: continue
        p = shape(geom)
        if p.area < area_min_m2: continue
        partes.setdefault(int(val), []).append(p)
    saida = []
    for pid, ps in partes.items():
        g = ps[0] if len(ps) == 1 else unary_union(ps)
        g = g.simplify(simplify_m, preserve_topology=True)
        if g.is_empty: continue
        if buraco_min_m2 and g.geom_type == "Polygon" and g.interiors:
            g = Polygon(g.exterior, [r for r in g.interiors if Polygon(r).area > buraco_min_m2])
        saida.append((pid, sht(lambda x, y, z=None: cid.para_geo(x, y), g)))
    return saida


def pontos(man, mascara, px=2048, blob_min_px=4, grade_m=3):
    """Layer de BOLINHA -> centroide de cada blob, deduplicado numa grade nativa.

    Le tile a tile (nao pelo mosaico): o ponto e pequeno, o maxpool do mosaico o
    engorda e cola vizinhos. A dedup por grade resolve a sobreposicao de tiles.
    Devolve coordenadas em UTM nativo."""
    achados = set()
    for k, mm in enumerate(man):
        e0, n0, e1, n1 = mm["native"]
        a = np.array(Image.open(mm["file"]).convert("RGBA"))
        m = mascara(a)
        lab, n = ndi.label(m)
        if not n: continue
        tam = ndi.sum(np.ones_like(lab), lab, index=np.arange(1, n + 1))
        cen = ndi.center_of_mass(m, lab, index=np.arange(1, n + 1))
        lado = e1 - e0
        for i, (cy, cx) in enumerate(cen):
            if tam[i] < blob_min_px: continue
            E = e0 + (cx / px) * lado; N = n1 - (cy / px) * lado
            achados.add((round(E / grade_m) * grade_m, round(N / grade_m) * grade_m))
        if (k + 1) % 10 == 0:
            print("  %d/%d tiles | %d pontos" % (k + 1, len(man), len(achados)))
    print("  pontos unicos: %d" % len(achados))
    return sorted(achados)


def grava_geojson(caminho, feats):
    json.dump({"type": "FeatureCollection", "features": feats},
              open(caminho, "w", encoding="utf-8"), ensure_ascii=False)
    print("-> %s (%d feicoes, %.1f MB)"
          % (caminho, len(feats), os.path.getsize(caminho) / 1e6))

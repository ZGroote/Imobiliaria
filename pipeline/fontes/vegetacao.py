# -*- coding: utf-8 -*-
"""Etapa 0.10: densidade de vegetacao por NDVI do Sentinel-2.

    python pipeline/fontes/vegetacao.py            # sao-carlos
    CIDADE=sorocaba python pipeline/fontes/vegetacao.py

**Por que nao o Google Maps.** Extrair vegetacao da imagem do Maps e contra os termos
de uso deles. E, mais importante, seria pior: o Maps da uma FOTO, e o que falta aqui e
um NUMERO por lugar. O Sentinel-2 da isso de graca, a 10 m, com revisita de 5 dias, e
o NDVI e a medida canonica de vigor vegetal -- ((NIR - vermelho) / (NIR + vermelho)),
alto onde ha folha, baixo onde ha asfalto, telhado ou solo exposto.

**O que ele conserta.** O mapa plantava arvore em cima do `leisure=park` / `landuse=
forest` do OSM, que e binario (tem ou nao tem) e envelhece. Bosque fechado e canteiro
pelado recebiam a MESMA densidade. Com o NDVI a densidade vira continua e vem de uma
imagem de duas semanas atras.

Sai uma grade N x N alinhada com o SISTEMA DE COORDENADAS DO MAPA (nao com o UTM da
cena): a convergencia de meridiano entre os dois chega a ~80 m nos cantos de uma caixa
de 19 km, o que sao duas celulas inteiras. Cada celula e um byte, e o arquivo guarda
base64 -- 512 x 512 em JSON de numeros seriam 1,3 MB.
"""
import base64, io, json, math, os, sys, urllib.request

import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", ".."))
sys.path.insert(0, RAIZ)
from padrao.cidade import carrega

CID = carrega(os.environ.get("CIDADE", "sao-carlos"))
STAC = "https://earth-search.aws.element84.com/v1/search"
NUVEM_MAX = 12.0
SECA = (6, 7, 8, 9, 10)   # sudeste: e quando o capim seca e so a arvore fica verde
MESES = 14


def acha_cena():
    """A cena menos nublada que COBRE O CENTRO da cidade, nos ultimos meses.

    Filtrar so pelo bbox nao basta: o bbox de uma cidade encosta em varios quadrantes
    MGRS, e a cena vizinha aparece na busca cobrindo so uma tira do canto."""
    import datetime
    hoje = datetime.date.today()
    ini = (hoje - datetime.timedelta(days=30 * MESES)).isoformat()
    corpo = {"collections": ["sentinel-2-l2a"],
             "intersects": {"type": "Point", "coordinates": [CID.clon, CID.clat]},
             "datetime": "%sT00:00:00Z/%sT00:00:00Z" % (ini, hoje.isoformat()),
             "query": {"eo:cloud_cover": {"lt": NUVEM_MAX}},
             "limit": 60}
    req = urllib.request.Request(STAC, data=json.dumps(corpo).encode(),
                                 headers={"Content-Type": "application/json"})
    d = json.load(urllib.request.urlopen(req, timeout=90))
    fs = d.get("features", [])
    if not fs:
        raise SystemExit("nenhuma cena Sentinel-2 com menos de %.0f%% de nuvem" % NUVEM_MAX)
    # A ESTACAO importa mais que a nuvem, e isso foi medido: a cena de Rio Preto de
    # 23/04 (fim da chuva, 0% de nuvem) deu NDVI 0,296 sobre TELHADO e 0,326 sobre area
    # verde -- diferenca de 0,030, grade inutil. No fim da seca o capim seca e so a
    # arvore fica verde, que e exatamente o que se quer contar aqui: Sao Carlos, em
    # outubro, deu 0,136 contra 0,266.
    def nota(f):
        m = int(f["properties"]["datetime"][5:7])
        seca = 0 if m in SECA else 40           # pesa mais que qualquer nuvem admitida
        return (seca + f["properties"]["eo:cloud_cover"],
                -int(f["properties"]["datetime"][:10].replace("-", "")))
    fs.sort(key=nota)
    melhor = fs[0]
    m = int(melhor["properties"]["datetime"][5:7])
    print("cenas candidatas: %d | escolhida %s (%s, %.1f%% de nuvem, %s)"
          % (len(fs), melhor["id"], melhor["properties"]["datetime"][:10],
             melhor["properties"]["eo:cloud_cover"],
             "seca" if m in SECA else "FORA DA SECA -- contraste pode ficar baixo"))
    return melhor


def grade_do_mapa(n, half):
    """Centro de cada celula, em coordenada do MAPA (metros, X leste, Z sul)."""
    e = np.linspace(-half, half, n)
    mx, mz = np.meshgrid(e, e)          # mz cresce pro sul, igual ao mapa
    return mx, mz


def main():
    cfg = CID._d.get("vegetacao_grade", {"n": 512, "half_m": 9500})
    N, HALF = int(cfg["n"]), float(cfg["half_m"])
    cena = acha_cena()
    href_red = cena["assets"]["red"]["href"]
    href_nir = cena["assets"]["nir"]["href"]

    import rasterio
    from rasterio.enums import Resampling
    from rasterio.windows import from_bounds
    from pyproj import Transformer

    mx, mz = grade_do_mapa(N, HALF)
    lon = CID.clon + mx / CID.mlon
    lat = CID.clat - mz / CID.mlat

    def le(href):
        with rasterio.open(href) as ds:
            tr = Transformer.from_crs("EPSG:4326", ds.crs, always_xy=True)
            X, Y = tr.transform(lon.ravel(), lat.ravel())
            X = np.asarray(X); Y = np.asarray(Y)
            # uma janela so, decimada: ler pixel a pixel por HTTP seriam 262 mil
            # requisicoes. A janela inteira da cidade a 20 m cabe em poucos MB.
            win = from_bounds(X.min(), Y.min(), X.max(), Y.max(), ds.transform)
            alvo = max(64, int(max(win.width, win.height) / 2))
            a = ds.read(1, window=win, out_shape=(alvo, alvo),
                        resampling=Resampling.average).astype(np.float32)
            wt = ds.window_transform(win)
            sx = (X - wt.c) / wt.a * (alvo / win.width)
            sy = (Y - wt.f) / wt.e * (alvo / win.height)
            ci = np.clip(sx.astype(np.int32), 0, alvo - 1)
            ri = np.clip(sy.astype(np.int32), 0, alvo - 1)
            return a[ri, ci].reshape(N, N)

    print("lendo vermelho (B04)...")
    red = le(href_red)
    print("lendo infravermelho (B08)...")
    nir = le(href_nir)

    ndvi = (nir - red) / np.maximum(nir + red, 1.0)
    ndvi = np.clip(ndvi, -0.2, 0.9)
    b = np.clip((ndvi + 0.2) / 1.1 * 255.0, 0, 255).astype(np.uint8)

    p = CID.caminho("vegetacao")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump({"n": N, "half_m": HALF, "cena": cena["id"],
               "data": cena["properties"]["datetime"][:10],
               "nuvem_pct": cena["properties"]["eo:cloud_cover"],
               "_nota": "byte = (ndvi + 0.2) / 1.1 * 255, linha 0 = norte",
               "ndvi_b64": base64.b64encode(b.tobytes()).decode()},
              io.open(p, "w", encoding="utf-8"), separators=(",", ":"))
    q = np.percentile(ndvi, [5, 25, 50, 75, 95])
    print("-> %s | %dx%d | ndvi p5 %.2f p25 %.2f p50 %.2f p75 %.2f p95 %.2f | %.2f MB"
          % (p, N, N, q[0], q[1], q[2], q[3], q[4], os.path.getsize(p) / 1e6))
    return 0


if __name__ == "__main__":
    sys.exit(main())

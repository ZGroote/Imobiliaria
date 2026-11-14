"""Audita a grade existente, recorta o Copernicus e amostra os lotes-piloto.

python -I viabilidade/terreno/preparar_relevo.py --testar
python -I viabilidade/terreno/preparar_relevo.py --baixar
python -I viabilidade/terreno/preparar_relevo.py
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import site
import sys
import urllib.request
from contextlib import ExitStack

sys.dont_write_bytecode = True
# Dependências GIS já instaladas no computador; -I não inclui o site do usuário.
try:
    import rasterio
    from pyproj import Transformer
except ModuleNotFoundError:
    sys.path.append(site.getusersitepackages())
    import rasterio
    from pyproj import Transformer
import numpy as np
from rasterio.merge import merge
from rasterio.windows import Window, bounds as limites_janela

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent.parent
DADOS = AQUI / "dados"
RASTER = DADOS / "copernicus-glo30-sao-carlos.tif"
META = DADOS / "copernicus-glo30-sao-carlos.json"
CONFIG = RAIZ / "padrao/cidades/sao-carlos.json"
FONTE = "Copernicus DEM GLO-30 / COG público AWS; DSM, alturas EGM2008"
LICENCA = "https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM"
ATRIBUICAO = ("produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and "
              "© Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS "
              "by the European Union and ESA; all rights reserved")
AVISO = ("Relevo: estimativa DSM Copernicus GLO-30 (~30 m), não conferida em campo. "
         "Cotas interpoladas nos vértices e centroide; declividade do DSM no entorno "
         "do centroide, por diferenças centrais de 30 m. Árvores/prédios podem afetar "
         "os valores; não usar para terraplenagem ou regra legal de declividade.")


def ler(caminho):
    return json.loads(caminho.read_text(encoding="utf-8"))


def gravar(caminho, objeto):
    temporario = caminho.with_suffix(caminho.suffix + ".tmp")
    temporario.write_text(json.dumps(objeto, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    temporario.replace(caminho)


def sha(caminho):
    return hashlib.sha256(caminho.read_bytes()).hexdigest()


def auditar_local():
    cfg = ler(CONFIG)
    arquivo = RAIZ / "sao-carlos/relevo_wide.json"
    valores = ler(arquivo)
    n, meia = cfg["relevo_grade"]["n"], cfg["relevo_grade"]["half_m"]
    assert len(valores) == n * n and all(math.isfinite(v) for v in valores)
    relatorio = {
        "arquivo": "sao-carlos/relevo_wide.json", "sha256": sha(arquivo),
        "origem_no_codigo": "pipeline/fontes/relevo.py", "servico": "Open-Elevation",
        "quantidade": len(valores), "colunas": n, "linhas": n,
        "extensao_m": 2 * meia, "passo_m": 2 * meia / (n - 1),
        "centro_lon_lat": [cfg["centro"]["lon"], cfg["centro"]["lat"]],
        "min_relativo_m": min(valores), "max_relativo_m": max(valores),
        "amostra_referencia_indice": ((n - 1) // 2) * n + (n - 1) // 2,
        "tratamento": "Mediana 3x3, subtração da amostra i=39,j=39; ordem por linhas norte-sul.",
        "datum_vertical": None, "cota_absoluta_referencia_m": None,
        "precisao_vertical_local_m": None, "data_aquisicao": None,
        "conferido_em_campo": False,
        "observacoes": "Grade visual relativa, não levantamento topográfico. Passo da grade não é precisão."
    }
    assert valores[relatorio["amostra_referencia_indice"]] == 0
    DADOS.mkdir(exist_ok=True)
    gravar(DADOS / "relevo-local-auditoria.json", relatorio)


def baixar():
    bbox = ler(CONFIG)["bbox"]
    oeste, sul, leste, norte = bbox
    fontes = []
    for lat in range(math.floor(sul), math.floor(norte) + 1):
        for lon in range(math.floor(oeste), math.floor(leste) + 1):
            nome = f"Copernicus_DSM_COG_10_S{abs(lat):02d}_00_W{abs(lon):03d}_00_DEM"
            url = f"https://copernicus-dem-30m.s3.amazonaws.com/{nome}/{nome}.tif"
            with urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=30) as r:
                fontes.append({"url": url, "etag": r.headers.get("ETag"),
                               "last_modified": r.headers.get("Last-Modified"),
                               "tamanho_fonte_bytes": int(r.headers["Content-Length"])})
    # /vsicurl/ lê blocos COG por HTTP Range; não salva tiles de 1 grau completos.
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif",
                      GDAL_HTTP_TIMEOUT="45", GDAL_HTTP_MAX_RETRY="2"), ExitStack() as stack:
        rasters = [stack.enter_context(rasterio.open("/vsicurl/" + item["url"])) for item in fontes]
        assert all(str(r.crs) == "EPSG:4326" for r in rasters)
        for item, src in zip(fontes, rasters):
            item.update(transformacao=list(src.transform)[:6], nodata=src.nodata,
                        resolucao_graus=list(src.res), limites_lon_lat=list(src.bounds))
        # Os COGs têm bordas a meio segundo de arco; preservar a grade evita deslocar cotas.
        matriz, transform = merge(rasters, bounds=alinhar_bbox(bbox, rasters[0].transform), nodata=-9999)
        assert matriz.shape[0] == 1 and np.isfinite(matriz).all() and not (matriz == -9999).any(), (
            f"Recorte inválido: shape={matriz.shape}, NoData={int((matriz == -9999).sum())}, "
            f"não finitos={int((~np.isfinite(matriz)).sum())}")
        perfil = dict(driver="GTiff", height=matriz.shape[1], width=matriz.shape[2],
                      count=1, dtype="float32", crs="EPSG:4326", transform=transform,
                      nodata=-9999, compress="deflate", predictor=3)
        temporario = RASTER.with_suffix(".tmp.tif")
        with rasterio.open(temporario, "w", **perfil) as destino:
            destino.write(matriz.astype("float32"))
            destino.update_tags(fonte=FONTE, datum_vertical="EGM2008",
                                atribuicao=ATRIBUICAO,
                                recorte="bbox urbano do projeto; não limite municipal")
        temporario.replace(RASTER)
    with rasterio.open(RASTER) as src:
        meta = {"fonte": FONTE, "consulta": "2026-11-14", "fontes": fontes,
                "metodo_download": "Janelas de COG via HTTP Range; apenas recorte gravado, sem redução de resolução.",
                "bbox_solicitado_lon_lat": bbox, "bbox_gravado_lon_lat": list(src.bounds),
                "recorte": "Área urbana de trabalho de padrao/cidades/sao-carlos.json; não município inteiro.",
                "crs_horizontal": "EPSG:4326", "datum_vertical": "EGM2008",
                "versao_espelho": "Copernicus DEM 2021 release, conforme registro AWS",
                "transformacao": list(src.transform)[:6], "nodata": src.nodata,
                "resolucao_graus": list(src.res), "resolucao_nominal_m": 30,
                "colunas": src.width, "linhas": src.height,
                "cota_min_recorte_m": float(matriz.min()), "cota_max_recorte_m": float(matriz.max()),
                "sha256": sha(RASTER), "tamanho_bytes": RASTER.stat().st_size,
                "licenca": LICENCA, "atribuicao": ATRIBUICAO,
                "validacao_local": False, "rasterio": rasterio.__version__}
    gravar(META, meta)
    print(f"Recorte gravado: {RASTER.name}, {meta['colunas']}x{meta['linhas']}, {meta['tamanho_bytes']} bytes")


def alinhar_bbox(bbox, transform):
    oeste, sul, leste, norte = bbox
    col0, lin0 = ~transform * (oeste, norte)
    col1, lin1 = ~transform * (leste, sul)
    col0, lin0 = math.floor(col0), math.floor(lin0)
    janela = Window(col0, lin0, math.ceil(col1) - col0, math.ceil(lin1) - lin0)
    return limites_janela(janela, transform)


def bilinear(matriz, coluna, linha):
    i, j = math.floor(coluna), math.floor(linha)
    if not (0 <= i < matriz.shape[1] - 1 and 0 <= j < matriz.shape[0] - 1):
        raise ValueError("Lote ou entorno fora do recorte de relevo")
    janela = matriz[j:j+2, i:i+2]
    if not np.isfinite(janela).all() or (janela == -9999).any():
        raise ValueError("Relevo sem dado válido no ponto")
    dx, dy = coluna - i, linha - j
    return float(janela[0, 0]*(1-dx)*(1-dy) + janela[0, 1]*dx*(1-dy)
                 + janela[1, 0]*(1-dx)*dy + janela[1, 1]*dx*dy)


def resumir(pontos, centro, altura):
    cx, cy = centro
    cotas = [altura(x, y) for x, y in pontos] + [altura(cx, cy)]
    dx = (altura(cx+30, cy) - altura(cx-30, cy)) / 60
    dy = (altura(cx, cy+30) - altura(cx, cy-30)) / 60
    return {"fonte": FONTE, "resolucao_m": 30, "cota_min_m": round(min(cotas), 1),
            "cota_max_m": round(max(cotas), 1), "declividade_pct": round(100*math.hypot(dx, dy), 1)}


def aplicar():
    from shapely.geometry import Polygon
    caminho = AQUI / "lotes-piloto.json"
    lotes = ler(caminho)
    meta = ler(META)
    assert sha(RASTER) == meta["sha256"], "Raster diferente do documentado"
    converter = Transformer.from_crs(31983, 4326, always_xy=True)
    amostras = []
    with rasterio.open(RASTER) as src:
        matriz = src.read(1)
        pixels = set()
        def altura(x, y):
            lon, lat = converter.transform(x, y)
            col, lin = ~src.transform * (lon, lat)
            i, j = math.floor(col - 0.5), math.floor(lin - 0.5)
            pixels.update((jj, ii) for jj in (j, j+1) for ii in (i, i+1))
            return bilinear(matriz, col - 0.5, lin - 0.5)
        for lote in lotes:
            pixels.clear()
            pol = Polygon(lote["poligono_utm"])
            assert pol.is_valid and pol.area > 0
            lote["relevo"] = resumir(lote["poligono_utm"], (pol.centroid.x, pol.centroid.y), altura)
            if AVISO not in lote["observacoes"]:
                lote["observacoes"] += " " + AVISO
            amostras.append({"id": lote["id"], **lote["relevo"],
                            "pixels_distintos_cotas_e_declividade": len(pixels)})
    gravar(caminho, lotes)
    gravar(DADOS / "relevo-pilotos.json", {
        "raster_sha256": meta["sha256"], "metodo": AVISO,
        "conferido_em_campo": False, "atribuicao": ATRIBUICAO,
        "contagem_pixels": "Células distintas usadas na interpolação, inclusive fora do lote para declividade; não são medições estatisticamente independentes.",
        "lotes": amostras})
    print(f"Relevo estimado preenchido em {len(lotes)} lotes.")


def testar():
    from rasterio.transform import from_origin
    transform = from_origin(-48 - 1/7200, -22 + 1/7200, 1/3600, 1/3600)
    alinhado = alinhar_bbox((-47.99, -22.02, -47.98, -22.01), transform)
    col, lin = ~transform * (alinhado[0], alinhado[3])
    assert math.isclose(col, round(col), abs_tol=1e-8) and math.isclose(lin, round(lin), abs_tol=1e-8)
    assert alinhado[0] <= -47.99 and alinhado[1] <= -22.02
    assert alinhado[2] >= -47.98 and alinhado[3] >= -22.01
    plano = np.array([[0., 2., 4.], [3., 5., 7.], [6., 8., 10.]])
    assert bilinear(plano, .25, .5) == 2.
    assert bilinear(plano, 1., 1.) == 5.
    for col, lin in [(-.01, 0), (2, 0), (0, 2)]:
        try:
            bilinear(plano, col, lin)
        except ValueError:
            pass
        else:
            raise AssertionError("Amostra fora do raster aceita")
    resumo = resumir([(0, 0), (10, 0), (10, 10), (0, 10)], (5, 5), lambda x, y: 700 + .03*x + .04*y)
    assert resumo["cota_min_m"] == 700 and resumo["cota_max_m"] == 700.7
    assert resumo["declividade_pct"] == 5.
    invalida = plano.copy()
    invalida[0, 0] = -9999
    try:
        bilinear(invalida, .5, .5)
    except ValueError:
        pass
    else:
        raise AssertionError("NoData aceito")
    print("Autoteste: alinhamento nativo, interpolação, limites, NoData e plano de 5% OK.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baixar", action="store_true")
    parser.add_argument("--testar", action="store_true")
    args = parser.parse_args()
    testar()
    if not args.testar:
        auditar_local()
        if args.baixar:
            baixar()
        if (AQUI / "lotes-piloto.json").exists() and RASTER.exists():
            aplicar()

# -*- coding: utf-8 -*-
"""Etapa 0: footprints de edificacao do Overture Maps.

Saida: `overture_buildings.geojson` -- e a MASSA do mapa. Em Sao Carlos sao 125.994
poligonos (75 MB); o cadastro da prefeitura nao tem nada parecido com isso, e o OSM
tem so alguns milhares. As fontes de dentro do Overture, lidas do arquivo baixado,
sao `Google Open Buildings` e `Microsoft ML Buildings` -- ou seja, telhado detectado
por satelite, nao cadastro. Isso explica o comportamento dele no resto do pipeline:

  * o footprint e o TELHADO, entao casa + garagem + edicula viram 3 poligonos, e o
    mapa fica com mais footprint (126 mil) do que endereco cadastrado (54 mil);
  * ele nao respeita divisa de lote e vem torto -- foi por isso que o v5 em diante
    passou a assentar casa no lote em vez de usar o footprint cru;
  * mas ele COBRE o que o cadastro nao cobre, e por isso continua sendo a prova de
    ocupacao da etapa 5 e o criterio de urbanizacao da etapa 1b.

O arquivo original deste projeto foi baixado antes de existir este script e a
proveniencia exata nao ficou registrada. O caminho documentado daqui pra frente e o
CLI oficial:

    pip install overturemaps
    python pipeline/fontes/overture.py

`--bbox` sai do JSON da cidade (`bbox`, em lon/lat). Sem ele, o script recusa rodar
em vez de baixar o planeta.
"""
import json, os, subprocess, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", "..")) + os.sep
sys.path.insert(0, RAIZ)
from padrao.cidade import carrega

CID = carrega(os.environ.get("CIDADE", "sao-carlos"))


def main():
    bbox = CID._d.get("bbox")
    if not bbox or len(bbox) != 4:
        raise SystemExit(
            "declare `bbox` em padrao/cidades/%s.json: [lon_min, lat_min, lon_max, lat_max].\n"
            "Sem bbox o download do Overture nao tem limite." % CID.slug)
    saida = CID.caminho("overture_bruto")
    os.makedirs(os.path.dirname(saida), exist_ok=True)   # cidade nova nao tem a pasta
    cmd = [sys.executable, "-m", "overturemaps", "download",
           "--bbox=%s" % ",".join(str(v) for v in bbox),
           "-f", "geojson", "--type=building", "-o", saida]
    print(" ".join(cmd))
    r = subprocess.run(cmd)
    if r.returncode:
        raise SystemExit(
            "falhou. Instale com `pip install overturemaps`, ou baixe a mao em\n"
            "https://explore.overturemaps.org e salve como %s" % saida)
    print("-> %s (%.1f MB)" % (saida, os.path.getsize(saida) / 1e6))


if __name__ == "__main__":
    main()

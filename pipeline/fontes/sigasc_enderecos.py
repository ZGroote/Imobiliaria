# -*- coding: utf-8 -*-
"""Etapa 0: pontos de endereco, do layer `enderecamento` (mapa `censo`).

Saida: `address_points.json` -- lista `[[E, N], ...]` em UTM nativo. E a PROVA DE
OCUPACAO da etapa 5: cada bolinha azul e um lote com construcao cadastrada.

    python pipeline/fontes/sigasc_enderecos.py

Duas particularidades deste layer:

1. **MAXSCALE 5000.** Ele nao desenha em celula de 3 km; some. Por isso os tiles aqui
   sao de 1.500 m (as celulas acesas do `quadras_pol`, quebradas em quatro) e a
   contagem sai de 4x mais requisicoes.
2. **Le tile a tile, nao pelo mosaico.** O ponto tem poucos pixels; o maxpool do
   mosaico engorda e cola vizinhos. A dedup por grade de 3 m resolve o ponto que
   aparece em dois tiles sobrepostos.

O layer PODE nao ter dado numa regiao: no Jardim Araucaria ele desenha zero pixel,
contra 1,26% no Jardim Embare. Lote sem endereco e sem footprint fica vazio de
proposito (ver `ocupacao.py`).
"""
import json, os, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", "..")) + os.sep
sys.path.insert(0, RAIZ); sys.path.insert(0, AQUI)
from padrao.cidade import carrega
import sigasc as sg

CID = carrega(os.environ.get("CIDADE", "sao-carlos"))
SUB = 1500                     # MAXSCALE 5000 obriga tile menor
TILES = os.path.join(RAIZ, "fontes_raster", "enderecos")
ACESAS_QUADRA = os.path.join(RAIZ, "fontes_raster", "quadras", "acesas.json")


def main():
    os.makedirs(TILES, exist_ok=True)
    if not os.path.exists(ACESAS_QUADRA):
        raise SystemExit("rode antes: python pipeline/fontes/sigasc_quadras.py --sonda\n"
                         "(as celulas com quadra sao as mesmas que tem endereco)")
    grossas = [tuple(x) for x in json.load(open(ACESAS_QUADRA))]
    finas = [(e + dx, n + dy) for (e, n) in grossas
             for dx in (0, SUB) for dy in (0, SUB)]
    print("celulas de %d m: %d" % (SUB, len(finas)))
    man = sg.tiles("censo", "enderecamento", finas, TILES, cell=SUB)
    pts = sg.pontos(man, sg.mascara_ponto_azul)
    saida = CID.caminho("enderecos")
    json.dump([[int(e), int(n)] for e, n in pts], open(saida, "w"))
    print("-> %s (%d pontos, %.1f MB)" % (saida, len(pts), os.path.getsize(saida) / 1e6))


if __name__ == "__main__":
    main()

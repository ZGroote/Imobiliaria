# -*- coding: utf-8 -*-
"""Etapa 0c -- reorganiza o city.json para streaming por quarteirao.

Era `v4/build_city_v4.py`. Ficou em `v4/` por acidente de historia: a pasta guarda o
DADO daquela geracao, e o script continua sendo etapa corrente do pipeline. O caminho
antigo segue funcionando por um invocador de duas linhas.

O v3 guarda os predios em ordem arbitraria e monta a cidade inteira no boot. Pra
carregar so o que esta a vista, o runtime precisa responder "quais predios estao
neste quarteirao?" sem varrer 126 mil registros. Duas formas:

  a) embutir a lista de indices por quadra  -> ~1,2 MB
  b) REORDENAR b[] agrupando por quadra e guardar so [cx,cz,raio,inicio,qtd]
     por quarteirao                          -> ~0,13 MB

Este script faz (b). E seguro porque em push_path (merge_osm_overture.py:126) os
deltas zeram a cada predio -- cada edificacao e um bloco independente do array,
entao mover blocos inteiros nao corrompe as coordenadas. bm[] (nome/endereco) e
remapeado junto, porque ele referencia predio por indice.

Os 14.211 predios que nao caem em nenhuma face do grafo de ruas (franja da
cidade, onde a malha nao fecha ciclo) NAO sao descartados: viram quadras
sinteticas de 850 m, so pra continuarem tendo uma unidade de streaming.

Saida: v4/sao-carlos-v4.city.json  (v:4, com o array bl[] novo)
"""
import json, math, collections

import os as _os, sys as _sys
_sys.path.insert(0, _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "..")))
from padrao.cidade import carrega as _carrega
CID = _carrega(_os.environ.get("CIDADE", "sao-carlos"))
# Fontes do JSON da cidade. Estavam escritas aqui, com nome de Sao Carlos.
# O v3 NAO tem dado proprio: `v3/sao-carlos-overture-v3.city.json` e copia byte a byte
# do `sao-carlos-overture-v2.city.json` (mesmo md5) -- o que o v3 mudou foi o HTML.
# Ler o v2 direto tira uma copia de 6,7 MB do caminho critico e uma "versao" do
# grafo de dependencia. Verificado: o blocks.json sai identico.
SRC    = CID.caminho("city_v2")
BLOCKS = CID.caminho("faces_ruas")
OUT    = CID.caminho("city_base")
_os.makedirs(_os.path.dirname(OUT), exist_ok=True)

SYNTH_CELL = 8500          # dm -- 850 m, mesma celula do v3, pros predios orfaos


def decode(b):
    """b[] -> [(cls, h, ring, inicio, fim)] preservando as fatias originais."""
    out, i, n = [], 0, len(b)
    while i < n:
        start = i
        cls, h, npt = b[i], b[i+1], b[i+2]; i += 3
        lx = lz = 0; ring = []
        for _ in range(npt):
            lx += b[i]; lz += b[i+1]; i += 2
            ring.append((lx, lz))
        out.append((cls, h, ring, start, i))
    return out


def main():
    with open(SRC, encoding="utf-8") as f:
        city = json.load(f)
    with open(BLOCKS, encoding="utf-8") as f:
        blocks = json.load(f)["blocks"]

    b = city["b"]
    recs = decode(b)
    print(f"predios decodificados: {len(recs)}")

    # quadra de cada predio (-1 = orfao)
    owner = [-1] * len(recs)
    for blk in blocks:
        for bi in blk["b"]:
            owner[bi] = blk["id"]

    orphans = [i for i, o in enumerate(owner) if o < 0]
    print(f"orfaos (fora de qualquer face): {len(orphans)}")

    # quadras sinteticas pros orfaos, uma por celula de 850 m
    synth = {}
    for bi in orphans:
        _, _, ring, _, _ = recs[bi]
        cx = sum(p[0] for p in ring) / len(ring)
        cz = sum(p[1] for p in ring) / len(ring)
        key = (int(cx // SYNTH_CELL), int(cz // SYNTH_CELL))
        synth.setdefault(key, []).append(bi)
    print(f"quadras sinteticas criadas: {len(synth)}")

    # grupos finais, na ordem em que serao gravados
    groups = []
    by_block = collections.defaultdict(list)
    for bi, o in enumerate(owner):
        if o >= 0:
            by_block[o].append(bi)
    for blk in blocks:
        if by_block[blk["id"]]:
            groups.append(by_block[blk["id"]])
    groups.extend(synth.values())
    print(f"grupos de streaming: {len(groups)} "
          f"({len(groups)-len(synth)} quarteiroes + {len(synth)} sinteticos)")

    # remonta b[] agrupado, e monta bl[]
    nb, bl, remap = [], [], {}
    for g in groups:
        start_building = len(remap)
        cxs = czs = 0.0
        far = 0.0
        pts_all = []
        for bi in g:
            cls, h, ring, s, e = recs[bi]
            remap[bi] = len(remap)
            nb.extend(b[s:e])              # fatia original, byte a byte
            pts_all.append(ring)
        # centro e raio do grupo: raio = maior distancia do centro ate um VERTICE
        # (nao ate o centroide do predio) -- assim nada aparece depois do teste
        n_pt = sum(len(r) for r in pts_all)
        # o centro vai gravado como inteiro, entao o raio TEM que ser medido a
        # partir do inteiro -- medindo do centro em float e arredondando depois,
        # sobra ate meio decimetro por eixo pra fora do raio (vira popping na borda).
        cxi = int(round(sum(p[0] for r in pts_all for p in r) / n_pt))
        czi = int(round(sum(p[1] for r in pts_all for p in r) / n_pt))
        for r in pts_all:
            for p in r:
                d = math.hypot(p[0]-cxi, p[1]-czi)
                if d > far:
                    far = d
        bl.extend([cxi, czi, int(math.ceil(far)), start_building, len(g)])

    assert len(remap) == len(recs), (len(remap), len(recs))

    # bm[] referencia predio por indice -> remapeia e reordena
    obm = city.get("bm", [])
    pairs = []
    for i in range(0, len(obm), 3):
        pairs.append((remap[obm[i]], obm[i+1], obm[i+2]))
    pairs.sort()
    nbm = [v for p in pairs for v in p]

    out = {
        "v": 4,
        "c": city["c"],
        "q": city["q"],
        "names": city["names"],
        "b": nb,
        "bm": nbm,
        "bl": bl,
        "r": city["r"],
        "g": city["g"],
    }
    s = json.dumps(out, separators=(",", ":"), ensure_ascii=False)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(s)

    assert len(nb) == len(b), (len(nb), len(b))
    print(f"\nb[] preservado: {len(nb)} inteiros (identico ao v3)")
    print(f"bl[]: {len(bl)} inteiros ({len(bl)//5} grupos)")
    print(f"gravado: {OUT}  ({len(s)/1048576:.1f} MB)")

    raios = sorted(bl[i+2] / city["q"] for i in range(0, len(bl), 5))
    cnts  = sorted(bl[i+4] for i in range(0, len(bl), 5))
    print(f"raio do grupo (m): p50 {raios[len(raios)//2]:.0f}  "
          f"p90 {raios[9*len(raios)//10]:.0f}  max {raios[-1]:.0f}")
    print(f"predios por grupo: p50 {cnts[len(cnts)//2]}  "
          f"p90 {cnts[9*len(cnts)//10]}  max {cnts[-1]}")


if __name__ == "__main__":
    main()

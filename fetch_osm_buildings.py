"""
Baixa tags de edificios (building=*) do OSM via Overpass para o bbox inteiro de
Sao Carlos, em tiles (para nao estourar timeout/limite de resposta do Overpass).

Salva cada tile em osm_tiles/tile_{i}_{j}.json assim que baixa com sucesso
(resumivel: se rodar de novo, pula tiles ja salvos). No final, mescla tudo
(dedup por way id) em osm_buildings_raw.json.
"""

import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request

import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from padrao.cidade import carrega as _carrega
CID = _carrega(_os.environ.get("CIDADE", "sao-carlos"))
_bb = CID._d["bbox"]        # [lon_min, lat_min, lon_max, lat_max]
# BBOX sai do JSON da cidade. Estava escrito aqui, com o de Sao Carlos.
BBOX = {"s": _bb[1], "w": _bb[0], "n": _bb[3], "e": _bb[2]}
TILE_DEG = 0.045

MIRRORS = [
    "https://z.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass-api.de/api/interpreter",
]

# tile por CIDADE: sem isso Araraquara reaproveitaria os tiles de Sao Carlos, que
# o script pula por ja existirem -- e o download sairia vazio sem erro nenhum.
TILES_DIR = os.path.join(os.path.dirname(CID.caminho("osm_predios")), "osm_tiles")
OUT_PATH = CID.caminho("osm_predios")
_os.makedirs(_os.path.dirname(OUT_PATH), exist_ok=True)


def make_tiles():
    n_lat = math.ceil((BBOX["n"] - BBOX["s"]) / TILE_DEG)
    n_lon = math.ceil((BBOX["e"] - BBOX["w"]) / TILE_DEG)
    tiles = []
    for i in range(n_lat):
        for j in range(n_lon):
            s = BBOX["s"] + i * TILE_DEG
            n = min(BBOX["n"], s + TILE_DEG)
            w = BBOX["w"] + j * TILE_DEG
            e = min(BBOX["e"], w + TILE_DEG)
            tiles.append({"id": f"{i}_{j}", "s": s, "n": n, "w": w, "e": e})
    return tiles


def fetch_tile(tile):
    query = (
        f'[out:json][timeout:180];way["building"]'
        f'({tile["s"]},{tile["w"]},{tile["n"]},{tile["e"]});out geom;'
    )
    data = urllib.parse.urlencode({"data": query}).encode()
    errs = []
    for mirror in MIRRORS:
        try:
            req = urllib.request.Request(mirror, data=data, method="POST")
            req.add_header("User-Agent", "SaoCarlosCity/1.0")
            with urllib.request.urlopen(req, timeout=120) as resp:
                j = json.loads(resp.read().decode("utf-8"))
                return j.get("elements", [])
        except Exception as e:
            errs.append(f"{mirror}: {e}")
            time.sleep(2)
    print(f"    FALHOU em todos os mirrors: {errs}")
    return None


def main():
    os.makedirs(TILES_DIR, exist_ok=True)
    tiles = make_tiles()
    print(f"=== Baixando edificios OSM em {len(tiles)} tiles ===\n")

    for idx, tile in enumerate(tiles):
        tile_path = os.path.join(TILES_DIR, f"tile_{tile['id']}.json")
        if os.path.exists(tile_path):
            print(f"[{idx+1}/{len(tiles)}] tile {tile['id']} ja existe, pulando")
            continue
        print(f"[{idx+1}/{len(tiles)}] baixando tile {tile['id']} "
              f"(s={tile['s']:.4f} w={tile['w']:.4f} n={tile['n']:.4f} e={tile['e']:.4f})...")
        elements = fetch_tile(tile)
        if elements is None:
            print(f"    ERRO: tile {tile['id']} nao baixado, tente rodar de novo depois")
            continue
        with open(tile_path, "w", encoding="utf-8") as f:
            json.dump(elements, f)
        print(f"    OK: {len(elements)} elementos")
        time.sleep(1)

    # Merge
    print("\n=== Mesclando tiles ===")
    seen_ids = set()
    merged = []
    tile_files = sorted(f for f in os.listdir(TILES_DIR) if f.startswith("tile_") and f.endswith(".json"))
    missing = len(tiles) - len(tile_files)
    for fn in tile_files:
        with open(os.path.join(TILES_DIR, fn), "r", encoding="utf-8") as f:
            elements = json.load(f)
        for el in elements:
            if el.get("type") != "way":
                continue
            wid = el.get("id")
            if wid in seen_ids:
                continue
            seen_ids.add(wid)
            merged.append(el)

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump({"elements": merged}, f)

    print(f"Tiles baixados: {len(tile_files)}/{len(tiles)} ({missing} faltando)")
    print(f"Edificios OSM unicos mesclados: {len(merged)}")
    print(f"Salvo em: {OUT_PATH}")
    if missing:
        print("\nAVISO: alguns tiles falharam. Rode o script de novo para tentar novamente "
              "(tiles ja baixados sao pulados).")


if __name__ == "__main__":
    main()

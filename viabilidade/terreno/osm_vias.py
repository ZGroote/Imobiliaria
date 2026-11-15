"""Recorta do pbf da Geofabrik as vias de carro de São Carlos -> dados/osm-vias-sao-carlos.json.gz (frente pela rua do OSM).

python viabilidade/terreno/osm_vias.py <caminho do sudeste-latest.osm.pbf>

O pbf (856 MB) fica fora do git, na pasta principal (fontes_osm/). Mesma entrada, mesma saída byte a byte: vias em ordem de
id, coordenadas com 6 casas, gzip com mtime=0. Dados © OpenStreetMap contributors, licença ODbL 1.0.
"""
import gzip
import json
from pathlib import Path
import site
import sys

try:
    import osmium
except ModuleNotFoundError:
    sys.path.append(site.getusersitepackages())
    import osmium
from osmium.filter import KeyFilter

SAIDA = Path(__file__).resolve().parent / "dados/osm-vias-sao-carlos.json.gz"
CAIXA = (-48.02, -22.12, -47.78, -21.84)  # oeste, sul, leste, norte (lon/lat): o município urbano com folga
# frente só pelas 5 da TAREFA-21; os *_link entram só para ligar um trecho à rede
CLASSES = ("residential", "primary", "secondary", "tertiary", "living_street", "primary_link", "secondary_link", "tertiary_link")


def main(pbf):
    leitor = osmium.io.Reader(str(pbf), osmium.osm.osm_entity_bits.NOTHING)
    data = leitor.header().get("osmosis_replication_timestamp")
    leitor.close()
    w, s, e, n = CAIXA
    vias = []
    fp = osmium.FileProcessor(str(pbf), osmium.osm.NODE | osmium.osm.WAY) \
        .with_locations(osmium.index.create_map("flex_mem")).with_filter(KeyFilter("highway"))
    for o in fp:
        if not o.is_way() or o.tags["highway"] not in CLASSES:
            continue
        try:
            cs = [[round(p.lon, 6), round(p.lat, 6)] for p in o.nodes]
        except osmium.InvalidLocationError:
            continue
        if len(cs) > 1 and any(w <= x <= e and s <= y <= n for x, y in cs):
            vias.append({"id": o.id, "nome": o.tags.get("name", ""), "highway": o.tags["highway"], "coords": cs})
    vias.sort(key=lambda v: v["id"])
    dado = {"fonte": "Geofabrik sudeste-latest.osm.pbf (extrato do OpenStreetMap)", "data_osm": data,
            "licenca": "© OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright)",
            "caixa_lonlat": CAIXA, "classes": CLASSES, "gerador": "viabilidade/terreno/osm_vias.py", "vias": vias}
    texto = json.dumps(dado, ensure_ascii=False, separators=(",", ":")).encode()
    SAIDA.write_bytes(gzip.compress(texto, compresslevel=9, mtime=0))
    print(f"{len(vias)} vias, OSM de {data}; {SAIDA.stat().st_size / 2**20:.2f} MiB -> {SAIDA}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]))

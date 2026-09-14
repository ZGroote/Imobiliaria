# -*- coding: utf-8 -*-
"""Etapas 0.2/0.3/0.4 em lote: recorta o OSM de um extract local, sem Overpass.

    python pipeline/fontes/osm_extract.py ribeirao-preto sorocaba sao-jose-do-rio-preto

Por que existe: o Overpass e um servico COMUNITARIO gratuito, e o pipeline fazia ~60
consultas de tile por cidade. Vinte cidades seriam ~1.200 consultas pesadas -- medido
em 2026-08-29, ele devolve `HTTP 429` ja na quarta seguida. Alem de nao funcionar em
lote, e abuso de recurso alheio. O extract regional do Geofabrik e o caminho pra isso:
UM download (Sudeste, 856 MB) e depois tudo offline.

**Duas passadas, e TODAS as cidades numa passada so.** Medido: o pyosmium entrega
~0,27 M nos/s (o gargalo e a fronteira Python, nao o handler -- `SimpleHandler` e
`FileProcessor` dao o mesmo numero), entao cada passada no Sudeste custa ~10 min. Uma
passada POR CIDADE seria 20x isso; por isso o script aceita varias cidades e cobra o
custo uma vez.

    passada 1 (so NODE)  guarda lon/lat dos nos que caem em ALGUMA bbox pedida
    passada 2 (so WAY)   monta a geometria com esses nos e separa por cidade

Nao usa `locations=True`: aquilo constroi o indice de posicao dos ~150 M nos do
Sudeste inteiro, estoura memoria e ficou 10 min sem sair do lugar. Aqui o indice tem
so os nos das cidades pedidas.

Emite exatamente o formato que o Overpass devolveria, entao NADA a jusante muda:

    osm_vias      ways com highway/leisure/landuse + `geometry` (= `out geom;`)
    osm_predios   ways com building + `geometry`
    osm_pois      nodes/ways de comercio/servico + `center`

Way que cruza a borda da bbox sai truncado nos nos que estao dentro -- e o mesmo que o
recorte do Overpass faz.
"""
import json, os, sys, time

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", "..")) + os.sep
sys.path.insert(0, RAIZ)
from padrao.cidade import carrega
import osmium

PBF = os.path.join(RAIZ, "fontes_osm", "sudeste-latest.osm.pbf")

POI_AMEN = {"restaurant", "fast_food", "food_court", "cafe", "ice_cream", "bar", "pub",
            "biergarten", "bank", "bureau_de_change", "school", "kindergarten",
            "college", "university", "music_school", "language_school", "fuel",
            "place_of_worship", "cinema", "theatre", "arts_centre", "library",
            "police", "post_office", "townhall", "courthouse", "fire_station",
            "community_centre", "pharmacy", "hospital", "clinic", "doctors"}


def e_poi(t):
    return (t.get("amenity") in POI_AMEN or "shop" in t or "office" in t
            or t.get("tourism") or t.get("healthcare"))


def passada_nos(pbf, uniao, caixas):
    """lon/lat dos nos dentro de alguma caixa + os POIs que ja sao no."""
    w0, s0, e0, n0 = uniao
    pos = {}; pois = [[] for _ in caixas]
    t0 = time.time(); k = 0
    for o in osmium.FileProcessor(pbf, osmium.osm.NODE):
        k += 1
        if k % 20000000 == 0:
            print("    %d M nos | %d guardados | %.0fs" % (k / 1e6, len(pos), time.time() - t0), flush=True)
        lo = o.location
        if not lo.valid(): continue
        x = lo.lon; y = lo.lat
        if x < w0 or x > e0 or y < s0 or y > n0: continue
        pos[o.id] = (round(x, 7), round(y, 7))
        t = dict(o.tags)
        if t and e_poi(t):
            for i, (a, b, c, d) in enumerate(caixas):
                if a <= x <= c and b <= y <= d:
                    pois[i].append({"type": "node", "id": o.id,
                                    "lat": round(y, 7), "lon": round(x, 7), "tags": t})
                    break
    print("    passada 1: %d M nos lidos, %d guardados, %.0fs"
          % (k / 1e6, len(pos), time.time() - t0), flush=True)
    return pos, pois


def passada_vias(pbf, pos, caixas):
    vias = [[] for _ in caixas]; predios = [[] for _ in caixas]; pois = [[] for _ in caixas]
    t0 = time.time(); k = 0
    for o in osmium.FileProcessor(pbf, osmium.osm.WAY):
        k += 1
        if k % 5000000 == 0:
            print("    %d M ways | %.0fs" % (k / 1e6, time.time() - t0), flush=True)
        t = dict(o.tags)
        if not t: continue
        quer_via = ("highway" in t or "leisure" in t or "landuse" in t)
        quer_pred = "building" in t
        quer_poi = e_poi(t)
        if not (quer_via or quer_pred or quer_poi): continue
        refs = [n.ref for n in o.nodes]
        g = [pos[r] for r in refs if r in pos]
        if not g: continue
        cx = sum(p[0] for p in g) / len(g); cy = sum(p[1] for p in g) / len(g)
        for i, (a, b, c, d) in enumerate(caixas):
            if not (a <= cx <= c and b <= cy <= d): continue
            geom = [{"lat": p[1], "lon": p[0]} for p in g]
            base = {"type": "way", "id": o.id, "tags": t}
            if quer_via: vias[i].append(dict(base, geometry=geom))
            if quer_pred: predios[i].append(dict(base, geometry=geom, nodes=refs))
            if quer_poi: pois[i].append(dict(base, center={"lat": round(cy, 7), "lon": round(cx, 7)}))
            break
    print("    passada 2: %d M ways lidos, %.0fs" % (k / 1e6, time.time() - t0), flush=True)
    return vias, predios, pois


def main():
    slugs = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not slugs: slugs = [os.environ.get("CIDADE", "sao-carlos")]
    pbf = PBF
    if "--pbf" in sys.argv: pbf = sys.argv[sys.argv.index("--pbf") + 1]
    if not os.path.exists(pbf):
        raise SystemExit("falta o extract: %s\n"
                         "Baixe de https://download.geofabrik.de/south-america/brazil/" % pbf)
    cids = [carrega(s) for s in slugs]
    caixas = [tuple(c._d["bbox"]) for c in cids]
    uniao = (min(b[0] for b in caixas), min(b[1] for b in caixas),
             max(b[2] for b in caixas), max(b[3] for b in caixas))
    print("%d cidade(s): %s" % (len(cids), ", ".join(c.nome for c in cids)))
    print("  uniao das caixas: %s" % (tuple(round(v, 3) for v in uniao),))
    print("  %s (%.0f MB)" % (os.path.basename(pbf), os.path.getsize(pbf) / 1e6))

    pos, pois_no = passada_nos(pbf, uniao, caixas)
    vias, predios, pois_w = passada_vias(pbf, pos, caixas)

    for i, cid in enumerate(cids):
        p = pois_no[i] + pois_w[i]
        print("  %-24s vias %6d | predios %7d | POIs %5d"
              % (cid.nome, len(vias[i]), len(predios[i]), len(p)))
        for chave, els in (("osm_vias", vias[i]), ("osm_predios", predios[i]), ("osm_pois", p)):
            d = cid.caminho(chave)
            os.makedirs(os.path.dirname(d), exist_ok=True)
            json.dump({"elements": els}, open(d, "w", encoding="utf-8"), ensure_ascii=False)
        print("     -> %s" % os.path.dirname(cid.caminho("osm_vias")))


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""Etapa 0f: POIs da pagina, a partir das tags do OSM ja baixadas.

Saida: `poidata_merged.json` -- `[{n, c, lat, lon, a, h, t, w}, ...]`, onde `c` e a
categoria que o renderizador conhece (ver o `CAT` do app.js).

Ate aqui isso morava num scratchpad (`gen_pois.py`) e a lista de 931 POIs de Sao
Carlos so existia como arquivo pronto -- ou seja, a segunda cidade nao tinha como
gerar a sua. O mapa de categoria abaixo e o mesmo daquele script.

Supermercado/mercado NAO entram: o `build_pois.py` ja os traz numa consulta propria e
teriam pino em dobro. Saude idem.

  python pipeline/fontes/pois.py            # usa CIDADE=<slug>
"""
import collections, json, os, sys, unicodedata

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", "..")) + os.sep
sys.path.insert(0, RAIZ)
from padrao.cidade import carrega

CID = carrega(os.environ.get("CIDADE", "sao-carlos"))

AMEN = {"restaurant": "comida", "fast_food": "comida", "food_court": "comida",
        "cafe": "cafebar", "ice_cream": "cafebar", "bar": "cafebar", "pub": "cafebar",
        "biergarten": "cafebar", "bank": "banco", "bureau_de_change": "banco",
        "school": "escola", "kindergarten": "escola", "college": "escola",
        "university": "escola", "music_school": "escola", "language_school": "escola",
        "fuel": "posto", "place_of_worship": "igreja",
        "cinema": "turismo", "theatre": "turismo", "arts_centre": "turismo",
        "library": "publico", "police": "publico", "post_office": "publico",
        "townhall": "publico", "courthouse": "publico", "fire_station": "publico",
        "community_centre": "publico"}
LEIS = {"fitness_centre": "academia", "sports_centre": "academia",
        "fitness_station": "academia", "stadium": "academia"}
TOUR = {"hotel": "hotel", "motel": "hotel", "guest_house": "hotel", "hostel": "hotel",
        "apartment": "hotel", "attraction": "turismo", "museum": "turismo",
        "artwork": "turismo", "viewpoint": "turismo", "gallery": "turismo",
        "theme_park": "turismo", "zoo": "turismo"}
SHOP_COMIDA = {"bakery": "padaria", "pastry": "padaria"}
SHOP_FORA = {"supermarket", "convenience", "greengrocer", "wholesale"}


def categoria(t):
    if t.get("amenity") in AMEN: return AMEN[t["amenity"]]
    if t.get("leisure") in LEIS: return LEIS[t["leisure"]]
    if t.get("tourism") in TOUR: return TOUR[t["tourism"]]
    if "office" in t: return "publico" if t.get("office") == "government" else "servico"
    if "shop" in t:
        s = t["shop"]
        if s in SHOP_COMIDA: return SHOP_COMIDA[s]
        if s in SHOP_FORA: return None
        return "loja"
    return None


def norm(s):
    return (unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore")
            .decode().lower().strip())


def main():
    bruto = CID.caminho("osm_pois")
    if not os.path.exists(bruto):
        raise SystemExit("falta %s -- rode a etapa 0.4 antes" % bruto)
    raw = json.load(open(bruto, encoding="utf-8"))
    els = raw.get("elements", raw) if isinstance(raw, dict) else raw
    vistos = set(); out = []; cnt = collections.Counter()
    for e in els:
        t = e.get("tags", {}); nm = t.get("name")
        if not nm: continue
        c = categoria(t)
        if not c: continue
        lat = e.get("lat", (e.get("center") or {}).get("lat"))
        lon = e.get("lon", (e.get("center") or {}).get("lon"))
        if lat is None or lon is None: continue
        k = (norm(nm), round(lat, 4), round(lon, 4))
        if k in vistos: continue
        vistos.add(k); cnt[c] += 1
        rua = t.get("addr:street"); num = t.get("addr:housenumber")
        out.append({"n": nm, "c": c, "lat": round(lat, 6), "lon": round(lon, 6),
                    "a": (rua + (", " + num if num else "")) if rua else None,
                    "h": t.get("opening_hours"), "t": t.get("phone"),
                    "w": t.get("website")})
    saida = CID.caminho("pois")
    os.makedirs(os.path.dirname(saida), exist_ok=True)
    json.dump(out, open(saida, "w", encoding="utf-8"), ensure_ascii=False,
              separators=(",", ":"))
    print("%d POIs -> %s" % (len(out), saida))
    for c, n in cnt.most_common(): print("   %-10s %d" % (c, n))


if __name__ == "__main__":
    main()

"""
Extrai os estabelecimentos de interesse (supermercados, mercados, farmacias,
hospitais, UPAs, Unimed e postos de saude) do OSM e gera pois_sao_carlos.json,
que e embutido no mapa 3D.

Fonte: Overpass API (ao vivo). Se a rede falhar, cai para o snapshot local
osm_pois_raw.json baixado por fetch_osm_pois.py.
"""

import json
import math
import os
import re
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
BB = "-22.10,-48.08,-21.93,-47.80"
# Centro (Catedral) e raio: o bbox do Overpass pega tambem Ibate, cidade
# vizinha. Corta em 10 km pra ficar so o que e de Sao Carlos mesmo.
CENTER = (-22.01725, -47.89080)
RAIO_KM = 10.0
OUT = os.path.join(HERE, "pois_sao_carlos.json")
FALLBACK = os.path.join(HERE, "osm_pois_raw.json")

QUERY = f"""[out:json][timeout:120];
(
 node["shop"~"^(supermarket|convenience|greengrocer|department_store|wholesale|mall)$"]({BB});
 way["shop"~"^(supermarket|convenience|greengrocer|department_store|wholesale|mall)$"]({BB});
 node["amenity"~"^(pharmacy|hospital|clinic|doctors|marketplace)$"]({BB});
 way["amenity"~"^(pharmacy|hospital|clinic|doctors|marketplace)$"]({BB});
 node["healthcare"]({BB});
 way["healthcare"]({BB});
 node["name"~"[Uu]nimed"]({BB});
 way["name"~"[Uu]nimed"]({BB});
);
out center tags;"""

MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

# ---------------------------------------------------------------- categorias
# Ordem importa: a primeira que casar vence (UPA antes de hospital generico,
# Unimed antes de tudo em saude).
UPA_RE = re.compile(r"\bupa\b|pronto[- ]atendimento|pronto[- ]socorro", re.I)
UNIMED_RE = re.compile(r"unimed", re.I)
UBS_RE = re.compile(r"unidade b[aá]sica|posto de sa[uú]de|\busf\b|unidade de sa[uú]de|sa[uú]de da fam[ií]lia|\bubs\b", re.I)
ATACADO_RE = re.compile(r"atacad|tenda atacado|assa[ií]|makro|sam.s club", re.I)

# Coisas que estao com a tag errada no OSM e nao sao mercado de verdade.
NAO_MERCADO_RE = re.compile(
    r"tech cell|top suplementos|carvoaria|loja kaeru|multi coisas|shopping do churrasco|"
    r"fechado permanentemente|estação damha mall|estacao damha mall|^br$", re.I)

# Loja marcada como convenience/marketplace no OSM mas que se chama supermercado
# de fato: promove pra categoria certa.
SUPER_RE = re.compile(r"supermercad", re.I)


def dist_km(lat, lon):
    return math.hypot((lat - CENTER[0]) * 111.13, (lon - CENTER[1]) * 103.1)


def categorize(t):
    name = t.get("name") or ""
    amenity = t.get("amenity", "")
    shop = t.get("shop", "")
    health = t.get("healthcare", "")

    if UNIMED_RE.search(name):
        return "unimed"
    if amenity == "pharmacy" or health == "pharmacy":
        return "farmacia"
    if UPA_RE.search(name):
        return "upa"
    if amenity == "hospital" or health == "hospital":
        return "hospital"
    if UBS_RE.search(name):
        return "ubs"
    if shop in ("supermarket", "wholesale") or (shop == "department_store" and ATACADO_RE.search(name)):
        return "atacado" if ATACADO_RE.search(name) else "supermercado"
    if shop in ("convenience", "greengrocer") or amenity == "marketplace":
        return "supermercado" if SUPER_RE.search(name) else "mercado"
    return None


def fetch_live():
    data = urllib.parse.urlencode({"data": QUERY}).encode()
    for mirror in MIRRORS:
        try:
            req = urllib.request.Request(mirror, data=data, method="POST")
            req.add_header("User-Agent", "SaoCarlosCity/1.0")
            with urllib.request.urlopen(req, timeout=150) as resp:
                els = json.loads(resp.read().decode("utf-8")).get("elements", [])
            print(f"Overpass OK ({mirror}): {len(els)} elementos")
            return els
        except Exception as e:
            print(f"  falhou {mirror}: {e}")
            time.sleep(2)
    return None


def latlon(el):
    if "lat" in el and "lon" in el:
        return el["lat"], el["lon"]
    c = el.get("center")
    if c:
        return c["lat"], c["lon"]
    return None, None


def main():
    els = fetch_live()
    if els is None:
        print("Rede indisponivel; usando snapshot local osm_pois_raw.json")
        els = json.load(open(FALLBACK, encoding="utf-8"))["elements"]

    out, seen = [], {}
    for el in els:
        t = el.get("tags") or {}
        name = (t.get("name") or "").strip()
        if not name:
            continue                      # sem nome nao vira ficha util no mapa
        if NAO_MERCADO_RE.search(name):
            continue
        cat = categorize(t)
        if cat is None:
            continue
        lat, lon = latlon(el)
        if lat is None or dist_km(lat, lon) > RAIO_KM:
            continue

        # dedupe: mesmo nome a menos de ~120 m e o mesmo estabelecimento
        # (node do POI + way do predio costumam vir os dois).
        key = (cat, name.lower())
        dup = False
        for plat, plon in seen.get(key, ()):
            if abs(plat - lat) < 0.0011 and abs(plon - lon) < 0.0012:
                dup = True
                break
        if dup:
            continue
        seen.setdefault(key, []).append((lat, lon))

        addr = ", ".join(filter(None, [t.get("addr:street"), t.get("addr:housenumber")]))
        out.append({
            "n": name,
            "c": cat,
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "a": addr or None,
            "h": t.get("opening_hours") or None,
            "t": t.get("phone") or t.get("contact:phone") or None,
            "w": t.get("website") or t.get("contact:website") or None,
        })

    out.sort(key=lambda p: (p["c"], p["n"]))
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    from collections import Counter
    print(f"\n{len(out)} estabelecimentos -> {OUT}")
    for c, n in Counter(p["c"] for p in out).most_common():
        print(f"  {n:4d}  {c}")


if __name__ == "__main__":
    main()

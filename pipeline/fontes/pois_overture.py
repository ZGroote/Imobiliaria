# -*- coding: utf-8 -*-
"""Etapa 0g: soma os lugares do Overture (Places) aos POIs do OSM.

Entrada: `pois_osm` (a lista da 0f) + `overture_lugares` (baixado na 0.11).
Saida:   `pois` -- o que o build embute em `__poidata`, no mesmo formato
         `[{n, c, lat, lon, a, h, t, w}, ...]`.

Por que: o OSM de Sao Carlos tinha 37 mercados; o Overture tem 244 (Meta + Microsoft,
licenca CDLA-Permissive-2.0, uso comercial livre). No Monte das Colinas o "por perto"
dizia 0 mercado e 0 farmacia num raio de 1 km; com o Overture sao 10 e 4.

O que o dado traz de errado, e o que cada regra abaixo faz:
  * confianca baixa e lixo ("Republica Santa Casa" como mercado, "Carefour" em dobro):
    corte em CONF_MIN;
  * a mesma loja vem do OSM e do Overture, ou duas vezes do Overture: nome parecido a
    menos de DUP_M e a mesma. O OSM entra primeiro e ganha -- e a lista curada;
  * `hospital` do Overture e quase tudo clinica (de 70, ~5 hospitais): saude so entra
    se o NOME disser hospital/UPA/UBS/Unimed. O mapa nao tem categoria de clinica;
  * o bbox alcanca Ibate: mesmo corte de RAIO_KM do centro que o build_pois usa.

Sem o arquivo do Overture (cidade que nao rodou a 0.11) a saida e a lista do OSM.

  python pipeline/fontes/pois_overture.py     # usa CIDADE=<slug>
"""
import difflib, json, math, os, re, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", "..")) + os.sep
sys.path.insert(0, RAIZ)
from padrao.cidade import carrega
from build_pois import UPA_RE, UNIMED_RE, UBS_RE, ATACADO_RE, SUPER_RE, NAO_MERCADO_RE
from pipeline.fontes.pois import norm

CID = carrega(os.environ.get("CIDADE", "sao-carlos"))

CONF_MIN = 0.5
DUP_M = 200       # Carrefour x "Carefour" estavam a 156 m
RAIO_KM = 10.0
HOSP_RE = re.compile(r"hospital|santa casa|maternidade", re.I)
REPUBLICA_RE = re.compile(r"^rep[uú]blica\b", re.I)    # moradia de estudante como acougue
# `warehouse_club_store` e lixo (de 10, so o Tenda era atacado: roupa, LED, energia
# solar...). Ali so passa rede conhecida; o resto cai em loja.
REDE_ATACADO_RE = re.compile(r"tenda atacado|assa[ií]|makro|sam.s club", re.I)

MERCADO = {"grocery_store", "convenience_store", "produce_store", "butcher_shop",
           "farmers_market", "organic_grocery_store", "market"}


def categoria(nome, h):
    """`h` = conjunto da hierarquia da taxonomia do Overture (raiz ate a folha)."""
    if NAO_MERCADO_RE.search(nome) or REPUBLICA_RE.search(nome): return None
    if "health_care" in h:
        if UNIMED_RE.search(nome): return "unimed"
        if UPA_RE.search(nome): return "upa"
        if UBS_RE.search(nome): return "ubs"
        if HOSP_RE.search(nome): return "hospital"
        return None
    if "pharmacy" in h: return "farmacia"
    if h & MERCADO or "wholesale_grocer" in h:
        if ATACADO_RE.search(nome): return "atacado"
        return "supermercado" if SUPER_RE.search(nome) else "mercado"
    if "warehouse_club_store" in h and REDE_ATACADO_RE.search(nome): return "atacado"
    if "bakery" in h: return "padaria"
    if h & {"restaurant", "casual_eatery"}: return "comida"
    if h & {"alcoholic_beverage_venue", "non_alcoholic_beverage_venue"}: return "cafebar"
    if h & {"bank", "bank_or_credit_union"}: return "banco"
    if "library" in h: return "publico"
    if "education" in h: return "escola"
    if "fueling_station" in h: return "posto"
    if h & {"place_of_worship", "religious_organization"}: return "igreja"
    if "park" in h: return "turismo"
    if "sports_and_recreation" in h: return "academia"
    if "lodging" in h: return "hotel"
    if h & {"arts_and_entertainment", "cultural_and_historic"}: return "turismo"
    if "community_and_government" in h: return "publico"
    if "shopping" in h: return "loja"
    if h & {"services_and_business", "lifestyle_services", "travel_and_transportation"}:
        return "servico"
    return None


def metros(a, b):
    return math.hypot((a[0] - b[0]) * 111320,
                      (a[1] - b[1]) * 111320 * math.cos(math.radians(a[0])))


def parecido(x, y):
    if len(x) >= 4 and len(y) >= 4 and (x in y or y in x): return True
    return difflib.SequenceMatcher(None, x, y).ratio() >= 0.8


class Grade:
    """Vizinhos a menos de DUP_M sem varrer a lista inteira a cada ponto."""
    PASSO = 0.002   # ~200 m

    def __init__(self): self.c = {}

    def _k(self, lat, lon): return int(lat // self.PASSO), int(lon // self.PASSO)

    def add(self, lat, lon, nome):
        self.c.setdefault(self._k(lat, lon), []).append((lat, lon, nome))

    def tem(self, lat, lon, nome):
        i, j = self._k(lat, lon)
        for di in (-1, 0, 1):
            for dj in (-1, 0, 1):
                for la, lo, nm in self.c.get((i + di, j + dj), ()):
                    if metros((lat, lon), (la, lo)) <= DUP_M and parecido(nome, nm):
                        return True
        return False


def lugares(caminho):
    for f in json.load(open(caminho, encoding="utf-8"))["features"]:
        p = f["properties"]
        nome = ((p.get("names") or {}).get("primary") or "").strip()
        if not nome or (p.get("confidence") or 0) < CONF_MIN: continue
        tax = p.get("taxonomy") or {}
        c = categoria(nome, set(tax.get("hierarchy") or []) | {tax.get("primary")})
        if not c: continue
        lon, lat = f["geometry"]["coordinates"][:2]
        end = (p.get("addresses") or [{}])[0].get("freeform")
        yield p["confidence"], {
            "n": nome, "c": c, "lat": round(lat, 6), "lon": round(lon, 6), "a": end,
            "h": None, "t": (p.get("phones") or [None])[0],
            "w": (p.get("websites") or [None])[0]}


def main():
    osm = json.load(open(CID.caminho("pois_osm"), encoding="utf-8"))
    out = list(osm)
    g = Grade()
    for p in osm: g.add(p["lat"], p["lon"], norm(p["n"]))

    bruto = CID.caminho("overture_lugares")
    if not os.path.exists(bruto):
        print("sem %s -- saida = so o OSM (rode a 0.11 com --rede)" % bruto)
    else:
        centro = (CID._d["centro"]["lat"], CID._d["centro"]["lon"])
        dup = longe = 0
        # mais confiavel primeiro: entre duas copias do Overture fica a melhor
        for _, p in sorted(lugares(bruto), key=lambda t: -t[0]):
            if metros(centro, (p["lat"], p["lon"])) > RAIO_KM * 1000: longe += 1; continue
            nm = norm(p["n"])
            if g.tem(p["lat"], p["lon"], nm): dup += 1; continue
            g.add(p["lat"], p["lon"], nm); out.append(p)
        print("Overture: +%d (%d duplicados, %d fora de %g km)"
              % (len(out) - len(osm), dup, longe, RAIO_KM))

    saida = CID.caminho("pois")
    json.dump(out, open(saida, "w", encoding="utf-8"), ensure_ascii=False,
              separators=(",", ":"))
    print("%d POIs (%d do OSM) -> %s" % (len(out), len(osm), saida))


if __name__ == "__main__":
    main()

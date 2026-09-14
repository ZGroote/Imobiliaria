# -*- coding: utf-8 -*-
"""Cria `padrao/cidades/<slug>.json` a partir de nome + centro + bbox.

    python pipeline/nova_cidade.py "Ribeirao Preto" SP -21.1775 -47.8103 \
        --bbox -47.90 -21.29 -47.68 -21.08

O que ele decide sozinho, e que errado nao da erro -- da cidade deformada:

**O fuso UTM.** Sai da longitude do centro: zona = floor((lon+180)/6)+1. No Brasil,
SIRGAS 2000 / UTM <zona>S = EPSG:319<60+zona>. Sao Paulo estado cai nas zonas 22
(oeste de -48) e 23 (leste). Cidade que cruza -48 fica na zona onde esta o centro; a
distorcao na borda e de centimetros na escala em que este mapa trabalha.

**SIRGAS 2000, nao SAD69.** Sao Carlos usa SAD69/23S (EPSG:29193) porque o dado da
prefeitura e SAD69. Cidade sem dado de prefeitura recebe tudo em WGS84 (Overture, OSM),
e SIRGAS ~ WGS84: evita o desvio de datum de ~50 m que o SAD69 carrega.

O resto (largura de via, tamanho de lote padrao, limiares de QA, grade de relevo) e
copiado de uma cidade modelo -- sao valores de Brasil, nao de Sao Carlos.
"""
import collections, io, json, math, os, re, sys, unicodedata

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..")) + os.sep
CIDADES = os.path.join(RAIZ, "padrao", "cidades")
MODELO = "araraquara"      # cidade SEM dado de prefeitura: o caso comum


def slugify(nome):
    s = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def epsg_utm(lon):
    zona = int(math.floor((lon + 180) / 6)) + 1
    return "EPSG:%d" % (31960 + zona), zona


def cria(nome, uf, lat, lon, bbox, slug=None, forcar=False):
    slug = slug or slugify(nome)
    destino = os.path.join(CIDADES, slug + ".json")
    if os.path.exists(destino) and not forcar:
        raise SystemExit("%s ja existe (use --forcar)" % destino)
    base = json.load(io.open(os.path.join(CIDADES, MODELO + ".json"), encoding="utf-8"),
                     object_pairs_hook=collections.OrderedDict)
    d = collections.OrderedDict(base)
    utm, zona = epsg_utm(lon)
    d["slug"] = slug; d["nome"] = nome; d["uf"] = uf
    d["crs"] = collections.OrderedDict([
        ("geo", "EPSG:4326"), ("utm", utm),
        ("_nota", "SIRGAS 2000 / UTM %dS, escolhido pela longitude do centro (%.4f)." % (zona, lon))])
    d["centro"] = collections.OrderedDict([
        ("lat", lat), ("lon", lon),
        ("_nota", "origem do sistema de coordenadas do mapa; o renderizador le daqui.")])
    d["bbox"] = [round(v, 4) for v in bbox]
    pasta = slug
    f = collections.OrderedDict()
    for k, v in base["fontes"].items():
        if k.startswith("_"): f[k] = v; continue
        f[k] = v.replace(MODELO, pasta)
    d["fontes"] = f
    io.open(destino, "w", encoding="utf-8").write(json.dumps(d, ensure_ascii=False, indent=2))
    print("-> %s" % os.path.relpath(destino, RAIZ))
    print("   %s/%s | centro %.4f, %.4f | %s (zona %dS)" % (nome, uf, lat, lon, utm, zona))
    print("   bbox %s  (%.0f x %.0f km)"
          % (d["bbox"],
             (bbox[2] - bbox[0]) * 111.32 * math.cos(math.radians(lat)),
             (bbox[3] - bbox[1]) * 111.13))
    return destino


def main():
    a = sys.argv[1:]
    if len(a) < 4:
        raise SystemExit(__doc__)
    nome, uf, lat, lon = a[0], a[1], float(a[2]), float(a[3])
    if "--bbox" in a:
        i = a.index("--bbox"); bbox = [float(x) for x in a[i + 1:i + 5]]
    else:
        # caixa padrao de ~22 x 22 km em volta do centro
        dlat = 11.0 / 111.13; dlon = 11.0 / (111.32 * math.cos(math.radians(lat)))
        bbox = [lon - dlon, lat - dlat, lon + dlon, lat + dlat]
    cria(nome, uf, lat, lon, bbox, forcar="--forcar" in a)


if __name__ == "__main__":
    main()

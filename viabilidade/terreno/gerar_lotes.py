"""Audita as duas bases e reproduz cinco geometrias de ensaio, sem alterar fontes.

Execute: python -I viabilidade/terreno/gerar_lotes.py
Verifique a saída existente: python -I viabilidade/terreno/gerar_lotes.py --testar
Dependências existentes: numpy, shapely >= 2, pyproj.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import site
import sys
from collections import Counter

import numpy as np
import shapely as sh
from shapely.geometry import LineString, Point, Polygon, shape

try:
    from pyproj import Transformer
except ModuleNotFoundError:
    # O pyproj já instalado no computador fica fora do site usado por python -I.
    sys.path.append(site.getusersitepackages())
    from pyproj import Transformer

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
BASES = ["lotes_saocarlos.geojson", "sao-carlos/dados/lotes_saocarlos_completo.geojson"]
UTM = Transformer.from_crs(4326, 31983, always_xy=True)
GEO = Transformer.from_crs(31983, 4326, always_xy=True)
CONFIG = json.loads((ROOT / "padrao/cidades/sao-carlos.json").read_text(encoding="utf-8"))
CLON, CLAT = CONFIG["centro"]["lon"], CONFIG["centro"]["lat"]
MLON, MLAT = 111319.49 * math.cos(math.radians(CLAT)), 111132.92
CENTRO = Point(UTM.transform(CLON, CLAT))


def ler(nome):
    return json.loads((ROOT / nome).read_text(encoding="utf-8"))


def gravar(path, dado):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(dado, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def auditoria(nome):
    features = ler(nome)["features"]
    geos = np.array([shape(f["geometry"]) for f in features], dtype=object)
    geos = sh.transform(geos, UTM.transform, interleaved=False)
    areas, validos = sh.area(geos), sh.is_valid(geos)
    ids = np.flatnonzero(validos & ~sh.is_empty(geos))
    tree = sh.STRtree(geos[ids])
    a, b = tree.query(geos[ids], predicate="intersects")
    unico = a < b
    a, b = ids[a[unico]], ids[b[unico]]
    inter = sh.area(sh.intersection(geos[a], geos[b]))
    relevantes = inter > 0.1
    maiores = np.argsort(inter)[-5:][::-1]
    retangulos = sh.area(sh.minimum_rotated_rectangle(geos[ids]))
    qualidade = {
        "arquivo": nome,
        "sha256": hashlib.sha256((ROOT / nome).read_bytes()).hexdigest(),
        "feicoes": len(features), "geometrias": dict(Counter(g.geom_type for g in geos)),
        "fontes": dict(Counter(f["properties"].get("fonte", "sem_rotulo") for f in features)),
        "invalidas": int((~validos).sum()), "vazias": int(sh.is_empty(geos).sum()),
        "com_buracos": sum(bool(g.interiors) for g in geos if g.geom_type == "Polygon"),
        "area_m2_percentis_0_1_50_95_99_100": np.percentile(areas, [0, 1, 50, 95, 99, 100]).round(3).tolist(),
        "area_menor_35_m2": int((areas < 35).sum()), "area_maior_1500_m2": int((areas > 1500).sum()),
        "area_maior_10000_m2": int((areas > 10000).sum()),
        "ocupacao_retangulo_menor_0_5": int((areas[ids] / retangulos < 0.5).sum()),
        "pares_sobrepostos_mais_0_1_m2": int(relevantes.sum()),
        "feicoes_em_sobreposicao": len(set(a[relevantes].tolist() + b[relevantes].tolist())),
        "soma_intersecoes_pares_m2_nao_area_unica": round(float(inter[relevantes].sum()), 3),
        "maiores_intersecoes": [{"indices_zero_based": [int(a[k]), int(b[k])], "area_m2": round(float(inter[k]), 3)} for k in maiores],
        "exemplos_invalidos": [{"indice": int(k), "motivo": sh.is_valid_reason(geos[k])} for k in np.flatnonzero(~validos)[:5]],
    }
    print(json.dumps(qualidade, ensure_ascii=False), flush=True)
    return features, geos, qualidade


def ruas():
    dados = np.array(ler("sao-carlos/dados/street_tris.json"), dtype=float).reshape(-1, 3, 2)
    lon = CLON + dados[:, :, 0] / MLON
    lat = CLAT - dados[:, :, 1] / MLAT
    x, y = UTM.transform(lon, lat)
    tris = sh.polygons(np.stack([x, y], axis=-1))
    return tris[sh.is_valid(tris) & (sh.area(tris) > 0)], len(dados)


def avaliar(g, indice, geos, tree, malha, tree_ruas):
    vizinhos = tree.query(g, predicate="intersects")
    vizinhos = vizinhos[vizinhos != indice]
    inter = sh.area(sh.intersection(g, geos[vizinhos]))
    if np.any(inter > 0.1):
        return None
    perto = tree_ruas.query(g.buffer(12), predicate="intersects")
    rua = sh.union_all(malha[perto])
    invasao = g.intersection(rua).area
    if rua.is_empty or invasao / g.area > 0.02:
        return None
    frentes = []
    coords = list(g.exterior.coords)
    for k, (a, b) in enumerate(zip(coords, coords[1:])):
        lado = LineString([a, b])
        if lado.length < 8:
            continue
        distancias = [lado.interpolate(t, normalized=True).distance(rua) for t in (0.15, 0.5, 0.85)]
        if max(distancias) <= 6:
            frentes.append({"aresta": k, "pontos": [list(a), list(b)], "comprimento_m": round(lado.length, 3),
                            "distancia_max_asfalto_m": round(max(distancias), 3)})
    if not frentes:
        return None
    esquina = False
    for i, f in enumerate(frentes):
        for h in frentes[i + 1:]:
            u = np.subtract(f["pontos"][1], f["pontos"][0])
            v = np.subtract(h["pontos"][1], h["pontos"][0])
            ang = math.degrees(math.acos(np.clip(np.dot(u, v) / np.linalg.norm(u) / np.linalg.norm(v), -1, 1)))
            juntas = any(math.dist(a, b) < 2 for a in f["pontos"] for b in h["pontos"])
            if juntas and 45 <= ang <= 135:
                esquina = True
    frentes.sort(key=lambda f: (-f["comprimento_m"], f["aresta"]))
    return {"frentes": frentes, "esquina_indicada_pela_malha": esquina,
            "sobreposicao_asfalto_m2": round(invasao, 3), "maior_sobreposicao_vizinho_m2": round(float(max(inter, default=0)), 6)}


def checar(lotes):
    assert len(lotes) == 5 and len({l["id"] for l in lotes}) == 5
    assert sum(l["categoria"] == "grande" for l in lotes) == 2
    assert sum(l["categoria"] == "medio" for l in lotes) == 2
    assert sum(l["categoria"] == "esquina" for l in lotes) == 1
    origem = ler(BASES[1])["features"]
    for l in lotes:
        g = Polygon(l["poligono_utm"])
        assert l["fonte"]["arquivo"] == BASES[1]
        fonte = origem[l["fonte"]["indice_feicao_zero_based"]]["geometry"]["coordinates"][0]
        esperado = [UTM.transform(lon, lat) for lon, lat in fonte]
        assert len(esperado) == len(l["poligono_utm"])
        assert all(math.dist(a, b) < 0.000002 for a, b in zip(esperado, l["poligono_utm"]))
        assert g.is_valid and not g.interiors and abs(g.area - l["area_m2"]) < 0.02
        assert LineString(l["frente"]).difference(g.boundary).length < 0.001
        assert l["crs"] == "EPSG:31983"
        if l["zona_id"] is not None:
            assert l["zona_id"] in {z["id"] for z in ler("viabilidade/lei/zonas.json")}
            assert l["zona_anotada_a_mao"] is True
        assert isinstance(l.get("areas_especiais", []), list)
        for especial in l.get("areas_especiais", []):
            assert especial["tipo"] and especial["fonte"]
            if especial.get("altura_max_m") is not None:
                assert math.isfinite(especial["altura_max_m"]) and especial["altura_max_m"] > 0
        if l["relevo"] is not None:
            r = l["relevo"]
            assert r["fonte"] and r["resolucao_m"] > 0
            assert all(math.isfinite(r[k]) for k in ("cota_min_m", "cota_max_m", "declividade_pct"))
            assert r["cota_min_m"] <= r["cota_max_m"] and r["declividade_pct"] >= 0
        assert l["qualidade"]["maior_sobreposicao_vizinho_m2"] <= 0.1
        if l["categoria"] == "grande":
            assert g.area > 1500
        elif l["categoria"] == "medio":
            assert 600 <= g.area <= 1500
        else:
            assert l["qualidade"]["esquina_indicada_pela_malha"]
        for x, y in l["poligono_utm"]:
            assert math.dist((x, y), UTM.transform(*GEO.transform(x, y))) < 0.001
    gs = [Polygon(l["poligono_utm"]) for l in lotes]
    assert all(a.intersection(b).area < 0.1 for i, a in enumerate(gs) for b in gs[i + 1:])


def main():
    if (OUT / "lotes-piloto.json").exists():
        raise FileExistsError("Pilotos já existem; use --testar. A geração não sobrescreve anotações e relevo.")
    relatorio = {"crs_medicoes": "EPSG:31983", "bases": [], "conferido_em_campo": False}
    for nome in BASES:
        features, geos, qualidade = auditoria(nome)
        relatorio["bases"].append(qualidade)
    malha, ntris = ruas()
    relatorio["ruas"] = {"arquivo": "sao-carlos/dados/street_tris.json", "triangulos": ntris,
                         "validos_nao_degenerados": len(malha), "arredondamento_coordenadas_m": 1}
    tree, tree_ruas = sh.STRtree(geos), sh.STRtree(malha)
    areas = sh.area(geos)
    dist = sh.distance(sh.centroid(geos), CENTRO)
    lotes = []
    usados = set()
    for categoria, quantidade in (("grande", 2), ("medio", 2), ("esquina", 1)):
        indices = np.flatnonzero((areas > 1500) if categoria == "grande" else ((areas >= (600 if categoria == "medio" else 300)) & (areas <= 1500) & (dist <= 2500)))
        # shortcut: proximidade ao centro é proxy espacial; verticalização exige inventário verificado.
        indices = sorted(indices, key=lambda k: (features[k]["properties"].get("fonte") != "planta", dist[k], int(k)))
        escolhidos = 0
        for k in indices:
            g = geos[k]
            if k in usados or not g.is_valid or g.geom_type != "Polygon" or g.interiors:
                continue
            regularidade = g.area / g.minimum_rotated_rectangle.area
            if regularidade < 0.7:
                continue
            q = avaliar(g, k, geos, tree, malha, tree_ruas)
            if q is None or (categoria == "esquina" and not q["esquina_indicada_pela_malha"]):
                continue
            p = features[k]["properties"]
            q["ocupacao_retangulo_minimo"] = round(regularidade, 5)
            coords = [[round(x, 6), round(y, 6)] for x, y in g.exterior.coords]
            frente = [coords[q["frentes"][0]["aresta"]], coords[q["frentes"][0]["aresta"] + 1]]
            lotes.append({"id": f"SC-completo-{k}", "lid": p.get("lid"), "poligono_utm": coords,
                          "frente": frente, "area_m2": round(Polygon(coords).area, 3),
                          "zona_id": None, "relevo": None, "areas_especiais": [], "crs": "EPSG:31983", "categoria": categoria,
                          "centroide_lonlat": [round(v, 8) for v in GEO.transform(g.centroid.x, g.centroid.y)],
                          "distancia_centro_referencia_m": round(float(dist[k]), 1),
                          "fonte": {"arquivo": BASES[1], "indice_feicao_zero_based": int(k), "propriedades": p},
                          "qualidade": q, "conferido": False,
                          "observacoes": "Geometria de ensaio derivada da maquete; não comprova lote cadastral, disponibilidade ou aptidão legal. Frente e eventual esquina inferidas da malha de asfalto, sem vistoria ou nome de rua confirmado. LID ausente na origem; ID local usa índice da feição. Relevo e zona pendentes. " + ("Há mais de uma frente candidata; o motor deve considerar as demais testadas antes de validar recuos." if len(q["frentes"]) > 1 else "")})
            usados.add(k)
            escolhidos += 1
            print("SELECIONADO", categoria, int(k), round(g.area, 2), p.get("loteamento"), round(float(dist[k])), flush=True)
            if escolhidos == quantidade:
                break
        if escolhidos != quantidade:
            raise ValueError(f"Faltam candidatos aprovados na categoria {categoria}: {escolhidos}/{quantidade}")
    checar(lotes)
    relatorio["selecionados"] = [l["id"] for l in lotes]
    relatorio["self_check"] = "5 IDs únicos; categorias; área; validade; frente na borda; projeção ida/volta; esquina; sobreposição de vizinhos e entre pilotos."
    gravar(OUT / "dados/qualidade-lotes.json", relatorio)
    gravar(OUT / "lotes-piloto.json", lotes)
    print("OK: auditoria e cinco lotes escritos; self-check passou.", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--testar", action="store_true")
    if parser.parse_args().testar:
        checar(ler("viabilidade/terreno/lotes-piloto.json"))
        print("OK: cinco lotes existentes verificados, sem regravar.")
    else:
        main()

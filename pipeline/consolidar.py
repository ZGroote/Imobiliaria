# -*- coding: utf-8 -*-
"""Junta os geojson por planta num unico dataset de lotes da cidade.
Arbitra por QUADRA: quando duas plantas cobrem a mesma quadra, fica a de melhor
encaixe. Quadra que nenhuma planta cobriu recebe os lotes sinteticos de
lotes_saocarlos.geojson (fallback), marcados como tal."""
import json, os, glob, math
from collections import defaultdict
import numpy as np
from shapely.geometry import shape, mapping
from shapely.ops import transform as sht
from shapely.strtree import STRtree
from pyproj import Transformer

import os as _os, sys as _sys
# a raiz fica UM nivel acima: o script saiu de `v7/pipeline/` pra `pipeline/`
_sys.path.insert(0, _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "..")))
from padrao.cidade import carrega as _carrega
_CID = _carrega(_os.environ.get("CIDADE", "sao-carlos"))
# Estes dois gravavam na RAIZ enquanto o pipeline lia de v7/dados/ -- alguem movia o
# arquivo a mao entre uma etapa e a outra, e isso nao aparecia em lugar nenhum.
# Agora o destino sai do JSON da cidade, igual ao resto.
# A raiz sai do proprio arquivo, e nao do caminho absoluto da maquina de quem
# escreveu: este script mora em `pipeline/`, um nivel abaixo da raiz.
PROJ = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))).replace(chr(92), "/") + "/"
PIPE = PROJ + "plantas_pipeline/"
FWD = Transformer.from_crs("EPSG:4326", "EPSG:29193", always_xy=True)
def toutm(x, y, z=None): return FWD.transform(x, y)

# "dentro": fracao da quadra-do-desenho que cai dentro da quadra oficial.
# 1,0 = o desenho inteiro caiu no lugar certo. Abaixo de 0,7 nao da pra confiar.
ENC_MIN  = float(os.environ.get("ENC_MIN", "0.70"))
FALLBACK = os.environ.get("FALLBACK", "0") == "1"   # incluir lote sintetico onde nao houve planta

def main(saida=None):
    saida = saida or _CID.caminho("lotes_oficiais")
    rel = {r["arquivo"]: r for r in json.load(open(PIPE + "relatorio_extracao.json", encoding="utf-8"))}
    q = json.load(open(PROJ + "quadras_saocarlos.geojson", encoding="utf-8"))
    qg = [sht(toutm, shape(f["geometry"])) for f in q["features"]]
    qid = [f["properties"].get("id", i) for i, f in enumerate(q["features"])]
    tree = STRtree(qg)

    # lote -> quadra, guardando de qual planta veio e com que qualidade
    porq = defaultdict(list)          # quadra -> lista de (encaixe, arquivo, feature_utm, props)
    lidos = 0
    for fn in sorted(glob.glob(PIPE + "saida/geo/*.geojson")):
        arq = os.path.basename(fn).replace(".geojson", "")
        r = rel.get(arq + ".tif") or rel.get(arq + ".pdf") or {}
        enc = r.get("enc_quadra") or 0.0
        if enc < ENC_MIN: continue
        try: d = json.load(open(fn, encoding="utf-8"))
        except Exception: continue
        for f in d["features"]:
            g = sht(toutm, shape(f["geometry"]))
            if not g.is_valid: g = g.buffer(0)
            if g.is_empty: continue
            rp = g.representative_point()
            for k in tree.query(rp):
                if qg[k].contains(rp):
                    porq[qid[k]].append((enc, arq, g, f["properties"], r.get("loteamento")))
                    lidos += 1
                    break
    print("lotes lidos das plantas: %d em %d quadras" % (lidos, len(porq)))

    area_q = {qid[k]: qg[k].area for k in range(len(qg))}
    feats = []
    cob = {}
    for qi, itens in porq.items():
        # arbitra: fica so a planta de melhor encaixe nesta quadra
        melhor = max(itens, key=lambda t: t[0])[1]
        soma = 0.0
        for enc, arq, g, pr, lote in itens:
            if arq == melhor:
                feats.append((qi, arq, enc, lote, g, pr))
                soma += g.area
        # quanto da quadra oficial os lotes extraidos cobrem: QA sem precisar de gabarito
        cob[qi] = soma / max(area_q.get(qi, 1.0), 1.0)
    print("lotes apos arbitragem por quadra: %d" % len(feats))

    INV = Transformer.from_crs("EPSG:29193", "EPSG:4326", always_xy=True)
    out = []
    cobertas = set(q for q, *_ in feats)
    for qi, arq, enc, lote, g, pr in feats:
        gw = sht(lambda x, y, z=None: INV.transform(x, y), g)
        out.append({"type": "Feature", "geometry": mapping(gw),
                    "properties": {"area_m2": pr.get("area_m2"), "frente_m": pr.get("frente_m"),
                                   "fundo_m": pr.get("fundo_m"), "quadra": qi, "loteamento": lote,
                                   "planta": arq, "encaixe": round(enc, 3),
                                   "cobertura_quadra": round(cob.get(qi, 0), 3), "fonte": "planta"}})

    # fallback sintetico nas quadras que nenhuma planta cobriu
    nfb = 0
    try:
        if not FALLBACK: raise FileNotFoundError
        syn = json.load(open(PROJ + "lotes_saocarlos.geojson", encoding="utf-8"))
        for f in syn["features"]:
            qq = f["properties"].get("quadra")
            if qq in cobertas: continue
            g = shape(f["geometry"])
            out.append({"type": "Feature", "geometry": mapping(g),
                        "properties": {"area_m2": round(sht(toutm, g).area, 2),
                                       "quadra": qq, "planta": None, "encaixe": None,
                                       "fonte": "sintetico"}})
            nfb += 1
    except FileNotFoundError:
        pass
    print("fallback sintetico: %d lotes" % nfb)
    json.dump({"type": "FeatureCollection", "features": out}, open(saida, "w"))
    print("-> %s | total %d lotes (%d de planta, %d sinteticos)" % (saida, len(out), len(out) - nfb, nfb))
    print("   quadras cobertas por planta: %d de %d" % (len(cobertas), len(qg)))
    if cob:
        v = np.array(sorted(cob.values()))
        print("   cobertura lote/quadra: mediana %.0f%% | %d quadras abaixo de 40%% | %d acima de 95%%"
              % (100 * np.median(v), int((v < 0.40).sum()), int((v > 0.95).sum())))
        json.dump({str(k): round(x, 3) for k, x in cob.items()},
                  open(PIPE + "cobertura_por_quadra.json", "w"))

if __name__ == "__main__":
    main()

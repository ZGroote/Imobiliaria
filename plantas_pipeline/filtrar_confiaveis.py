# -*- coding: utf-8 -*-
"""Aplica a regra do usuario: A PLANTA E O GABARITO. Fica so o lote que
(1) veio de planta que encaixou (>= ENC_MIN), (2) tem medida plausivel de terreno e
(3) bate com um dos tamanhos padrao do proprio loteamento. Quem sobra fora disso e
erro de extracao - quadra inteira, caco, celula fundida."""
import json, os
import numpy as np
PROJ = "C:/Users/respawn/Desktop/imobiliaria/"
PIPE = PROJ + "plantas_pipeline/"
SAUDE_MIN = float(os.environ.get("SAUDE_MIN", "0.50"))   # % minimo de lotes no padrao

def main():
    d = json.load(open(PROJ + "lotes_oficiais_saocarlos.geojson", encoding="utf-8"))
    from collections import defaultdict
    por = defaultdict(list)
    for f in d["features"]: por[f["properties"].get("loteamento")].append(f)
    saude = {k: (sum(1 for f in v if f["properties"].get("padrao_lote")) / len(v)) for k, v in por.items()}
    doentes = sorted([k for k, s in saude.items() if s < SAUDE_MIN], key=lambda k: saude[k])

    bons = [f for f in d["features"]
            if f["properties"].get("padrao_lote") and saude.get(f["properties"].get("loteamento"), 0) >= SAUDE_MIN]
    json.dump({"type": "FeatureCollection", "features": bons},
              open(PROJ + "lotes_confiaveis_saocarlos.geojson", "w"))
    A = np.array([f["properties"]["area_m2"] for f in bons])
    F = np.array([f["properties"].get("frente_m") or 0 for f in bons])
    print("de %d lotes extraidos -> %d confiaveis (%.0f%%)" % (len(d["features"]), len(bons),
          100.0 * len(bons) / max(len(d["features"]), 1)))
    print("loteamentos: %d bons | %d descartados por extracao ruim (<%.0f%% no padrao)"
          % (len(por) - len(doentes), len(doentes), 100 * SAUDE_MIN))
    if len(A):
        print("area: mediana %.0f m2 | p25 %.0f | p75 %.0f | frente mediana %.1f m"
              % (np.median(A), np.percentile(A, 25), np.percentile(A, 75), np.median(F[F > 0])))
    print("quadras cobertas: %d" % len({f["properties"]["quadra"] for f in bons}))
    print("\ndescartados (loteamento com extracao ruim):")
    for k in doentes[:12]:
        print("  %5.1f%%  %-42.42s n=%d" % (100 * saude[k], k or "?", len(por[k])))
    print("\n-> lotes_confiaveis_saocarlos.geojson")

if __name__ == "__main__":
    main()

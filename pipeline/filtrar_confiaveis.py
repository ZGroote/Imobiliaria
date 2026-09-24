# -*- coding: utf-8 -*-
"""Aplica a regra do usuario: A PLANTA E O GABARITO. Fica so o lote que
(1) veio de planta que encaixou (>= ENC_MIN), (2) tem medida plausivel de terreno e
(3) bate com um dos tamanhos padrao do proprio loteamento. Quem sobra fora disso e
erro de extracao - quadra inteira, caco, celula fundida."""
import json, os
import numpy as np
import sys as _sys
# a raiz fica UM nivel acima: o script saiu de `v7/pipeline/` pra `pipeline/`
_sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")))
from padrao.cidade import carrega as _carrega
_CID = _carrega(os.environ.get("CIDADE", "sao-carlos"))
# Gravava na RAIZ enquanto o pipeline lia de v7/dados/ -- alguem movia o arquivo a mao
# entre uma etapa e a outra, e isso nao aparecia em lugar nenhum. Agora o destino sai
# do JSON da cidade, igual ao resto.
# A raiz sai do proprio arquivo, e nao do caminho absoluto da maquina de quem
# escreveu: este script mora em `pipeline/`, um nivel abaixo da raiz.
PROJ = os.path.dirname(os.path.dirname(os.path.abspath(__file__))).replace(chr(92), "/") + "/"
PIPE = PROJ + "plantas_pipeline/"
SAUDE_MIN = float(os.environ.get("SAUDE_MIN", "0.50"))   # % minimo de lotes no padrao

def main():
    d = json.load(open(_CID.caminho("lotes_oficiais"), encoding="utf-8"))
    from collections import defaultdict
    por = defaultdict(list)
    for f in d["features"]: por[f["properties"].get("loteamento")].append(f)
    saude = {k: (sum(1 for f in v if f["properties"].get("padrao_lote")) / len(v)) for k, v in por.items()}
    doentes = sorted([k for k, s in saude.items() if s < SAUDE_MIN], key=lambda k: saude[k])

    bons = [f for f in d["features"]
            if f["properties"].get("padrao_lote") and saude.get(f["properties"].get("loteamento"), 0) >= SAUDE_MIN]
    json.dump({"type": "FeatureCollection", "features": bons},
              open(_CID.caminho("lotes_planta"), "w"))
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
    print("\n-> %s" % _CID.caminho("lotes_planta"))

if __name__ == "__main__":
    main()

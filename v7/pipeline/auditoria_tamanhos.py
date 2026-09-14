# -*- coding: utf-8 -*-
"""A PLANTA E O GABARITO: dentro de um loteamento o lote tem um punhado de tamanhos
padrao. Lote muito fora do padrao do proprio loteamento e erro de extracao (celula
fundida ou pedaco solto), nao lote de verdade. Este script mede isso e marca."""
import json, csv, os
from collections import defaultdict
import numpy as np

import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")))
from padrao.cidade import carrega as _carrega
_CID = _carrega(os.environ.get("CIDADE", "sao-carlos"))
PROJ = "C:/Users/respawn/Desktop/imobiliaria/"
PIPE = PROJ + "plantas_pipeline/"

def padroes(fr, fu, ar, passo=0.5, cobre=0.65, teto=4):
    """Tamanhos padrao do loteamento: os pares (frente, fundo) mais frequentes,
    pesados por AREA (assim fragmento e bolha nao viram 'padrao'). Um loteamento
    pode ter 2 ou 3 tamanhos legitimos (lote de meio de quadra, de esquina, comercial)."""
    if len(fr) == 0: return []
    k = np.stack([np.round(fr / passo) * passo, np.round(fu / passo) * passo], 1)
    chaves, inv = np.unique(k, axis=0, return_inverse=True)
    peso = np.bincount(inv, weights=ar, minlength=len(chaves))
    ordem = np.argsort(-peso)
    tot = peso.sum(); acc = 0.0; out = []
    for i in ordem[:teto]:
        out.append((float(chaves[i][0]), float(chaves[i][1])))
        acc += peso[i]
        if acc / max(tot, 1e-9) >= cobre: break
    return out

# Portao absoluto: terreno urbano nao tem 50 m de frente nem 200 m de fundo.
# O que passa disso e QUADRA INTEIRA extraida como se fosse um lote (a planta tinha
# a divisa fina demais e o vetorizador nao achou). Tem que sair antes de calcular
# o padrao, senao a propria quadra vira "o padrao do loteamento".
FR_MAX, FU_MAX, AR_MAX = 40.0, 100.0, 4000.0
FR_MIN, FU_MIN, AR_MIN = 3.0, 8.0, 50.0

def plausivel(fr, fu, ar):
    return ((fr >= FR_MIN) & (fr <= FR_MAX) & (fu >= FU_MIN) & (fu <= FU_MAX)
            & (ar >= AR_MIN) & (ar <= AR_MAX))

# Lia e escrevia na RAIZ enquanto o pipeline usava v7/dados/ -- e o filtro seguinte
# encontrava o arquivo sem `padrao_lote` e devolvia zero lote, calado.
def main(entrada=None, saida=None, csv_path=PIPE + "auditoria_tamanhos.csv", tol=0.25):
    entrada = entrada or _CID.caminho("lotes_oficiais")
    saida = saida or _CID.caminho("lotes_oficiais")
    d = json.load(open(entrada, encoding="utf-8"))
    por = defaultdict(list)
    for f in d["features"]:
        por[f["properties"].get("loteamento")].append(f)

    linhas = []
    for lote, fs in sorted(por.items(), key=lambda kv: -len(kv[1])):
        fr = np.array([f["properties"].get("frente_m") or 0 for f in fs])
        fu = np.array([f["properties"].get("fundo_m") or 0 for f in fs])
        ar = np.array([f["properties"].get("area_m2") or 0 for f in fs])
        pl = plausivel(fr, fu, ar)
        pads = padroes(fr[pl], fu[pl], ar[pl]) if pl.any() else []
        ok = np.zeros(len(fs), bool)
        for pf, pu in pads:
            ok |= (np.abs(fr - pf) <= tol * pf) & (np.abs(fu - pu) <= tol * pu)
        ok &= pl
        mf, mu = (pads[0] if pads else (None, None))
        for f, k, q in zip(fs, ok, pl):
            f["properties"]["padrao_lote"] = bool(k)
            f["properties"]["plausivel"] = bool(q)
            f["properties"]["frente_padrao_m"] = mf
            f["properties"]["fundo_padrao_m"] = mu
        linhas.append([lote, len(fs), mf, mu, round((mf or 0) * (mu or 0), 1),
                       round(float(np.median(ar)), 1), int(ok.sum()),
                       round(100.0 * ok.sum() / len(fs), 1),
                       " | ".join("%.1fx%.1f" % p for p in pads)])

    json.dump(d, open(saida, "w"))
    with open(csv_path, "w", newline="", encoding="utf-8-sig") as h:
        w = csv.writer(h, delimiter=";")
        w.writerow(["loteamento", "lotes", "frente_padrao_m", "fundo_padrao_m",
                    "area_padrao_m2", "area_mediana_m2", "no_padrao", "pct_no_padrao", "tamanhos_padrao"])
        w.writerows(linhas)

    n = len(d["features"])
    pl = sum(1 for f in d["features"] if f["properties"]["plausivel"])
    print("lotes: %d | com medida plausivel de terreno: %d (%.1f%%) - o resto e quadra inteira ou caco"
          % (n, pl, 100.0 * pl / max(n, 1)))
    ok = sum(1 for f in d["features"] if f["properties"]["padrao_lote"])
    print("lotes: %d | dentro do padrao do proprio loteamento (+-%.0f%%): %d (%.1f%%)"
          % (n, 100 * tol, ok, 100.0 * ok / max(n, 1)))
    p = np.array([l[7] for l in linhas])
    print("loteamentos: %d | com >=80%% dos lotes no padrao: %d | com <50%%: %d"
          % (len(linhas), int((p >= 80).sum()), int((p < 50).sum())))
    print("\npiores (menor %% no padrao, entre os com 100+ lotes):")
    for l in sorted([x for x in linhas if x[1] >= 100], key=lambda x: x[7])[:10]:
        print("  %5.1f%%  %-38.38s n=%-5d  %s" % (l[7], l[0] or "?", l[1], l[8]))
    print("\n-> %s" % os.path.basename(csv_path))

if __name__ == "__main__":
    main()

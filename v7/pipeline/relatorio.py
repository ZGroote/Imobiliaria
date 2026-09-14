# -*- coding: utf-8 -*-
"""Resumo legivel do que saiu da extracao + CSV por loteamento."""
import json, csv, os, sys
import numpy as np
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")))
from padrao.cidade import carrega as _carrega
_CID = _carrega(os.environ.get("CIDADE", "sao-carlos"))
PIPE = "C:/Users/respawn/Desktop/imobiliaria/plantas_pipeline/"
# O CSV gravava em plantas_pipeline/ enquanto o pipeline (etapa 0d) esperava
# `fontes.relatorio_plantas` -- entao a etapa NUNCA ficava fresca e ninguem via.
CSV = _CID.caminho("relatorio_plantas")

def main():
    r = json.load(open(PIPE + "relatorio_extracao.json", encoding="utf-8"))
    esc = {}
    try: esc = json.load(open(PIPE + "escalas_ocr.json", encoding="utf-8"))
    except FileNotFoundError: pass
    ok = [x for x in r if x["status"] == "ok"]
    ruim = [x for x in r if x["status"] != "ok"]
    iq = np.array([x.get("enc_quadra") or 0 for x in ok])
    print("PLANTAS: %d processadas | %d ok | %d falharam" % (len(r), len(ok), len(ruim)))
    print("LOTES:   %d extraidos e georreferenciados" % sum(x["lotes"] for x in ok))
    print("\nqualidade do encaixe (IoU mediano por quadra):")
    for lo, hi, rot in [(0.95, 9, "cravado   (>= 0,95)"), (0.85, 0.95, "bom       (0,85-0,95)"),
                        (0.70, 0.85, "aceitavel (0,70-0,85)"), (-1, 0.70, "descartado(< 0,70)")]:
        m = (iq >= lo) & (iq < hi)
        print("  %s : %3d plantas | %6d lotes" % (rot, m.sum(), sum(x["lotes"] for x, k in zip(ok, m) if k)))
    conf = [(x, esc.get(x["arquivo"])) for x in ok]
    div = [(x, e) for x, e in conf if e and x.get("escala") and abs(x["escala"] - e) / e > 0.05]
    lidas = sum(1 for x, e in conf if e)
    print("\nescala: selo lido por OCR em %d/%d plantas | %d divergem da geometria (>5%%)"
          % (lidas, len(ok), len(div)))
    if ruim:
        print("\nfalhas:")
        import collections
        for k, n in collections.Counter(x["status"] for x in ruim).most_common():
            print("  %-18s %d" % (k, n))
    os.makedirs(os.path.dirname(CSV), exist_ok=True)
    with open(CSV, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["arquivo", "loteamento", "status", "lotes", "area_mediana_m2", "area_total_m2",
                    "frente_m", "fundo_m", "escala_geom", "escala_selo", "encaixe", "nota_escala", "erro_m", "descartados"])
        for x in sorted(r, key=lambda x: -(x.get("enc_quadra") or 0)):
            w.writerow([x["arquivo"], x.get("loteamento"), x["status"], x.get("lotes"),
                        x.get("area_mediana"), x.get("area_total"), x.get("frente"), x.get("fundo"),
                        x.get("escala"), esc.get(x["arquivo"]), x.get("enc_quadra"),
                        x.get("erro_m"), x.get("descartados")])
    print("\n-> relatorio_extracao.csv")

if __name__ == "__main__":
    main()

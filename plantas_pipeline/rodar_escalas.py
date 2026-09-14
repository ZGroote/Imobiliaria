# -*- coding: utf-8 -*-
"""Le a escala do selo de todas as plantas da fila (paralelo, um processo por planta)."""
import json, os, subprocess, sys, re
from concurrent.futures import ThreadPoolExecutor
PROJ = "C:/Users/respawn/Desktop/imobiliaria/"
PIPE = PROJ + "plantas_pipeline/"
def uma(arq):
    p = PROJ + "plantas_openplots/" + arq
    try:
        r = subprocess.run([sys.executable, PIPE + "ler_escala.py", p],
                           capture_output=True, text=True, timeout=900)
        m = re.search(r"-> (\d+)", r.stdout or "")
        return arq, (int(m.group(1)) if m else None)
    except Exception:
        return arq, None
def main():
    cas = json.load(open(PIPE + "casamento_nomes.json", encoding="utf-8"))
    fila = [r["arquivo"] for r in cas if r["match"] and r["quadras"] >= 4]
    out = {}
    if os.path.exists(PIPE + "escalas_ocr.json"):
        out = json.load(open(PIPE + "escalas_ocr.json", encoding="utf-8"))
    fila = [a for a in fila if a not in out]
    print("plantas pra ler: %d" % len(fila), flush=True)
    with ThreadPoolExecutor(max_workers=6) as ex:
        for n, (a, e) in enumerate(ex.map(uma, fila), 1):
            out[a] = e
            print("[%3d/%d] %-14s escala do selo: %s" % (n, len(fila), a, e), flush=True)
            json.dump(out, open(PIPE + "escalas_ocr.json", "w"), indent=1)
    achou = sum(1 for v in out.values() if v)
    print("\nlidas: %d de %d (%.0f%%)" % (achou, len(out), 100 * achou / max(len(out), 1)))
if __name__ == "__main__":
    main()

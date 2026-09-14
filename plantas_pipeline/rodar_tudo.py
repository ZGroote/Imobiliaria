# -*- coding: utf-8 -*-
"""Roda vetorizacao + georreferencia em todas as plantas do OpenPlots que tenham
loteamento casado e quadra oficial. Um subprocesso por planta (isola estouro de
memoria e travamento); grava um geojson por planta + um relatorio."""
import json, os, re, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

PROJ = "C:/Users/respawn/Desktop/imobiliaria/"
PIPE = PROJ + "plantas_pipeline/"
MAPS = PROJ + "plantas_openplots/"
SAI  = PIPE + "saida/geo/"
TMP  = PIPE + "saida/tmp/"
PY_  = sys.executable
WORKERS = int(os.environ.get("WORKERS", "6"))
TIMEOUT = int(os.environ.get("TIMEOUT", "1800"))

def num(txt, pat, d=None):
    m = re.search(pat, txt)
    return float(m.group(1)) if m else d

def uma(reg):
    arq = reg["arquivo"]; base = os.path.splitext(arq)[0]
    src = MAPS + arq
    if not os.path.exists(src):
        return dict(arquivo=arq, status="arquivo ausente")
    cel = TMP + base + "_lotes.json"; geo = SAI + base + ".geojson"
    t0 = time.time()
    try:
        if os.path.exists(cel) and os.environ.get("REUSAR", "1") == "1":
            r1 = subprocess.CompletedProcess([], 0, stdout="(vetorizacao reaproveitada)", stderr="")
        else:
            r1 = subprocess.run([PY_, PIPE + "vetorizar_planta.py", src, "1000"],
                                capture_output=True, text=True, timeout=TIMEOUT, cwd=TMP)
        if r1.returncode:
            return dict(arquivo=arq, loteamento=reg["match"], status="falha vetorizar",
                        erro=(r1.stderr or "")[-200:])
        arg4 = [str(reg["escala_selo"])] if reg.get("escala_selo") else []
        r2 = subprocess.run([PY_, PIPE + "georreferenciar_planta.py", cel, reg["match"], geo] + arg4,
                            capture_output=True, text=True, timeout=TIMEOUT, cwd=TMP)
        if r2.returncode:
            return dict(arquivo=arq, loteamento=reg["match"], status="falha georref",
                        erro=((r2.stderr or "") + (r2.stdout or ""))[-200:])
    except subprocess.TimeoutExpired:
        return dict(arquivo=arq, loteamento=reg["match"], status="timeout")
    o = r1.stdout + r2.stdout
    return dict(arquivo=arq, loteamento=reg["match"], status="ok",
                segundos=round(time.time() - t0, 1),
                lotes=int(num(o, r"LOTES GEO (\d+)", 0) or 0),
                area_mediana=num(o, r"area mediana ([\d.]+)"),
                area_total=num(o, r"soma (\d+)"),
                frente=num(o, r"frente med ([\d.]+)"), fundo=num(o, r"fundo med ([\d.]+)"),
                escala=num(o, r"escala implicita do desenho: 1:(\d+)"),
                escala_selo=reg.get("escala_selo"),
                iou_global=num(o, r"IoU ([\d.]+)"),
                enc_quadra=num(o, r"dentro mediano ([\d.]+)"),
                nota=num(o, r"\| nota ([\d.]+)"),
                erro_m=num(o, r"erro medio ([\d.]+) m"),
                quadras_casadas=num(o, r"encaixe: (\d+)/"),
                descartados=int(num(o, r"fora de quadra: (\d+)", 0) or 0))

def main():
    os.makedirs(SAI, exist_ok=True); os.makedirs(TMP, exist_ok=True)
    cas = json.load(open(PIPE + "casamento_nomes.json", encoding="utf-8"))
    try: esc = json.load(open(PIPE + "escalas_ocr.json", encoding="utf-8"))
    except FileNotFoundError: esc = {}
    for r in cas: r["escala_selo"] = esc.get(r["arquivo"])
    fila = [r for r in cas if r["match"] and r["quadras"] >= 4]
    print("plantas na fila: %d (workers=%d)" % (len(fila), WORKERS), flush=True)
    res = []
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        for n, r in enumerate(ex.map(uma, fila), 1):
            res.append(r)
            print("[%3d/%d] %-14s %-16s lotes=%-6s enc=%-6s %s"
                  % (n, len(fila), r["arquivo"], r["status"], r.get("lotes", "-"),
                     r.get("enc_quadra", "-"), (r.get("loteamento") or "")[:38]), flush=True)
            json.dump(res, open(PIPE + "relatorio_extracao.json", "w", encoding="utf-8"),
                      ensure_ascii=False, indent=1)
    ok = [r for r in res if r["status"] == "ok"]
    print("\nok: %d/%d | lotes totais: %d" % (len(ok), len(res), sum(r["lotes"] for r in ok)))

if __name__ == "__main__":
    main()

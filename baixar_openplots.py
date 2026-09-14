# -*- coding: utf-8 -*-
"""Baixa TODAS as plantas/mapas do modulo OpenPlots (Habitacao/SigaSC de Sao Carlos).
Fonte: http://geo.saocarlos.sp.gov.br/habitacao/OpenPlots/index/0
Retomavel: pula arquivo que ja existe com tamanho > 0."""
import json, os, re, sys, time, html, urllib.request, urllib.error

SRC_HTML = r"C:\Users\respawn\AppData\Local\Temp\claude\C--Users-respawn-Desktop-imobiliaria\6690fe31-6305-41d2-8705-fad24dcefac6\scratchpad\openplots.html"
OUT      = os.path.join(os.path.dirname(os.path.abspath(__file__)), "plantas_openplots")
UA       = {"User-Agent": "Mozilla/5.0"}
INDEX    = os.path.join(OUT, "manifest.json")

def fetch_listing():
    """Rele o HTML local; se nao existir, baixa do site."""
    if os.path.exists(SRC_HTML):
        return open(SRC_HTML, encoding="utf-8", errors="replace").read()
    u = "http://geo.saocarlos.sp.gov.br/habitacao/OpenPlots/index/0"
    return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=120).read().decode("utf-8", "replace")

ROW = re.compile(r"<tr>(.*?)</tr>", re.S | re.I)
MAP = re.compile(r"files/plots/maps/([\w\-\.]+\.(?:tif|pdf))", re.I)
CEL = re.compile(r"<td[^>]*>(.*?)</td>", re.S | re.I)

def parse(doc):
    """Uma linha pode listar VARIAS pranchas (000025, 000025A, 000025B) -> findall, nao search."""
    itens, vistos = [], set()
    def add(arq, rot):
        if arq in vistos:
            return
        vistos.add(arq)
        itens.append({
            "arquivo": arq,
            "rotulo": rot,
            "geral": bool(re.match(r"^000[1-9]-", arq)),   # 0001-1.pdf etc = mapas gerais da cidade
            "url": "http://geo.saocarlos.sp.gov.br/habitacao/files/plots/maps/" + arq,
        })
    for row in ROW.findall(doc):
        achados = MAP.findall(row)
        if not achados:
            continue
        cels = [html.unescape(re.sub(r"<[^>]+>", "", c)).strip() for c in CEL.findall(row)]
        cels = [c.replace(u" ", " ").strip() for c in cels]
        rot = next((c for c in cels if c and not c.isdigit()), achados[0])
        for arq in achados:
            add(arq, rot)
    for arq in dict.fromkeys(MAP.findall(doc)):   # varredura final: nada escapa
        add(arq, "(sem rotulo na linha)")
    return itens

def baixar(it, tent=3):
    dst = os.path.join(OUT, it["arquivo"])
    if os.path.exists(dst) and os.path.getsize(dst) > 0:
        return os.path.getsize(dst), "ja tinha"
    for k in range(tent):
        try:
            with urllib.request.urlopen(urllib.request.Request(it["url"], headers=UA), timeout=300) as r:
                dados = r.read()
            if not dados:
                raise IOError("vazio")
            tmp = dst + ".part"
            open(tmp, "wb").write(dados)
            os.replace(tmp, dst)
            return len(dados), "ok"
        except Exception as e:
            if k == tent - 1:
                return 0, "FALHA: %s" % e
            time.sleep(2 * (k + 1))

def main():
    os.makedirs(OUT, exist_ok=True)
    itens = parse(fetch_listing())
    json.dump(itens, open(INDEX, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("na listagem: %d arquivos (%d gerais, %d loteamentos)" %
          (len(itens), sum(i["geral"] for i in itens), sum(not i["geral"] for i in itens)))
    total = falhas = 0
    for n, it in enumerate(itens, 1):
        tam, st = baixar(it)
        total += tam
        if st.startswith("FALHA"):
            falhas += 1
        print("[%3d/%d] %-14s %9s  %-40.40s %s" % (n, len(itens), it["arquivo"], "%.1f MB" % (tam / 1e6), it["rotulo"], st), flush=True)
    print("\nbaixado/presente: %.1f MB | falhas: %d" % (total / 1e6, falhas))

if __name__ == "__main__":
    main()

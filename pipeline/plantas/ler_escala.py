# -*- coding: utf-8 -*-
"""Le a escala escrita no selo da planta ('ESCALA 1:2000'). O encaixe geometrico
erra a escala em desenho com poucas quadras; o selo e a verdade."""
import re, sys, json, os
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None

_ocr = None
def ocr():
    global _ocr
    if _ocr is None:
        from rapidocr_onnxruntime import RapidOCR
        _ocr = RapidOCR()
    return _ocr

PAD = re.compile(r"(?:ESC(?:ALA)?)\W{0,6}(\d{1,2})\s*[:;/.\-]\s*([\d. ]{3,7})", re.I)

def limpa(n):
    n = re.sub(r"[^0-9]", "", n)
    return int(n) if n else None

# escala de prancha de loteamento. 1:5000/1:10000 no desenho e sempre o
# quadro "SITUACAO", nao o projeto -> fica de fora de proposito.
PLAUSIVEIS = [250, 500, 750, 1000, 1250, 1500, 2000, 2500]

def texto(im):
    """OCR em ladrilhos, sem reduzir demais: o texto do selo tem ~40 px de altura."""
    W, H = im.size
    out = []
    passo, lado = 1400, 1600
    for y in range(0, max(H - 200, 1), passo):
        for x in range(0, max(W - 200, 1), passo):
            t = im.crop((x, y, min(x + lado, W), min(y + lado, H)))
            if min(t.size) < 60: continue
            r = ocr()(np.array(t.convert("RGB")))
            if r and r[0]: out.append(" ".join(u[1] for u in r[0]))
    return " ".join(out)

def acha(txt):
    t = txt.replace("l", "1").replace("I", "1").replace("|", "1").replace("O", "0")
    v = []
    for a, b in PAD.findall(t):
        n = limpa(b)
        if n and a == "1" and 100 <= n <= 20000: v.append(n)
    return v

def escala_da_planta(path, dbg=False):
    if path.lower().endswith(".pdf"):
        import pypdfium2 as pdfium
        im = pdfium.PdfDocument(path)[0].render(scale=200 / 72.0).to_pil().convert("L")
    else:
        im = Image.open(path).convert("L")
    W, H = im.size
    faixas = [("rodape", im.crop((int(W * 0.30), int(H * 0.80), W, H))),
              ("direita", im.crop((int(W * 0.66), int(H * 0.35), W, H))),
              ("topo-dir", im.crop((int(W * 0.66), 0, W, int(H * 0.40)))),
              ("esq-baixo", im.crop((0, int(H * 0.80), int(W * 0.40), H)))]
    todos = []
    for nome, f in faixas:
        t = texto(f)
        a = acha(t)
        if dbg: print("  %-10s %s | %s" % (nome, a, t[:150]))
        todos += a
        if any(x in PLAUSIVEIS for x in a): break
    bons = [x for x in todos if x in PLAUSIVEIS]
    if not bons: return None          # sem palpite e melhor que palpite errado
    from collections import Counter
    return sorted(Counter(bons).items(), key=lambda kv: (-kv[1], kv[0]))[0][0]

if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    dbg = "-v" in sys.argv
    for p in args:
        try: print(os.path.basename(p), "->", escala_da_planta(p, dbg=dbg), flush=True)
        except Exception as e: print(os.path.basename(p), "-> erro:", e, flush=True)

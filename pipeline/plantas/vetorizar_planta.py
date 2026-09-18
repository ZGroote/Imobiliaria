# -*- coding: utf-8 -*-
"""Vetoriza planta urbanistica do OpenPlots -> poligonos de lote em metros.
1) celulas brancas fechadas  2) watershed sobre o traco (tira a espessura da linha)
3) funde as bolhas de numero de lote  4) filtra o que e lote (vizinhanca de area parecida)"""
import sys, os, json, math
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from scipy.spatial import cKDTree
import cv2

Image.MAX_IMAGE_PIXELS = None

DPI_PDF = 200.0

def carregar(p):
    if p.lower().endswith(".pdf"):
        import pypdfium2 as pdfium
        pag = pdfium.PdfDocument(p)[0]
        im = pag.render(scale=DPI_PDF / 72.0).to_pil().convert("L")
        return np.array(im) < 160, DPI_PDF          # True = traco
    im = Image.open(p)
    dpi = float(im.tag_v2.get(282, 200)) if hasattr(im, "tag_v2") else 200.0
    return ~np.array(im.convert("1")), dpi

def rotular(tinta):
    lab, n = ndi.label(~tinta)                      # 4-conex
    borda = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]).tolist()))
    return lab, n, borda

def engordar(lab, tinta):
    """Cada pixel de traco vai pra celula mais proxima: a divisa cai no eixo da linha."""
    _, idx = ndi.distance_transform_edt(tinta, return_indices=True)
    out = lab.copy()
    out[tinta] = lab[idx[0][tinta], idx[1][tinta]]
    return out

def redonda(mask_sl):
    """quao bem a celula preenche seu circulo circunscrito (1 = disco perfeito).
    Robusto aos digitos que encostam no anel e serrilham o contorno."""
    m = ndi.binary_fill_holes(mask_sl)
    c, _ = cv2.findContours(m.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not c: return 0.0
    c = max(c, key=cv2.contourArea)
    (_, _), r = cv2.minEnclosingCircle(c)
    return 0.0 if r <= 0 else float(m.sum()) / (math.pi * r * r)

def main(path, esc=1000.0):
    tinta, dpi = carregar(path)
    mpp = (25.4 / dpi) / 1000.0 * esc               # metros de terreno por pixel
    H, W = tinta.shape
    print("%s  %dx%d  %g dpi  1:%g -> %.4f m/px" % (os.path.basename(path), W, H, dpi, esc, mpp))

    lab, n, borda = rotular(tinta)
    lab = engordar(lab, tinta)
    cont = np.bincount(lab.ravel(), minlength=n + 1)
    objs = ndi.find_objects(lab)
    ppm2 = 1.0 / (mpp * mpp)

    # --- bolhas de numero: celula pequena e redonda
    bolha = []
    cand = [i for i in range(1, n + 1) if i not in borda and 2 * ppm2 <= cont[i] <= 75 * ppm2]
    for i in cand:
        sl = objs[i - 1]
        m = lab[sl] == i
        alt = m.shape[0] / max(m.shape[1], 1)
        if not (0.6 < alt < 1.7):        # bolha e sempre quase quadrada no bbox
            continue
        if redonda(m) > 0.70:
            bolha.append(i)
    print("bolhas de numero: %d" % len(bolha))

    # --- funde cada bolha na celula vizinha de maior area
    remap = np.arange(n + 1)
    descarta = set()
    for i in bolha:
        sl = objs[i - 1]
        pad = tuple(slice(max(0, s.start - 3), min(d, s.stop + 3)) for s, d in zip(sl, (H, W)))
        sub = lab[pad]; m = sub == i
        anel = ndi.binary_dilation(m, iterations=3) & ~m
        viz = np.bincount(sub[anel].ravel(), minlength=n + 1)
        viz[i] = 0
        viz[0] = 0                     # fundo (rua) nao pode ser alvo
        alvo = int(viz.argmax()) if viz.max() > 0 else 0
        if alvo:
            remap[i] = alvo            # bolha volta pro lote dela
        else:
            descarta.add(i)            # bolha solta no meio da rua: sai
    lab = remap[lab]
    cont = np.bincount(lab.ravel(), minlength=n + 1)
    objs = ndi.find_objects(lab)

    # --- metricas das celulas plausiveis
    met = {}
    for i in range(1, n + 1):
        if i in borda or remap[i] != i or i in descarta: continue
        a = cont[i]
        if not (15 * ppm2 <= a <= 5000 * ppm2): continue
        sl = objs[i - 1]
        m = (lab[sl] == i).astype(np.uint8)
        c, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not c: continue
        c = max(c, key=cv2.contourArea)
        (rcx, rcy), (rw, rh), rang = cv2.minAreaRect(c)
        if min(rw, rh) < 1: continue
        poly = cv2.approxPolyDP(c, 1.5, True).reshape(-1, 2).astype(float)
        poly[:, 0] += sl[1].start; poly[:, 1] += sl[0].start
        met[i] = dict(area=a * mpp * mpp, cx=rcx + sl[1].start, cy=rcy + sl[0].start,
                      frente=min(rw, rh) * mpp, fundo=max(rw, rh) * mpp,
                      ang=rang, ret=a / max(rw * rh, 1), poly=poly.tolist())

    # --- lote = celula com vizinhas de area parecida (mata selo/legenda/perfis)
    ids = list(met)
    P = np.array([[met[i]["cx"], met[i]["cy"]] for i in ids])
    A = np.array([met[i]["area"] for i in ids])
    asp = np.array([met[i]["fundo"] / max(met[i]["frente"], 1e-6) for i in ids])
    fre = np.array([met[i]["frente"] for i in ids])
    ret = np.array([met[i]["ret"] for i in ids])
    tree = cKDTree(P)
    viz = tree.query_ball_point(P, 80.0 / mpp)
    okf = (asp < 9.0) & (fre > 2.5) & (ret > 0.50)          # celula de tabela/legenda cai aqui
    # frouxo de proposito: loteamento antigo tem lote irregular. A limpeza de verdade
    # e o recorte por quadra oficial no georreferenciar_planta.py.
    cand2 = [k for k in range(len(ids)) if okf[k]
             and sum(1 for j in viz[k] if j != k and okf[j] and abs(A[j] - A[k]) <= 0.70 * max(A[k], A[j])) >= 2]
    # agrupa por proximidade e exige quadra com >=8 lotes (mata selo, legenda, inset)
    sub = cKDTree(P[cand2]); pares = sub.query_pairs(40.0 / mpp)
    pai = list(range(len(cand2)))
    def acha(x):
        while pai[x] != x: pai[x] = pai[pai[x]]; x = pai[x]
        return x
    for a, b in pares:
        ra, rb = acha(a), acha(b)
        if ra != rb: pai[ra] = rb
    from collections import Counter
    grp = [acha(k) for k in range(len(cand2))]
    tam = Counter(grp)
    lot = [ids[cand2[k]] for k in range(len(cand2)) if tam[grp[k]] >= 4]
    print("quadras/grupos: %d (mantidos %d)" % (len(tam), sum(1 for g, t in tam.items() if t >= 4)))

    Al = np.array([met[i]["area"] for i in lot])
    F = np.array([met[i]["frente"] for i in lot]); D = np.array([met[i]["fundo"] for i in lot])
    print("LOTES %d | area med %.1f m2 (mediana %.1f) | soma %.0f m2" % (len(lot), Al.mean(), np.median(Al), Al.sum()))
    print("       frente mediana %.2f m | fundo mediano %.2f m" % (np.median(F), np.median(D)))
    saida = os.path.splitext(os.path.basename(path))[0] + "_lotes.json"
    json.dump({"mpp": mpp, "dpi": dpi, "escala": esc, "w": W, "h": H,
               "lotes": [dict(id=i, **{k: v for k, v in met[i].items()}) for i in lot]},
              open(saida, "w"))
    print("->", saida)

if __name__ == "__main__":
    main(sys.argv[1], float(sys.argv[2]) if len(sys.argv) > 2 else 1000.0)

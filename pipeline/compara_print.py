# -*- coding: utf-8 -*-
"""Compara dois prints do mapa e diz QUANTO mudou, nao se mudou.

Existe porque "olhei e parece igual" nao serve pra aceitar troca de renderizador: o
salto de three r128 -> r168 muda a semantica de luz, e a diferenca aparece como um
desvio pequeno e UNIFORME que o olho normaliza sem perceber.

Cuidado documentado (ver [[mapa-3d-qa-headless]]): duas capturas do MESMO arquivo
podem diferir por causa do streaming alternando entre dois estados no instante do
print. Rode o CONTROLE (mesmo arquivo contra ele mesmo) antes de acusar regressao.

    python pipeline/compara_print.py a.png b.png
"""
import sys
import numpy as np
from PIL import Image


def carrega(p):
    im = Image.open(p).convert("RGB")
    return np.asarray(im).astype(np.int16)


def main():
    a, b = carrega(sys.argv[1]), carrega(sys.argv[2])
    if a.shape != b.shape:
        print("tamanhos diferentes: %s x %s" % (a.shape, b.shape)); return 1
    d = b - a
    absd = np.abs(d)
    porpx = absd.max(axis=2)
    n = porpx.size
    print("  pixels             %d" % n)
    print("  identicos          %.2f%%" % (100.0 * (porpx == 0).sum() / n))
    print("  |delta| <= 2       %.2f%%" % (100.0 * (porpx <= 2).sum() / n))
    print("  |delta| <= 8       %.2f%%" % (100.0 * (porpx <= 8).sum() / n))
    print("  |delta| medio      %.2f" % absd.mean())
    print("  |delta| p99        %.0f" % np.percentile(porpx, 99))
    print("  |delta| max        %d" % porpx.max())
    print("  vies por canal     R %+.2f  G %+.2f  B %+.2f"
          % (d[:, :, 0].mean(), d[:, :, 1].mean(), d[:, :, 2].mean()))
    print("  brilho medio       %.1f -> %.1f" % (a.mean(), b.mean()))
    ruins = np.argwhere(porpx > 2)
    if len(ruins):
        y0, x0 = ruins.min(axis=0); y1, x1 = ruins.max(axis=0)
        print("  %d pixel(s) acima de 2, caixa x %d..%d  y %d..%d"
              % (len(ruins), x0, x1, y0, y1))
        ordem = ruins[np.argsort(-porpx[ruins[:, 0], ruins[:, 1]])][:6]
        for y, x in ordem:
            print("      (%4d,%4d)  %s -> %s" % (x, y, list(a[y, x]), list(b[y, x])))
    return 0


if __name__ == "__main__":
    sys.exit(main())

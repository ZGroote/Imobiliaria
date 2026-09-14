# -*- coding: utf-8 -*-
"""Mede a APARENCIA de um quadro da cidade -- so nos pixels de edificacao.

    python pipeline/mede_cidade.py rua.png
    python pipeline/mede_cidade.py rua.png --contra sem_sombra.png   # mede sombra%
    python pipeline/mede_cidade.py rua.png bairro.png --solto        # sem portao

POR QUE ELE EXISTE, e a licao que ele carrega: o primeiro portao que eu propus para
isto media `p99` e `maximo` do QUADRO INTEIRO -- e os dois sao o domo do ceu, que tem
`toneMapped:false`. Nenhuma mudanca de material pode move-los, nunca. Medido: depois de
dar especular a parede, telhado, asfalto, muro e arvore, o maximo do quadro ficou em
234,5 nos dois lados, IDENTICO ate a primeira decimal -- e a mudanca era real (0,91% do
quadro moveu +18 niveis). O portao nao estava reprovando; estava olhando pro lugar
errado. E a mesma familia de erro que ja mordeu este projeto antes (o portao de media
que empurrava a cena pro meio-cinza, e o medidor de interior que aprovava foto de vista
aerea porque nunca conferiu se a casa tinha aberto).

Daí a mascara. `construido` = o que sobra depois de tirar ceu e vegetacao; e sobre ele
que realce e faixa sao medidos.

Convencao de codigo de saida, igual a das outras sondas: 2 = nao deu pra medir,
1 = medi e reprovei, 0 = passou.
"""
import os, sys

try:
    import numpy as np
    from PIL import Image
except ImportError as e:
    print("falta dependencia: %s" % e)
    raise SystemExit(2)

# Recorte que tira o HUD (busca em cima, botoes embaixo, ficha e minimapa a direita).
# Os mesmos numeros das medidas de 08/09/2026 -- mudar aqui muda a base de comparacao.
CORTE = (0.10, 0.92, 0.06, 0.78)

# Portoes. Sao PISO e TETO: exigir presenca, nao so proibir excesso.
GATES = {
    "realce%":  (0.15, 1.50),
    "faixa":    (90.0, None),
    "croma":    (0.10, 0.30),
    "escuro%":  (8.0,  None),
    "chapado%": (None, 18.0),
    "sombra%":  (12.0, None),   # so avaliado quando ha --contra
}


def _carrega(p):
    im = np.asarray(Image.open(p).convert("RGB"), dtype=np.float32)
    h, w, _ = im.shape
    y0, y1, x0, x1 = CORTE
    return im[int(h * y0):int(h * y1), int(w * x0):int(w * x1)]


def _lum(c):
    return 0.2126 * c[:, :, 0] + 0.7152 * c[:, :, 1] + 0.0722 * c[:, :, 2]


def mascara(c):
    """Devolve (construido, vegetacao, ceu) como mascaras booleanas.

    Ceu: azul-dominante. A cupula e um gradiente frio e a nevoa casa com ela, entao o
    mesmo teste pega o fundo esfumacado -- que e o certo, ele tambem nao e edificacao.
    Parede, telha, asfalto e calcada sao neutros ou quentes neste pipeline (o asfalto
    saiu FRIO no albedo justamente pra CHEGAR neutro na tela), entao nao caem aqui.

    Vegetacao: verde dominante. Copa e gramado tem estatistica propria -- deixar os dois
    dentro do `construido` mascara o que a fachada faz.
    """
    r, g, b = c[:, :, 0], c[:, :, 1], c[:, :, 2]
    lum = _lum(c)
    ceu = (b > r + 10) & (b > g + 4) & (lum > 120)
    veg = (g > r + 14) & (g > b + 14)
    return ~(ceu | veg), veg, ceu


def mede(png, contra=None):
    c = _carrega(png)
    con, veg, ceu = mascara(c)
    if con.sum() < 5000:
        raise SystemExit("quadro sem edificacao suficiente: %d pixels" % int(con.sum()))
    lum = _lum(c)
    mx, mn = c.max(2), c.min(2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    L = lum[con]

    # Desvio local em janela de 8 px, amostrado de 4 em 4 (a janela ja se sobrepoe --
    # amostrar todo pixel quadruplica o custo e nao muda a terceira casa).
    from numpy.lib.stride_tricks import sliding_window_view
    W = sliding_window_view(lum, (8, 8))
    sd = W.reshape(*W.shape[:2], -1).std(-1)[::4, ::4]
    conS = con[:sd.shape[0] * 4:4, :sd.shape[1] * 4:4]

    out = {
        "realce%":  100.0 * float(((lum > 235) & (sat < 0.10) & con).sum()) / float(con.sum()),
        "faixa":    float(np.percentile(L, 99) - np.percentile(L, 1)),
        "croma":    float(sat[con].mean()),
        "escuro%":  100.0 * float((L < 70).mean()),
        "chapado%": 100.0 * float((sd[conS] < 1.0).mean()),
        "_area%":   100.0 * float(con.mean()),
        "_veg%":    100.0 * float(veg.mean()),
        "_ceu%":    100.0 * float(ceu.mean()),
    }
    if contra:
        base = _lum(_carrega(contra))
        if base.shape != lum.shape:
            raise SystemExit("--contra tem tamanho diferente do quadro")
        out["sombra%"] = 100.0 * float(((base - lum) > 4).mean())
    return out


def main():
    ar = [a for a in sys.argv[1:] if not a.startswith("-")]
    if not ar:
        raise SystemExit(__doc__)
    contra = None
    if "--contra" in sys.argv:
        contra = sys.argv[sys.argv.index("--contra") + 1]
        ar = [a for a in ar if a != contra]
    solto = "--solto" in sys.argv

    reprovou = []
    for png in ar:
        if not os.path.exists(png):
            print("nao existe: %s" % png)
            raise SystemExit(2)
        m = mede(png, contra)
        print("\n%s   (edificacao %.1f%% do quadro, vegetacao %.1f%%, ceu %.1f%%)"
              % (os.path.basename(png), m["_area%"], m["_veg%"], m["_ceu%"]))
        for k, v in m.items():
            if k.startswith("_"):
                continue
            lo, hi = GATES.get(k, (None, None))
            ruim = (lo is not None and v < lo) or (hi is not None and v > hi)
            alvo = "%s..%s" % ("-" if lo is None else lo, "-" if hi is None else hi)
            print("   %-9s %8.3f   alvo %-12s %s" % (k, v, alvo, "REPROVA" if ruim else "ok"))
            if ruim:
                reprovou.append("%s: %s = %.3f" % (os.path.basename(png), k, v))

    if solto or not reprovou:
        print("\n%d quadro(s) medido(s)%s." % (len(ar), "" if not reprovou else " (portao solto)"))
        return 0
    print("\nREPROVADO: " + "; ".join(reprovou))
    return 1


if __name__ == "__main__":
    sys.exit(main())

# -*- coding: utf-8 -*-
"""Atlas de PROVA: uma cor chapada por peca, com marca de orientacao.

    python pipeline/unreal_atlas_prova.py [<id>]

Serve pra responder uma pergunta que print de cena iluminada nao responde: a uv1 do
renderizador cai no retangulo certo do atlas, e na orientacao certa?

Cada peca recebe:
  * uma cor de fundo tirada do indice (tres primos, entao vizinhas nao repetem);
  * uma FAIXA CLARA na borda a=0  (o lado onde `du` comeca);
  * uma FAIXA ESCURA na borda b=0 (o lado onde `dv` comeca).

Na cena: cada face tem que sair de UMA cor so. Duas cores na mesma face = uv1 caindo
fora do retangulo. E as faixas dizem se a peca entrou espelhada -- que e o erro que a
iluminacao de verdade esconde, porque parede iluminada e quase simetrica.

Escreve por cima de `unreal/lightmaps/<id>.png`, entao guarde o de verdade antes
(`unreal/lightmaps/*.png.bom`) -- o `--restaurar` desfaz.
"""
import io, json, os, shutil, sys

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MALHAS = os.path.join(RAIZ, "unreal", "malhas")
SAIDA = os.path.join(RAIZ, "unreal", "lightmaps")


def cor(i):
    return ((i * 97) % 200 + 40, (i * 61) % 200 + 40, (i * 149) % 200 + 40)


def prova(ident):
    plano = json.load(io.open(os.path.join(MALHAS, "%s.tiles.json" % ident),
                              encoding="utf-8"))
    lado = plano["atlas"]
    im = Image.new("RGB", (lado, lado), (0, 0, 0))
    px = im.load()
    for i, p in enumerate(plano["pecas"]):
        rx, ry, rw, rh = p["rect"]
        c = cor(i)
        for y in range(ry, min(lado, ry + rh)):
            for x in range(rx, min(lado, rx + rw)):
                px[x, y] = c
        faixa = max(1, min(rw, rh) // 5)
        for y in range(ry, min(lado, ry + rh)):          # borda a=0: clara
            for x in range(rx, min(lado, rx + faixa)):
                px[x, y] = (255, 255, 255)
        for y in range(ry, min(lado, ry + faixa)):       # borda b=0: escura
            for x in range(rx, min(lado, rx + rw)):
                px[x, y] = (14, 14, 14)
    dest = os.path.join(SAIDA, "%s.png" % ident)
    bom = dest + ".bom"
    if os.path.exists(dest) and not os.path.exists(bom):
        shutil.copy(dest, bom)
    im.save(dest)
    print("  %-24s %d pecas -> atlas de prova" % (ident, len(plano["pecas"])))


def restaura(ident):
    dest = os.path.join(SAIDA, "%s.png" % ident)
    bom = dest + ".bom"
    if os.path.exists(bom):
        shutil.move(bom, dest)
        print("  %-24s restaurado" % ident)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    alvo = args[0] if args else None
    acao = restaura if "--restaurar" in sys.argv else prova
    for nome in sorted(os.listdir(MALHAS)):
        if not nome.endswith(".tiles.json"):
            continue
        ident = nome[:-len(".tiles.json")]
        if alvo and ident != alvo:
            continue
        acao(ident)
    return 0


if __name__ == "__main__":
    sys.exit(main())

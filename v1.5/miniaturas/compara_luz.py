# -*- coding: utf-8 -*-
"""Quanto de luz a pagina avulsa perde por nao ter o bake.

    python miniaturas/compara_luz.py avulsa.png renderizador.png

A pergunta nao e "qual esta mais bonita" -- e "o que o bake acrescenta que a luz
analitica nao da". A resposta e MEDIDA, porque a olho as duas parecem um comodo branco.

O que se mede, na regiao da cena (a ficha embaixo fica de fora por recorte):

  media    -- exposicao. Se uma esta muito mais clara, o resto nao compara.
  faixa    -- p95 menos p5. Luz chapada comprime a faixa: parede inteira no mesmo tom.
  desvio   -- espalhamento em volta da media.
  planura  -- % de pixels a +-3 do tom mais comum. E a medida direta do defeito: com
              oclusao os cantos caem e esse numero DESCE. Perto de 100% e tinta, nao luz.
  escuro%  -- pixels abaixo de 60. Canto de parede sem bake nao escurece nunca.

`planura` e `escuro%` sao os dois que decidem: se a avulsa tiver planura parecida e
escuro% parecido, o bake nao esta acrescentando o suficiente pra pagar 900 linhas.
"""
import sys
from collections import Counter

from PIL import Image


def stats(caminho, recorte=None):
    im = Image.open(caminho).convert("L")
    if recorte:
        im = im.crop(recorte)
    px = list(im.getdata())
    n = len(px)
    px.sort()
    media = sum(px) / n
    p5, p95 = px[int(n * 0.05)], px[int(n * 0.95)]
    var = sum((v - media) ** 2 for v in px) / n
    modo = Counter(px).most_common(1)[0][0]
    perto = sum(1 for v in px if abs(v - modo) <= 3) / n
    escuro = sum(1 for v in px if v < 60) / n
    return {"n": n, "media": media, "faixa": p95 - p5, "desvio": var ** 0.5,
            "planura": perto * 100, "escuro": escuro * 100, "modo": modo}


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 1
    rotulos = ("avulsa", "renderizador")
    saidas = []
    for i, arg in enumerate(sys.argv[1:3]):
        # `--recorte x0,y0,x1,y1` logo depois do arquivo, se a cena nao for a imagem toda
        rec = None
        j = 3 + i
        if len(sys.argv) > j and sys.argv[j].startswith("--recorte"):
            rec = tuple(int(v) for v in sys.argv[j].split("=")[1].split(","))
        saidas.append((rotulos[i], stats(arg, rec)))

    print("%-14s %8s %7s %8s %9s %9s" % ("", "media", "faixa", "desvio", "planura%", "escuro%"))
    for nome, s in saidas:
        print("%-14s %8.1f %7d %8.1f %9.1f %9.2f"
              % (nome, s["media"], s["faixa"], s["desvio"], s["planura"], s["escuro"]))
    a, b = saidas[0][1], saidas[1][1]
    print()
    print("faixa:   %+.0f%%  (o bake ALARGA; negativo = a avulsa comprime)"
          % (100 * (a["faixa"] - b["faixa"]) / max(1, b["faixa"])))
    print("planura: %+.1f pontos (o bake BAIXA; positivo = a avulsa e mais chapada)"
          % (a["planura"] - b["planura"]))
    print("escuro:  %+.2f pontos (o bake SOBE; negativo = a avulsa nao tem canto escuro)"
          % (a["escuro"] - b["escuro"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())

# -*- coding: utf-8 -*-
"""Baixa do ambientCG as texturas de fachada da CIDADE e escreve `texturas/`.

    python pipeline/baixa_texturas.py

Fonte: https://ambientcg.com -- licenca **CC0** (dominio publico, uso comercial, sem
atribuicao exigida). Nao e a Fab/Megascans: a janela gratuita da Megascans fechou no
fim de 2024 e hoje e paga. Poly Haven tambem e CC0, mas a mobilia de la e vintage e
nao serve pro estilo deste projeto -- textura e onde baixar ganha, malha nao (a malha
vem do Blender, ver `moveis/moveis.py`).

**Por que 512 e nao 1K.** Medido: o mesmo reboco cai de 809 KB (1K JPG original) pra
12,4 KB (512 WebP q85) e o DESVIO PADRAO nao muda -- 4,1 nos dois. A informacao nao
esta na resolucao, esta no contraste, e reboco quase nao tem contraste. 1K seria pagar
banda por textura que o mipmap descarta.

**O contraste e o que decide o que vale a pena embutir**, e a medida esta aqui porque
ela contradiz o palpite:

    Bricks023     92,2 KB base64   desvio 42,5   <- carrega de verdade
    Concrete016   14,3 KB base64   desvio  6,1
    Plaster001    16,6 KB base64   desvio  4,1   <- quase invisivel, e por isso barato

O conjunto inteiro da ~123 KB numa pagina de 19,5 MB: 0,6%. A estimativa que eu tinha
dado antes de medir era de 1,5 a 3 MB -- errada por duas ordens de grandeza, porque
material quase uniforme comprime a quase nada.
"""
import io, os, sys, zipfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, "texturas")
LADO = 512
QUAL = 85

# id do ambientCG -> nome do arquivo local
MATERIAIS = {"Plaster001": "reboco", "Bricks023": "tijolo", "Ground037": "chao"}


def baixa(ident):
    import urllib.request
    url = "https://ambientcg.com/get?file=%s_1K-JPG.zip" % ident
    req = urllib.request.Request(url, headers={"User-Agent": "imobiliaria/1.0"})
    with urllib.request.urlopen(req, timeout=300) as r:
        return r.read()


def main():
    from PIL import Image, ImageStat
    if not os.path.isdir(SAIDA):
        os.makedirs(SAIDA)
    total = 0
    for ident, nome in sorted(MATERIAIS.items()):
        destino = os.path.join(SAIDA, nome + ".webp")
        bruto = baixa(ident)
        z = zipfile.ZipFile(io.BytesIO(bruto))
        alvo = [n for n in z.namelist() if n.endswith("_Color.jpg")]
        if not alvo:
            print("  %s: sem _Color.jpg no pacote" % ident)
            return 1
        im = Image.open(io.BytesIO(z.read(alvo[0]))).convert("RGB")
        im = im.resize((LADO, LADO), Image.LANCZOS)
        im.save(destino, "WEBP", quality=QUAL)
        n = os.path.getsize(destino)
        total += n
        st = ImageStat.Stat(im.convert("L"))
        print("  %-8s <- %-12s %6.1f KB (base64 %6.1f KB)  media %3.0f  desvio %5.1f"
              % (nome, ident, n / 1024.0, n * 1.34 / 1024.0, st.mean[0], st.stddev[0]))
    io.open(os.path.join(SAIDA, "FONTE.txt"), "w", encoding="utf-8").write(
        "ambientCG (https://ambientcg.com) -- licenca CC0 / dominio publico.\n"
        "Uso comercial permitido, atribuicao nao exigida.\n"
        + "".join("%s <- %s\n" % (v, k) for k, v in sorted(MATERIAIS.items())))
    print("  total %.1f KB (%.1f KB em base64)" % (total / 1024.0, total * 1.34 / 1024.0))
    return 0


if __name__ == "__main__":
    sys.exit(main())

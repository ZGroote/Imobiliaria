# -*- coding: utf-8 -*-
"""Etapa 3: as capturas viram UM atlas de luz por unidade.

    python pipeline/unreal_atlas.py            # todas
    python pipeline/unreal_atlas.py <id>

Cada captura e um PNG quadrado de 256 onde a peca aparece CENTRADA, porque a camera
ortografica e quadrada e a largura foi `max(largura, altura) * MARGEM`. Aqui a peca e
recortada, virada e colada no retangulo dela.

**A virada de 180 graus.** A camera foi montada com `make_rot_from_xz(-n, dv)`: o
"cima" dela e o `dv` da peca, e o "direita" sai como `-du` (Y = Z x X na convencao da
UE). Entao a imagem chega espelhada nos dois eixos em relacao a UV que o OBJ escreveu.
Nao e chute: `--prova` mede a correlacao entre o brilho medido peca a peca aqui e a
oclusao que o bake em JS ja calculava, e uma peca virada derruba essa correlacao.

**Sangria.** O recorte e dilatado alguns texels pra fora antes de colar. Sem isso, a
interpolacao bilinear na borda da peca puxa o vizinho do atlas -- que e outra parede,
de outro comodo -- e aparece uma listra clara na quina. E o mesmo motivo da margem de
`unreal_exporta.py`, visto do outro lado.

**Normalizacao.** O atlas sai como MULTIPLICADOR de media 1, nao como brilho absoluto,
pela mesma razao do bake em JS: a exposicao do interior tem dono, que e
`pipeline/mede_interior.py`. E a saturacao e cortada pela metade -- o ceu da UE deixa
tudo AZUL, e azul saturado multiplicando a cor do cadastro suja o bege da parede.
"""
import io, json, math, os, sys

from PIL import Image, ImageFilter

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MALHAS = os.path.join(RAIZ, "unreal", "malhas")
CAPTURAS = os.path.join(RAIZ, "unreal", "capturas")
SAIDA = os.path.join(RAIZ, "unreal", "lightmaps")

RES = 256
MARGEM_CAP = 1.06     # a mesma de assar.py
SANGRIA = 3           # texels de dilatacao na borda da peca
# ZERO CROMA. O atlas entra como LUMINANCIA pura. O ceu da UE deixa tudo azul, e azul
# multiplicando o bege do cadastro devolve cinza -- a parede perdia a cor que o anuncio
# tem. A divisao de trabalho que sobra e a certa: o cadastro manda na COR, o Unreal
# manda na FORMA da luz. E o mesmo principio de assar com material branco.
SATURACAO = 0.0
# Media alvo do atlas, em 0..1. NAO e 1,0: com media 1 o multiplicador medio vira
# branco puro e tudo que estiver acima da media -- parede de frente pra janela,
# sacada -- clipa em 255 e some. Com 0,62 sobra 60% de folga acima da media, e o
# three devolve a escala em `lightMapIntensity = 1/0,62`. E o mesmo raciocinio de
# guardar a exposicao fora da imagem.
ALVO_MEDIA = 0.50
# EXPANSAO DE CONTRASTE. A captura sai por `SCS_FINAL_COLOR_LDR`, ou seja ja passou
# pelo tonemapper do Unreal -- que existe pra COMPRIMIR faixa dinamica. Colado direto,
# o atlas rendia faixa 57 na medida do portao contra 90 do bake em JS: a cena ficava
# certa de media e chapada de contraste. Expandir em volta da media aqui desfaz a
# compressao que nao deveria ter sido aplicada a um mapa de luz. Gama > 1 ABRE.
GAMA = 1.45


def recorta(cap, cw, ch):
    """Tira do quadro quadrado o retangulo que e a peca, e vira 180."""
    lado_m = max(cw, ch) * MARGEM_CAP
    ppm = RES / lado_m
    w = max(1, int(round(cw * ppm)))
    h = max(1, int(round(ch * ppm)))
    x0 = int(round((RES - w) / 2.0))
    y0 = int(round((RES - h) / 2.0))
    return cap.crop((x0, y0, x0 + w, y0 + h)).transpose(Image.ROTATE_180)


def monta(ident, prova=False):
    plano = json.load(io.open(os.path.join(MALHAS, "%s.tiles.json" % ident),
                              encoding="utf-8"))
    pecas = plano["pecas"]
    lado = plano["atlas"]
    pasta = os.path.join(CAPTURAS, ident)
    if not os.path.isdir(pasta):
        print("  (sem capturas de %s -- rode unreal/assar.py)" % ident)
        return None

    atlas = Image.new("RGB", (lado, lado), (0, 0, 0))
    medias = []
    faltando = 0
    for i, p in enumerate(pecas):
        f = os.path.join(pasta, "%04d.png" % i)
        if not os.path.exists(f):
            medias.append(None); faltando += 1; continue
        cap = Image.open(f).convert("RGB")
        cw, ch = p["m"]
        peca = recorta(cap, cw, ch)
        rx, ry, rw, rh = p["rect"]
        peca = peca.resize((rw, rh), Image.LANCZOS)
        # sangria: cola uma versao dilatada por tras e a peca por cima
        if SANGRIA:
            g = peca.resize((rw + 2*SANGRIA, rh + 2*SANGRIA), Image.BILINEAR)
            atlas.paste(g, (rx - SANGRIA, ry - SANGRIA))
        atlas.paste(peca, (rx, ry))
        px = list(peca.convert("L").getdata())
        medias.append(sum(px) / float(len(px)))

    # --- dessatura e normaliza ------------------------------------------
    px = atlas.load()
    soma, n = 0.0, 0
    for p in pecas:
        rx, ry, rw, rh = p["rect"]
        for y in range(ry, ry + rh):
            for x in range(rx, rx + rw):
                r, g, b = px[x, y]
                soma += 0.2126*r + 0.7152*g + 0.0722*b
                n += 1
    med = (soma / n) if n else 1.0
    k = (255.0 * ALVO_MEDIA / med) if med > 1 else 1.0
    saida = Image.new("RGB", (lado, lado), (0, 0, 0))
    sp = saida.load()
    for y in range(lado):
        for x in range(lado):
            r, g, b = px[x, y]
            lum = 0.2126*r + 0.7152*g + 0.0722*b
            if lum > 0.5:
                e = ((lum / med) ** GAMA) * med / lum      # expande em volta da media
                r *= e; g *= e; b *= e; lum *= e
            r = lum + (r - lum) * SATURACAO
            g = lum + (g - lum) * SATURACAO
            b = lum + (b - lum) * SATURACAO
            sp[x, y] = (min(255, max(0, int(r*k))),
                        min(255, max(0, int(g*k))),
                        min(255, max(0, int(b*k))))

    if not os.path.isdir(SAIDA):
        os.makedirs(SAIDA)
    dest = os.path.join(SAIDA, "%s.png" % ident)
    saida.save(dest, optimize=True)
    tam = os.path.getsize(dest)
    print("  %-24s %4d pecas (%d sem captura)  media bruta %.1f  ganho x%.2f  %5.0f KB"
          % (ident, len(pecas), faltando, med, k, tam/1024.0))

    io.open(os.path.join(SAIDA, "%s.json" % ident), "w", encoding="utf-8").write(
        json.dumps({"id": ident, "atlas": lado, "texels_m": plano["texels_m"],
                    "ganho": round(k, 4), "media_bruta": round(med, 2),
                    "saturacao": SATURACAO,
                    "medias": [None if m is None else round(m, 1) for m in medias]},
                   ensure_ascii=False))
    return medias


def main():
    alvo = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else None
    n = 0
    for nome in sorted(os.listdir(MALHAS)):
        if not nome.endswith(".tiles.json"):
            continue
        ident = nome[:-len(".tiles.json")]
        if alvo and ident != alvo:
            continue
        if monta(ident) is not None:
            n += 1
    return 0 if n else 1


if __name__ == "__main__":
    sys.exit(main())

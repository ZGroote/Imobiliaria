"""Gera as versões do logo da Conecta a partir da arte enviada em 27/10 (conecta-logo-novo-20261027.webp).

  logo-conecta.webp   cabeçalho e rodapé: ícone à esquerda, texto escuro à direita, fundo transparente
  favicon.ico, marca.svg   ícone da aba: o símbolo no quadrado azul-escuro da própria arte
  compartilhar.png    prévia de link (WhatsApp etc.): a arte inteira em 1200x630
  marca-telhado.webp  letreiro na laje do LIV: a arte inteira, aparada

Uso: python fachada/marca-fonte/gerar_marca.py <pasta de saída>
ponytail: recortes medidos nesta arte (símbolo x 476..814 y 100..392, texto x 344..954 y 401..603); arte nova pede medir de novo.
"""
import base64
import io
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ARTE = Path(__file__).with_name("conecta-logo-novo-20261027.webp")
TINTA, AZUL, LEGENDA = np.array([11, 27, 69]), np.array([4, 120, 249]), np.array([68, 85, 127])


def icone(img, fundo, lado, meio=205):
    """Quadrado arredondado com o símbolo sobre o próprio fundo da arte; o texto embaixo vira fundo."""
    cx, cy = 645, 246
    a = np.asarray(img).astype(float)
    b = np.asarray(fundo).astype(float)
    peso = np.clip((np.arange(a.shape[0]) - 394) / 4, 0, 1)[:, None, None]
    a = a * (1 - peso) + b * peso
    quadro = Image.fromarray(a.astype(np.uint8)).crop((cx - meio, cy - meio, cx + meio, cy + meio))
    quadro = quadro.resize((lado, lado), Image.LANCZOS).convert("RGBA")
    mascara = Image.new("L", (lado * 4, lado * 4))
    ImageDraw.Draw(mascara).rounded_rectangle((0, 0, lado * 4 - 1, lado * 4 - 1), lado * 4 * 0.22, fill=255)
    quadro.putalpha(mascara.resize((lado, lado), Image.LANCZOS))
    return quadro


def texto_escuro(img, fundo):
    """Tira o texto claro do fundo escuro: alfa pela distância ao fundo, cor escura (o 3D fica azul)."""
    caixa = (344, 401, 955, 604)
    a = np.asarray(img.crop(caixa)).astype(float)
    b = np.asarray(fundo.crop(caixa)).astype(float)
    alfa = np.clip(((a - b) / np.maximum(255 - b, 1)).max(2), 0, 1)
    alfa = np.clip((alfa - 0.12) / 0.7, 0, 1)  # o resto do degradê do fundo não é letra
    branco = np.clip((a[..., 0] - b[..., 0]) / np.maximum(a[..., 2] - b[..., 2], 1), 0, 1)[..., None]
    escuro = np.where(np.arange(a.shape[0])[:, None, None] > 170, LEGENDA, TINTA)
    cor = escuro * branco + AZUL * (1 - branco)
    return Image.fromarray(np.dstack([cor, alfa * 255]).astype(np.uint8), "RGBA")


def main(saida):
    saida.mkdir(parents=True, exist_ok=True)
    img = Image.open(ARTE).convert("RGB")
    fundo = img.filter(ImageFilter.MinFilter(31)).filter(ImageFilter.MaxFilter(31)).filter(ImageFilter.GaussianBlur(20))

    texto = texto_escuro(img, fundo)
    alto, vao = 236, 36
    logo = Image.new("RGBA", (alto + vao + texto.width, alto), (0, 0, 0, 0))
    logo.alpha_composite(icone(img, fundo, alto), (0, 0))
    logo.alpha_composite(texto, (alto + vao, (alto - texto.height) // 2))
    logo.save(saida / "logo-conecta.webp", lossless=True, method=6)

    icone(img, fundo, 256, 180).save(saida / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    png = io.BytesIO()
    icone(img, fundo, 96, 180).save(png, "PNG", optimize=True)
    (saida / "marca.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><image width="96" height="96" href="data:image/png;base64,'
        + base64.b64encode(png.getvalue()).decode() + '"/></svg>\n', encoding="utf-8")

    # 1291x740 -> 1200 de largura dá 688 de altura; corta 29 em cima e embaixo (o logo fica entre 64 e 533).
    previa = img.resize((1200, 688), Image.LANCZOS).crop((0, 29, 1200, 659))
    previa.save(saida / "compartilhar.png", optimize=True)  # ~240 KB; com 256 cores o painel branco fica em faixas

    img.crop((300, 70, 1000, 640)).save(saida / "marca-telhado.webp", quality=90, method=6)

    for nome in ("logo-conecta.webp", "favicon.ico", "marca.svg", "compartilhar.png", "marca-telhado.webp"):
        print(nome, (saida / nome).stat().st_size, "bytes")


if __name__ == "__main__":
    main(Path(sys.argv[1]))

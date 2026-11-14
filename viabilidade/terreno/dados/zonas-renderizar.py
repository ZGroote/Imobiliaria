"""Reproduz os recortes de conferência visual; não decide zona por cor.

Execute da raiz: python -I viabilidade/terreno/dados/zonas-renderizar.py
Usa PyMuPDF, Pillow e pyproj já instalados no computador.
"""
import json
from pathlib import Path
import site
import sys

sys.path.append(site.getusersitepackages())
import numpy as np
import pymupdf
from PIL import Image, ImageDraw
from pyproj import Transformer

BASE = Path(__file__).resolve().parent
PDFS = BASE.parent.parent / "lei/mapa/lei18053_anexos_2017_pdf"
OUT = BASE / "zonas-mapas"
OUT.mkdir(exist_ok=True)
CONTROLES = json.loads((BASE / "zonas-controles.json").read_text(encoding="utf-8"))
LOTES = json.loads((BASE.parent / "lotes-piloto.json").read_text(encoding="utf-8"))
TRANSFORMAR = Transformer.from_crs(31983, 29183, always_xy=True)
ORIGEM = np.array([200000, 7560000])
relatorio = {}
for anexo, pontos in CONTROLES["mapas"].items():
    arquivo = next(PDFS.glob(f"ANEXO {anexo} - *.pdf"))
    with pymupdf.open(arquivo) as documento:
        jpeg = documento.extract_image(documento[0].get_images()[0][0])["image"]
    (OUT / f"anexo{anexo}.jpg").write_bytes(jpeg)
    imagem = Image.open(OUT / f"anexo{anexo}.jpg")
    assert imagem.size == (8858, 12746)
    mundo = np.array([p["utm_sad69"] for p in pontos])
    pixels = np.array([p["pixel"] for p in pontos])
    matriz = np.column_stack([mundo - ORIGEM, np.ones(len(pontos))])
    coef, _, rank, _ = np.linalg.lstsq(matriz, pixels, rcond=None)
    assert rank == 3
    residuos = np.linalg.norm(matriz @ coef - pixels, axis=1)
    escala = np.sqrt(abs(np.linalg.det(coef[:2])))
    assert np.max(residuos) / escala < 40
    relatorio[anexo] = {
        "afim_utm_menos_origem_para_pixel": coef.tolist(),
        "origem_utm": ORIGEM.tolist(),
        "pixels_por_metro": float(escala),
        "residuos_controles_m": (residuos / escala).tolist(),
        "rmse_controles_m": float(np.sqrt(np.mean(residuos**2)) / escala),
        "lotes": {},
    }
    geral = imagem.copy()
    desenhar = ImageDraw.Draw(geral)
    for p in pontos:
        x, y = p["pixel"]
        desenhar.ellipse((x-25, y-25, x+25, y+25), outline="cyan", width=6)
        desenhar.text((x+30, y), str(p["vertice"]), fill="black", stroke_width=1)
    for lote in LOTES:
        mundo_lote = np.array([TRANSFORMAR.transform(*xy) for xy in lote["poligono_utm"]])
        lote_pixels = np.column_stack([mundo_lote - ORIGEM, np.ones(len(mundo_lote))]) @ coef
        relatorio[anexo]["lotes"][lote["id"]] = lote_pixels.tolist()
        # Cópia por lote evita que a marca de um vizinho cubra sua evidência.
        local = imagem.copy()
        lapis = ImageDraw.Draw(local)
        lapis.line([tuple(xy) for xy in lote_pixels], fill="magenta", width=4)
        x, y = np.mean(lote_pixels[:-1], axis=0)
        lapis.ellipse((x-35, y-35, x+35, y+35), outline="magenta", width=3)
        recorte = local.crop((int(x)-600, int(y)-500, int(x)+600, int(y)+500))
        recorte.save(OUT / f"{lote['id']}-anexo{anexo}.jpg", quality=90)
        desenhar.ellipse((x-40, y-40, x+40, y+40), outline="magenta", width=7)
    geral.thumbnail((1800, 2400))
    geral.save(OUT / f"anexo{anexo}-localizados.jpg", quality=90)
(BASE / "zonas-posicionamento.json").write_text(
    json.dumps(relatorio, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
print(json.dumps({k: {"rmse_m": v["rmse_controles_m"], "maximo_m": max(v["residuos_controles_m"])} for k, v in relatorio.items()}, indent=2))

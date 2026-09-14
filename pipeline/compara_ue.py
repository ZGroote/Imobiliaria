# -*- coding: utf-8 -*-
"""Poe a foto do three e a do Unreal lado a lado, com as MESMAS medidas do portao.

    python pipeline/compara_ue.py

Sai `unreal/_comparacao.png` (as duas empilhadas) e uma tabela no terminal.

As medidas sao as do `pipeline/mede_interior.py`, pelo mesmo motivo que elas existem
la: "ficou melhor" decidido no olho e como esta cena chegou onde chegou. Aqui elas
servem pra uma coisa a mais -- garantir que a comparacao nao esta medindo BRILHO. Se
as duas imagens tiverem media muito diferente, a mais clara ganha no olho sem ter
ganhado em nada, e a conclusao seria sobre exposicao, nao sobre renderizador.

O corte: a foto do three sai 1280x760 com os paineis da interface por cima; a do UE
sai 1216x640 limpa. Compara-se o MIOLO das duas (60% central), que e onde ha comodo
nos dois casos e onde nao ha painel em nenhum.
"""
import io, os, sys

import numpy as np
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRES = os.path.join(RAIZ, "unreal", "_junta.png")
UE = os.path.join(RAIZ, "unreal", "capturas", "sanca-135-29_ue_L008.png")
SAIDA = os.path.join(RAIZ, "unreal", "_comparacao.png")


def miolo(im):
    w, h = im.size
    return im.crop((int(w * 0.20), int(h * 0.20), int(w * 0.80), int(h * 0.80)))


def mede(im):
    a = np.asarray(miolo(im).convert("RGB")).astype(np.float32)
    lum = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]
    mx = a.max(axis=2)
    mn = a.min(axis=2)
    croma = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0.0)
    p05, p50, p95, p99 = np.percentile(lum, [5, 50, 95, 99])
    return {
        "media": float(lum.mean()),
        "p05": float(p05), "p50": float(p50), "p95": float(p95), "p99": float(p99),
        "faixa": float(p95 - p05),
        "escuro%": float((lum < 70).mean() * 100.0),
        "queimado%": float((mx >= 252).mean() * 100.0),
        "croma": float(croma.mean()),
    }


def main():
    faltando = [p for p in (TRES, UE) if not os.path.exists(p)]
    if faltando:
        print("falta: %s" % ", ".join(faltando))
        return 1
    a, b = Image.open(TRES).convert("RGB"), Image.open(UE).convert("RGB")
    ma, mb = mede(a), mede(b)

    print("%-11s %8s %8s" % ("medida", "three", "unreal"))
    for k in ("media", "p05", "p50", "p95", "p99", "faixa", "escuro%", "queimado%", "croma"):
        print("%-11s %8.2f %8.2f" % (k, ma[k], mb[k]))

    # empilhadas na mesma largura, three em cima
    larg = min(a.width, b.width)
    ra = a.resize((larg, int(a.height * larg / a.width)), Image.LANCZOS)
    rb = b.resize((larg, int(b.height * larg / b.width)), Image.LANCZOS)
    fora = Image.new("RGB", (larg, ra.height + rb.height + 6), (24, 24, 24))
    fora.paste(ra, (0, 0))
    fora.paste(rb, (0, ra.height + 6))
    fora.save(SAIDA)
    print("\n%s  (three em cima, unreal embaixo)" % SAIDA)
    return 0


if __name__ == "__main__":
    sys.exit(main())

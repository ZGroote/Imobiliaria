# -*- coding: utf-8 -*-
"""Confere, sobre paginas JA MONTADAS, que o recorte preservou a IDENTIDADE do que sobrou.

Invocador manual. A verificacao mora em `pipeline/recorte.py` (`diverge`), e e a mesma
que o build por imovel roda na montagem: la, uma divergencia aborta o build. Aqui ela so
compara duas paginas prontas, a do recorte e a cheia, e diz o resultado.

    python pipeline/testa_recorte.py imovel/sao-carlos/sanca-135-29.html
"""
import io
import json
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
from pipeline.recorte import _predios, diverge  # noqa: E402

CHEIA = os.path.join(RAIZ, "v16-moveis", "sao-carlos-v16-moveis-aberto.html")


def bloco(caminho, ident):
    texto = io.open(caminho, encoding="utf-8", errors="replace").read()
    m = re.search(r'id="%s">([\s\S]*?)</script>' % ident, texto)
    return json.loads(m.group(1)) if m else None


def main(alvo):
    cheia, corte = bloco(CHEIA, "__citydata"), bloco(alvo, "__citydata")
    erros = diverge(cheia, corte, bloco(CHEIA, "__urbanModels"), bloco(alvo, "__urbanModels"))
    print("predios no recorte: %d" % sum(len(v) for v in _predios(corte).values()))
    print("  divergencias: %d" % len(erros))
    for tipo, pos, a, b in erros[:10]:
        print("    %-16s em %s: recorte=%s cheia=%s" % (tipo, pos, a, b))
    print("RESULTADO: %s" % ("ok" if not erros else "REPROVADO"))
    return 0 if not erros else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1] if len(sys.argv) > 1
                          else os.path.join(RAIZ, "imovel", "sao-carlos",
                                            "sanca-135-29.html")))

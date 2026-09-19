# -*- coding: utf-8 -*-
"""Confere que o recorte preservou a IDENTIDADE do que sobrou.

Tamanho menor nao prova nada: trocar o nome, a altura ou o modelo de casa de todos os
predios depois do primeiro corte produz um arquivo menor e uma pagina que renderiza.
O que se mede aqui e, para cada predio do recorte, se ele continua sendo O MESMO
predio da pagina cheia -- mesma altura, mesma cor, mesmo nome, mesmo modelo urbano --
achado pela POSICAO, que e a unica coisa que o recorte nao pode mexer.

    python pipeline/testa_recorte.py imovel/sao-carlos/sanca-135-29.html
"""
import io
import json
import re
import sys
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHEIA = os.path.join(RAIZ, "v16-moveis", "sao-carlos-v16-moveis-aberto.html")


def bloco(caminho, ident):
    texto = io.open(caminho, encoding="utf-8", errors="replace").read()
    m = re.search(r'id="%s">([\s\S]*?)</script>' % ident, texto)
    return json.loads(m.group(1)) if m else None


def predios(c):
    """{(x,z) do primeiro vertice: (cor, altura, n_vertices, indice)}"""
    b, q = c["b"], c.get("q", 10)
    fora, i, n = {}, 0, 0
    while i < len(b):
        cor, alt = b[i], b[i + 1]
        k = b[i + 2]
        x, z = b[i + 3], b[i + 4]
        fora[(x, z)] = (cor, alt, k, n)
        i += 3 + 2 * k
        n += 1
    return fora


def nomes(c):
    """indice do predio -> (nome, endereco)"""
    ns = c.get("names") or []
    fora = {}
    for i in range(0, len(c.get("bm") or []), 3):
        bm = c["bm"]
        fora[bm[i]] = (ns[bm[i + 1]] if bm[i + 1] < len(ns) else None,
                       ns[bm[i + 2]] if bm[i + 2] < len(ns) else None)
    return fora


def main(alvo):
    cheia = bloco(CHEIA, "__citydata")
    corte = bloco(alvo, "__citydata")
    um_cheia = bloco(CHEIA, "__urbanModels")
    um_corte = bloco(alvo, "__urbanModels")

    pc, pr = predios(cheia), predios(corte)
    nc, nr = nomes(cheia), nomes(corte)
    ulc = cheia.get("urbanLots") or {}
    ulr = corte.get("urbanLots") or {}
    fa_c, fa_r = cheia.get("fa") or [], corte.get("fa") or []

    faltam = [k for k in pr if k not in pc]
    erros = []
    for chave, (cor, alt, k, idx) in pr.items():
        if chave not in pc:
            continue
        ccor, calt, ck, cidx = pc[chave]
        if (cor, alt, k) != (ccor, calt, ck):
            erros.append(("geometria", chave, (cor, alt, k), (ccor, calt, ck)))
            continue
        if nr.get(idx) != nc.get(cidx):
            erros.append(("nome", chave, nr.get(idx), nc.get(cidx)))
        if fa_r and fa_c and fa_r[idx] != fa_c[cidx]:
            erros.append(("fa", chave, fa_r[idx], fa_c[cidx]))
        vr, vc = ulr.get(str(idx)), ulc.get(str(cidx))
        if (vr is None) != (vc is None):
            erros.append(("urbanLot ausente", chave, vr, vc))
        elif vr is not None:
            # O indice do modelo mudou (a biblioteca encolheu); o que tem que bater
            # e o ID do modelo, e a posicao/rotacao gravadas.
            ir, ic = vr[0], vc[0]
            id_r = um_corte["assets"][ir]["id"] if ir < len(um_corte["assets"]) else None
            id_c = um_cheia["assets"][ic]["id"] if ic < len(um_cheia["assets"]) else None
            if id_r != id_c or vr[1:] != vc[1:]:
                erros.append(("modelo urbano", chave, (id_r, vr[1:]), (id_c, vc[1:])))

    print("predios no recorte: %d" % len(pr))
    print("  sem par na pagina cheia: %d" % len(faltam))
    print("  com nome: %d (cheia: %d)" % (len(nr), len(nc)))
    print("  com modelo urbano: %d" % len(ulr))
    print("  divergencias: %d" % len(erros))
    for tipo, chave, a, b in erros[:10]:
        print("    %-16s em %s: recorte=%s cheia=%s" % (tipo, chave, a, b))
    if faltam:
        print("    FALTAM (primeiros 5): %s" % faltam[:5])

    ok = not erros and not faltam
    print("RESULTADO: %s" % ("ok" if ok else "REPROVADO"))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1] if len(sys.argv) > 1
                          else os.path.join(RAIZ, "imovel", "sao-carlos",
                                            "sanca-135-29.html")))

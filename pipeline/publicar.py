# -*- coding: utf-8 -*-
"""Prepara a pagina comprimida pra virar Artifact (pagina hospedada).

Duas diferencas em relacao ao arquivo de duplo clique, e so duas:

1. O TITULO. Offline ele sai do `renderizador/cabeca.html` e descreve o ARQUIVO --
   "<cidade> - mapa 3D ({{VERSAO}} - duplo clique)". Hospedado, o titulo e o nome da
   coisa numa galeria ao lado de dezenas de outras: vira nome de produto, nao legenda.
2. O BOM do inicio. O arquivo e concatenado a partir de `cabeca.html`, que tem BOM; ele
   e inofensivo num arquivo local e vira caractere invisivel quando a pagina e embrulhada
   por outro documento.

O resto - dado, programa, three.js - vai byte a byte igual. Nao existe "versao web"
diferente da versao que abre por duplo clique; existe o mesmo arquivo com outro nome.

    python pipeline/publicar.py ribeirao-preto "Ribeirao Preto 3D"
"""
import io, os, re, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
# A versao tem UM dono: o montar.py, que e quem escreve a pagina. Aqui ela estava
# escrita de novo ("v9"), e quando a montagem passou pro v13 este script parou de achar
# o arquivo -- o mesmo conceito em dois lugares que o PADRAO.md existe pra matar.
from pipeline.build.config import VERSAO
PASTA = os.path.join(RAIZ, VERSAO)


def main():
    slug = sys.argv[1] if len(sys.argv) > 1 else "ribeirao-preto"
    nome = sys.argv[2] if len(sys.argv) > 2 else None
    origem = os.path.join(PASTA, "%s-%s.html" % (slug, VERSAO))
    if not os.path.exists(origem):
        print("nao achei %s -- rode pipeline/montar.py antes" % origem); return 1
    s = io.open(origem, encoding="utf-8", newline="").read()
    if s and s[0] == "﻿":
        s = s[1:]
    if nome:
        novo, n = re.subn(r"<title>[^<]*</title>", "<title>%s</title>" % nome, s, count=1)
        if not n:
            print("nao achei o <title>"); return 1
        s = novo
    # O NOME CARREGA A VERSAO, e por isso a pagina pode ser cacheada pra sempre.
    # O Firebase Hosting NAO responde 304 a If-None-Match/If-Modified-Since (medido):
    # revalidar custa os 10 MB inteiros, nao um cabecalho. Entao a pagina grande nunca
    # revalida (nome novo = URL nova) e quem revalida e o index de 400 bytes.
    saida = os.path.join(PASTA, "publicado")
    mapa = os.path.join(saida, "mapa")
    os.makedirs(mapa, exist_ok=True)
    arquivo = "%s-%s.html" % (slug, VERSAO)
    destino = os.path.join(mapa, arquivo)
    io.open(destino, "w", encoding="utf-8", newline="").write(s)

    # ponytail: o index aponta pra UMA cidade -- a ultima publicada. Se um dia subir
    # duas, isto vira uma lista dos arquivos de mapa/.
    io.open(os.path.join(saida, "index.html"), "w", encoding="utf-8", newline="").write(
        '<!doctype html><meta charset="utf-8">'
        '<title>%s</title>'
        '<meta http-equiv="refresh" content="0;url=/mapa/%s">'
        '<script>location.replace("/mapa/%s")</script>'
        '<a href="/mapa/%s">abrir o mapa</a>'
        % (nome or slug, arquivo, arquivo, arquivo))
    print("%.2f MB -> %s" % (len(s.encode("utf-8")) / 1e6, destino))
    return 0


if __name__ == "__main__":
    sys.exit(main())

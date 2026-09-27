# -*- coding: utf-8 -*-
"""Prepara a pagina comprimida pra virar Artifact (pagina hospedada).

Duas diferencas em relacao ao arquivo de duplo clique, e so duas:

1. O TITULO. Offline ele sai do `cabeca.html` da fonte da variante e descreve o ARQUIVO --
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
from pipeline.build.config import resolve

MANIFESTO_TILES = os.path.join(RAIZ, "exteriores", "v1", "terrenos-manifesto.json")


def confere_tiles(mapa):
    """Os tiles de quintal que a pagina VAI BUSCAR estao ao lado dela?

    A pagina pede `tileInfo.prefix + <chave>.bin` relativo a `location.href` (ver
    `exterior-details.js`). Quem os grava e `exteriores/v1/dividir_terrenos.py`, num
    diretorio com o hash do dado. Sem eles a pagina NAO quebra -- ela tenta de novo
    com recuo exponencial e escreve aviso no console pra sempre, e o mapa fica sem
    os 64.769 quintais. Publicar isso e publicar uma perda silenciosa; dai a conferencia.
    """
    if not os.path.exists(MANIFESTO_TILES):
        return None, []
    import json
    with io.open(MANIFESTO_TILES, encoding="utf-8") as arq:
        m = json.load(arq)
    base = os.path.join(mapa, m["prefix"].lstrip("./").replace("/", os.sep))
    faltam = [k for k in m["keys"] if not os.path.exists(os.path.join(base, k + ".bin"))]
    return m, faltam


def main():
    # `--variante` como no `rodar_qa` e no `montar`. Ate o #46 a variante saia so do
    # ambiente e caia no padrao, que era o v15: publicar sem a flag subia o renderizador
    # ANTIGO, em silencio, porque a pagina do v15 existe e e encontrada. Desde o #46,
    # sem a flag herda o v16-moveis; desde o #49 o v15 nem e mais variante.
    argv = [a for a in sys.argv[1:]]
    variante = None
    if "--variante" in argv:
        i = argv.index("--variante")
        if i + 1 >= len(argv):
            print("--variante precisa de um valor"); return 2
        variante = argv[i + 1]; del argv[i:i + 2]
    slug = argv[0] if argv else "ribeirao-preto"
    nome = argv[1] if len(argv) > 1 else None
    try:
        config = resolve(slug, variante)
    except ValueError as exc:
        print(str(exc)); return 2
    VERSAO = config.versao
    PASTA = os.path.join(RAIZ, VERSAO)
    origem = str(config.saida("html_comprimido"))
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

    m, faltam = confere_tiles(mapa)
    if m is None:
        print("  (sem manifesto de quintais: nada a conferir)")
    elif faltam:
        print("  QUINTAIS INCOMPLETOS: %d dos %d tiles faltam em %s"
              % (len(faltam), len(m["keys"]), m["prefix"]))
        print("  os %d quintais nao vao aparecer, e a pagina so avisa no console."
              % m["parcels"])
        print("  gere com: python exteriores/v1/dividir_terrenos.py")
        return 1
    else:
        print("  quintais: %d tiles conferidos (%d lotes)" % (len(m["keys"]), m["parcels"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())

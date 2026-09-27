# -*- coding: utf-8 -*-
"""Devolve pro disco os blocos de dado que estao EMBUTIDOS numa pagina montada.

O `montar.py` copia o TEXTO do arquivo de origem verbatim entre as tags
`<script type="application/json" id="__*">`. Entao a pagina aberta e, tambem, um
backup exato desses arquivos -- e este script e o caminho de volta.

Escrito para recuperar o dado de Sao Carlos depois que a pasta foi apagada por
engano: o `v15/sao-carlos-v15-aberto.html` continuava no disco com tudo dentro.

    python pipeline/extrair_dados.py v16-moveis/sao-carlos-v16-moveis-aberto.html            # so lista
    python pipeline/extrair_dados.py v16-moveis/sao-carlos-v16-moveis-aberto.html --escrever # grava o que falta
    python pipeline/extrair_dados.py <pagina> --escrever --forcar              # grava por cima

`--forcar` existe pra conferencia (extrair por cima de um arquivo que existe e comparar
byte a byte), NAO pro uso normal: sem ele, arquivo existente nunca e tocado.

O bloco `__arvores` nao sai daqui: ele e GERADO pelo montar.py (`bloco_arvores`), nao
copiado de um arquivo, entao nao ha caminho de volta -- e nem precisa, a biblioteca de
especies e que e a fonte.
"""
import io, os, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, ".."))
sys.path.insert(0, RAIZ)
from padrao.cidade import carrega, lista

# Os mesmos pares do montar.py, menos o `__arvores` (gerado, nao copiado).
BLOCOS = [("__imoveis", "imoveis"), ("__grounddata", "chao_tris"),
          ("__murosdata", "muros"), ("__streetdata", "rua_tris"),
          ("__elevdata", "relevo"), ("__portoes", "portoes"),
          ("__vegetacao", "vegetacao"), ("__citydata", "city_saida"),
          ("__poidata", "pois")]


def blocos_da_pagina(html):
    """id -> conteudo, exatamente como o montar.py o inseriu."""
    fora = {}
    for ident, _ in BLOCOS:
        abre = '<script type="application/json" id="%s">' % ident
        i = html.find(abre)
        if i < 0:
            continue
        j = html.index("</script>", i)
        fora[ident] = html[i + len(abre):j]
    return fora


def main():
    ar = [a for a in sys.argv[1:] if not a.startswith("-")]
    if not ar:
        print(__doc__); return 2
    pagina = os.path.abspath(ar[0])
    if not os.path.exists(pagina):
        print("pagina nao encontrada: %s" % pagina); return 2
    # A cidade sai do nome do arquivo, e o casamento e pelo slug mais longo que bate --
    # senao "ribeirao-preto" ganharia de "ribeirao-preto-oficial" pela ordem da lista.
    base = os.path.basename(pagina)
    cands = sorted([s for s in lista() if base.startswith(s)], key=len, reverse=True)
    if not cands:
        print("nao reconheci a cidade em %s (tem: %s)" % (base, ", ".join(lista()))); return 2
    cid = carrega(cands[0])
    escrever, forcar = "--escrever" in sys.argv, "--forcar" in sys.argv

    html = io.open(pagina, encoding="utf-8", newline="").read()
    achados = blocos_da_pagina(html)
    print("%s -> cidade %s, %d bloco(s) na pagina" % (base, cid.slug, len(achados)))
    escritos = iguais = 0
    for ident, chave in BLOCOS:
        if ident not in achados:
            print("  %-14s (ausente na pagina)" % ident); continue
        try:
            destino = cid.caminho(chave)
        except KeyError:
            print("  %-14s (a cidade nao declara '%s')" % (ident, chave)); continue
        dado = achados[ident]
        existe = os.path.exists(destino)
        rel = os.path.relpath(destino, RAIZ)
        if existe and not forcar:
            atual = io.open(destino, encoding="utf-8", newline="").read()
            print("  %-14s %8.1f KB  ja existe %s" % (ident, len(dado) / 1024.0,
                  "(identico)" if atual == dado else "(DIFERE -- nao toquei)"))
            iguais += (atual == dado)
            continue
        if not escrever:
            print("  %-14s %8.1f KB  FALTA -> %s" % (ident, len(dado) / 1024.0, rel)); continue
        os.makedirs(os.path.dirname(destino), exist_ok=True)
        io.open(destino, "w", encoding="utf-8", newline="").write(dado)
        print("  %-14s %8.1f KB  gravado -> %s" % (ident, len(dado) / 1024.0, rel))
        escritos += 1
    if not escrever:
        print("\n(nada foi escrito -- rode com --escrever)")
    else:
        print("\n%d arquivo(s) gravado(s)." % escritos)
    return 0


if __name__ == "__main__":
    sys.exit(main())

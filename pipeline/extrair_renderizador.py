# -*- coding: utf-8 -*-
"""UMA VEZ SO: quebra o HTML pronto em codigo-fonte de verdade.

Ate aqui o renderizador nao tinha arquivo. O codigo dele morava dentro de
`v3/sao-carlos-overture-v3.html` -- 6,9 MB dos quais 6,8 MB eram DADO colado no meio --
e ninguem gerava esse arquivo: foi editado a mao e virou o comeco de tudo. A pagina
final saia de quatro scripts encadeados fazendo busca-e-substitui de texto exato sobre
a saida do anterior:

    v3.html --make_v4(10 ancoras)--> v4 --make_v5(5)--> v5 --make_v7(30)--> v7
            --make_v8(14)--> v8            = 59 ancoras

Mudar UMA linha do renderizador significava editar um HTML de 6,9 MB a mao e torcer
pras 59 ancoras continuarem batendo -- e a quebra aparecia uma de cada vez, quatro
estagios depois.

Este script extrai do FIM da cadeia, nao do comeco: a fonte da verdade e o
`v8-aberto.html` que ja passou nos 7 portoes. Depois dele, `pipeline/montar.py` remonta
a pagina a partir das pecas, e a cadeia inteira de make_* vira historico.

    python pipeline/extrair_renderizador.py          # confere e mostra o plano
    python pipeline/extrair_renderizador.py --grava  # escreve renderizador/

O aceite e byte a byte: `montar.py` tem que reproduzir o HTML de onde as pecas sairam.
"""
import io, os, re, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..")) + os.sep
DEST = os.path.join(RAIZ, "renderizador")
FONTE = os.path.join(RAIZ, "v8", "sao-carlos-v8-aberto.html")

# ordem em que os blocos de dado aparecem na pagina -- montar.py depende dela
DADOS = ["__grounddata", "__murosdata", "__streetdata", "__elevdata",
         "__citydata", "__poidata"]


def fatia(s):
    """Devolve (cabeca, libs, css, corpo, app) e confere que o formato e o esperado."""
    blocos = []
    for m in re.finditer(r"<(script|style)([^>]*)>", s):
        tag = m.group(1); fim = s.find("</%s>" % tag, m.end())
        if fim < 0: raise SystemExit("bloco <%s> sem fechamento" % tag)
        blocos.append(dict(ini=m.start(), corpo_ini=m.end(), corpo_fim=fim,
                           fim=fim + len(tag) + 3, tag=tag, attrs=m.group(2).strip()))
    ids = [re.search(r'id="([^"]+)"', b["attrs"]) for b in blocos]
    ids = [m.group(1) if m else None for m in ids]
    if [i for i in ids if i] != DADOS:
        raise SystemExit("blocos de dado inesperados: %s" % [i for i in ids if i])
    libs = [b for b in blocos if b["tag"] == "script" and not b["attrs"]]
    if len(libs) != 3:
        raise SystemExit("esperava 3 <script> sem atributo (three, earcut, app); achei %d" % len(libs))
    css = [b for b in blocos if b["tag"] == "style"]
    if len(css) != 1: raise SystemExit("esperava 1 <style>")
    three, earcut, app = libs
    if app["ini"] < css[0]["ini"]: raise SystemExit("o app nao e o ultimo <script>")
    return dict(
        cabeca=s[:three["ini"]],
        three=s[three["corpo_ini"]:three["corpo_fim"]],
        earcut=s[earcut["corpo_ini"]:earcut["corpo_fim"]],
        css=s[css[0]["corpo_ini"]:css[0]["corpo_fim"]],
        corpo=s[blocos[-2]["fim"]:app["ini"]],
        app=s[app["corpo_ini"]:app["corpo_fim"]],
        rabo=s[app["fim"]:],
    )


def main():
    # newline="" e obrigatorio: sem ele a leitura universal troca CRLF por LF e a
    # pagina montada deixa de bater byte a byte com a original.
    s = io.open(FONTE, encoding="utf-8", newline="").read()
    p = fatia(s)
    print("de %s (%.2f MB):" % (os.path.relpath(FONTE, RAIZ), len(s) / 1e6))
    for k in ("cabeca", "three", "earcut", "css", "corpo", "app", "rabo"):
        print("  %-8s %9.1f KB" % (k, len(p[k]) / 1024))
    if "--grava" not in sys.argv:
        print("\n(nada escrito; use --grava)"); return
    os.makedirs(DEST, exist_ok=True)
    for nome, chave in (("cabeca.html", "cabeca"), ("estilo.css", "css"),
                        ("corpo.html", "corpo"), ("app.js", "app"), ("rabo.html", "rabo")):
        io.open(os.path.join(DEST, nome), "w", encoding="utf-8", newline="").write(p[chave])
        print("-> renderizador/%s" % nome)
    for nome, chave in (("lib/three.min.js", "three"), ("lib/earcut.min.js", "earcut")):
        alvo = os.path.join(DEST, nome.replace("/", os.sep))
        os.makedirs(os.path.dirname(alvo), exist_ok=True)
        io.open(alvo, "w", encoding="utf-8", newline="").write(p[chave])
        print("-> renderizador/%s" % nome)


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""Etapa 8: monta a pagina a partir das PECAS, em vez de patchear texto.

Substitui a cadeia `make_v4 -> make_v5 -> make_v7 -> make_v8` (59 ancoras de texto
exato, encadeadas). Aqui o renderizador e codigo de verdade em `renderizador/`, e a
pagina e a concatenacao das pecas com os blocos de dado no meio:

    cabeca.html  <- titulo e meta
    lib/three.min.js + lib/earcut.min.js
    estilo.css
    <script type="application/json" id="__*data">  os 6 blocos, na ordem
    corpo.html   <- canvas, HUD, painel
    app.js       <- O RENDERIZADOR (120 KB)

    python pipeline/montar.py                  # -> v8/sao-carlos-v8-aberto.html + v8.html
    python pipeline/montar.py --sem-zip        # so a versao aberta
    python pipeline/montar.py --conferir <arq> # exige saida byte a byte igual a <arq>

`--conferir` e o aceite da migracao: a pagina montada tem que reproduzir exatamente o
HTML de onde as pecas foram extraidas. Depois disso, `make_v4..make_v8` viram historico
(seguem em v4/, v5/, v7/, v8/ e nao sao mais chamados pelo runner).

O carimbo do HUD e a UNICA coisa que muda entre duas montagens do mesmo dado (a data),
entao `--conferir` normaliza os dois lados so nessa linha antes de comparar.
"""
import io, json, os, re, sys, time

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..")) + os.sep
sys.path.insert(0, RAIZ)
from padrao.cidade import carrega, lista

from pipeline.build.config import resolve, V_PADRAO, VERSAO
from pipeline.build import blocos as blocos_dado, folhas, pacotes
from pipeline.build.html import comprime, confere


def saida(chave, config=None):
    return str((config or resolve()).saida(chave))

# id do bloco -> chave da fonte no JSON da cidade. A ORDEM importa: o renderizador le
# o relevo antes de chao/rua/muro se registrarem no terrainRegistry.
# `imoveis` fica junto dos dados grandes (comprime bem e o app so o le tarde).
CARIMBO = re.compile(r'(<div class="sub" id="build"[^>]*>)[^<]*(</div>)')


def le(rel, config=None):
    return io.open(os.path.join((config or resolve()).fonte, rel.replace("/", os.sep)),
                   encoding="utf-8", newline="").read()


def monta(carimbo=None, config=None, recorte=None):
    config = config or resolve()
    CID = config.cidade()
    VERSAO = config.versao
    FONTE = str(config.fonte)
    def ler(rel):
        return le(rel, config)
    # Sem `recorte`, `rec` e a identidade e a pagina sai byte a byte igual a de sempre.
    def rec(ident, texto):
        return texto if recorte is None else recorte.aplica(ident, texto)
    carimbo = carimbo or "%s / %s / %s" % (CID.slug, VERSAO, time.strftime("%Y-%m-%d %H:%M"))
    partes = [ler("cabeca.html").replace("{{CIDADE}}", CID.nome).replace("{{VERSAO}}", VERSAO),
              '<script type="application/json" id="__cidade">', blocos_dado.bloco_cidade(CID), "</script>\n",
              '<script type="application/json" id="__unidades">', rec("__unidades", blocos_dado.bloco_unidades(CID)), "</script>\n",
              '<script type="application/json" id="__luzue">', rec("__luzue", blocos_dado.bloco_luzue(CID)), "</script>\n",
              '<script type="application/json" id="__moveis">', blocos_dado.bloco_moveis(), "</script>\n",
              '<script type="application/json" id="__textura">', blocos_dado.bloco_textura(), "</script>\n",
              "<script>", ler("lib/three.min.js"), "</script>\n",
              "<script>", ler("lib/earcut.min.js"), "</script>\n",
              "<style>", folhas.folha(config), "</style>\n"]
    for ident, chave in blocos_dado.DADOS:
        if ident == "__arvores":
            partes += ['<script type="application/json" id="%s">' % ident,
                       blocos_dado.bloco_arvores(CID), "</script>\n"]
            continue
        p = CID.caminho(chave)
        # Bloco ausente vira lista vazia em vez de quebrar a montagem: cidade nova pode
        # nao ter POI mapeado nem muro, e o renderizador ja trata array vazio (o
        # buildX() correspondente simplesmente nao cria malha). O que NAO pode faltar e
        # a base da cidade -- sem ela nao ha o que desenhar.
        if os.path.exists(p):
            d = io.open(p, encoding="utf-8", newline="").read()
        elif chave == "city_saida":
            raise SystemExit("falta a base da cidade: %s" % p)
        else:
            d = "[]"; print("  (sem %s: bloco %s vazio)" % (os.path.basename(p), ident))
        if chave == "city_saida":
            d = pacotes.com_encaixes(config, CID, d)
        partes += ['<script type="application/json" id="%s">' % ident, rec(ident, d), "</script>\n"]
    corpo = ler("corpo.html").replace("{{CIDADE}}", CID.nome)
    corpo = CARIMBO.sub(lambda m: m.group(1) + carimbo + m.group(2), corpo)
    urban = ""
    dados_urbanos = pacotes.urbanos(config)
    if dados_urbanos is not None:
        urban = ler("terrain-fit.js") + "\n" + ler("road-clearance.js") + "\n" + ler("urban-models.js") + "\n"
        partes += ['<script type="application/json" id="__urbanModels">',
                   rec("__urbanModels", dados_urbanos), "</script>\n"]
    dados_exteriores = pacotes.exteriores(config, CID)
    if dados_exteriores is not None:
        partes += ['<script type="application/json" id="__exteriorModels">',
                   rec("__exteriorModels", dados_exteriores), "</script>\n"]
        urban += ler("exterior-details.js") + "\n"
    listing_js = ""
    dados_cadastrados = pacotes.cadastrados(config, CID)
    if dados_cadastrados is not None:
        partes += ['<script type="application/json" id="__listingModels">',
                   rec("__listingModels", dados_cadastrados), "</script>\n"]
        listing_js = ler("listing-models.js")
    if (config.fonte / 'modules.json').exists():
        from pipeline.build.scripts import programa
        script = programa(config)
    else:
        script = urban + listing_js + ler('app.js')
    partes += [corpo, "<script>", script, "</script>", ler("rabo.html")]
    if (config.fonte / 'scene/diagnostics.js').exists():
        partes.insert(1, '<meta name="mapa-diagnostics" content="1">')
    return "".join(partes)


def main(argv=None):
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('cidade', nargs='?')
    parser.add_argument('--variante')
    parser.add_argument('--destino', help='Diretorio isolado para os dois HTMLs')
    parser.add_argument('--sem-zip', action='store_true')
    parser.add_argument('--conferir')
    args = parser.parse_args(argv)
    try:
        config = resolve(args.cidade, args.variante, args.destino)
        s = monta(config=config)
    except (ValueError, KeyError) as exc:
        parser.error(str(exc))
    if args.conferir:
        return confere(s, args.conferir)
    aberto = saida("html_saida", config)
    os.makedirs(os.path.dirname(aberto), exist_ok=True)
    io.open(aberto, "w", encoding="utf-8", newline="").write(s)
    print("aberto: %.2f MB -> %s" % (len(s) / 1e6, aberto))
    if args.sem_zip: return 0
    print("  comprimindo:")
    z = comprime(s)
    alvo = saida("html_comprimido", config)
    io.open(alvo, "w", encoding="utf-8", newline="").write(z)
    print("comprimido: %.2f MB -> %s (-%.0f%%)"
          % (len(z) / 1e6, alvo, 100 * (1 - len(z) / len(s))))
    return 0


if __name__ == "__main__":
    sys.exit(main())

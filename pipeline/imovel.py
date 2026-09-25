# -*- coding: utf-8 -*-
"""Uma pagina por imovel cadastrado: o mapa recortado em volta do lote.

    python pipeline/imovel.py                      # todas as unidades da cidade
    python pipeline/imovel.py --id sanca-135-29    # so uma
    python pipeline/imovel.py --raio 800           # outro raio

A pagina e a MESMA do mapa, montada pelo mesmo `montar.monta()`, com dois acrescimos:

  1. os blocos passam por `pipeline/recorte.py`, que joga fora o que esta alem do
     raio -- e so isso que muda de tamanho;
  2. um trecho no topo do corpo fixa a camera no lote quando a URL nao traz posicao,
     usando o `?em=lat,lon&r&p&t` que o `ui/position-link.js` JA le. Nao ha modo
     novo nem camera nova: e o link de posicao que o mapa sempre soube ler.

E o botao "Navegar pelo mapa" e uma ANCORA pro mapa completo, na mesma posicao. A
alternativa era carregar o resto da cidade por cima do recorte em runtime, o que pede
re-decodificar `b[]` e re-registrar o streaming com a cena montada. Enquanto o
recarregamento nao incomodar em teste, a ancora entrega o mesmo comportamento por uma
linha de HTML.
"""
import argparse
import io
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline import montar, recorte
from pipeline.build import blocos as blocos_dado
from pipeline.build.config import RAIZ, resolve

# Enquadramento inicial da orbita: raio em metros, phi (altura) e theta (giro).
# phi 0,78 e meia altura -- de cima demais some a fachada, de baixo demais o telhado
# do vizinho come o lote.
VISTA = {"r": 420, "p": 0.78, "t": 0.60}


MODOS = ("aerea", "ficha", "planta", "visita")


def _deep_link(unidade_id):
    """`?imovel=<slug>&modo=<aerea|ficha|planta|visita>`.

    Sai daqui, nao do renderizador, porque tudo de que precisa ja esta exposto em
    `window.__int` -- a porta que existe pro QA headless (app.js:2549). `UNIDADES`
    diz quem e quem, `abreUnidade` voa e abre a ficha, `enterInterior` entra e
    `vista(true)` troca pra planta. Nenhuma funcao nova no mapa.

    A repeticao existe porque o alvo pode nao estar montado ainda: o streaming monta
    por quarteirao e a unidade so abre depois que o predio dela chegou. Sem a espera
    isto falha em silencio nas primeiras visitas e funciona no recarregamento, que e
    o pior tipo de defeito."""
    return (
        '<script>\n'
        '(function () {\n'
        '  var dono = %s;\n'
        '  var p = new URLSearchParams(location.search);\n'
        '  var imovel = p.get("imovel") || dono;\n'
        '  var modo = (p.get("modo") || "aerea").toLowerCase();\n'
        '  if (modo === "aerea") return;   // ja e o padrao: orbita o lote pelo ?em=\n'
        '  var tentativas = 0;\n'
        '  (function tenta() {\n'
        '    if (++tentativas > 240) return;            // ~40 s e desiste calado\n'
        '    var I = window.__int;\n'
        '    if (!I || !I.UNIDADES) return setTimeout(tenta, 160);\n'
        '    var u = null;\n'
        '    for (var i = 0; i < I.UNIDADES.length; i++)\n'
        '      if (I.UNIDADES[i].id === imovel) { u = I.UNIDADES[i]; break; }\n'
        '    if (!u) return;                            // nao esta neste recorte\n'
        '    try {\n'
        '      if (modo === "ficha") { I.abreUnidade(u); return; }\n'
        '      if (!I.INT || !I.INT.on) { I.enterInterior(null, u);\n'
        '                                 return setTimeout(tenta, 160); }\n'
        '      if (modo === "planta") I.vista(true);\n'
        '    } catch (e) { setTimeout(tenta, 160); }\n'
        '  })();\n'
        '})();\n'
        '</script>\n'
    ) % json.dumps(unidade_id)


def _voltar(maquete_href):
    """O "Voltar ao imovel", ou nada.

    Sem `maquete_href` nao existe ficha pra onde voltar -- `pipeline/imovel.py` roda
    sozinho e gera mapa sem maquete ao lado --, e um botao que nao volta pra lugar
    nenhum e pior que botao ausente.

    `history.back()` quando a pessoa VEIO da maquete: o navegador devolve a pagina do
    bfcache, no angulo em que ela estava, sem baixar 2 MB de novo. Quando ela chegou
    por link direto nao ha historico, e a ancora carrega a pagina normalmente. Por
    isso e uma ancora de verdade e nao um botao: ela funciona nos dois casos, e ainda
    abre noutra aba no botao do meio.
    """
    if not maquete_href:
        return ''
    return (
        '<a id="voltarImovel" class="card" href="%s"\n'
        '   title="Voltar para a ficha e a maquete deste imovel">&lsaquo; Voltar ao im&oacute;vel</a>\n'
        '<script>\n'
        'addEventListener("click", function (ev) {\n'
        '  var a = ev.target.closest && ev.target.closest("#voltarImovel");\n'
        '  if (!a || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return;\n'
        '  try {\n'
        '    if (document.referrer === new URL(a.getAttribute("href"), location.href).href) {\n'
        '      ev.preventDefault(); history.back();\n'
        '    }\n'
        '  } catch (e) { /* sem URL() ou origem opaca: a ancora leva do jeito normal */ }\n'
        '}, true);\n'
        '</script>\n'
        '<style>\n'
        '/* NA MESMA LINHA do "Navegar pelo mapa", e nao embaixo dele. Medido nesta\n'
        '   pagina: a vitrine de imoveis ocupa o canto direito de y=54 pra baixo, entao\n'
        '   so cabe UM botao empilhado ali -- o segundo cairia em cima do titulo dela.\n'
        '   A faixa de y=14 a 47 esta livre da busca (que acaba em x=228) ate a vitrine,\n'
        '   e e onde os dois cabem lado a lado.\n'
        '   Voltar fica no canto, que e a posicao de mais alcance: e a acao de quem ja\n'
        '   viu o que queria. O empurrao no #irAoMapa vale so no tamanho grande; no\n'
        '   estreito ele ja desce pro rodape sozinho. */\n'
        '#voltarImovel{position:fixed;right:14px;top:14px;z-index:41;padding:9px 13px;\n'
        '  border-radius:10px;text-decoration:none;color:#e8edf2;\n'
        '  font:600 13px/1 system-ui,-apple-system,sans-serif}\n'
        '#voltarImovel:hover{color:#fff}\n'
        '@media (min-width:701px){#irAoMapa{right:168px}}\n'
        '/* Dentro do apartamento ele sai, pelo mesmo motivo do #irAoMapa: a ancora\n'
        '   cobre os controles do interior, e ali dentro ja existe "Voltar ao mapa". */\n'
        'body.dentro #voltarImovel{display:none}\n'
        '@media (max-width:700px){#voltarImovel{top:auto;bottom:118px;right:10px}}\n'
        '</style>\n'
    ) % _esc(maquete_href)


def _snippet(lat, lon, mapa_href, titulo):
    """Posicao inicial + botao de navegar, inserido antes do canvas."""
    em = "em=%.5f,%.5f&r=%d&p=%.2f&t=%.2f" % (lat, lon, VISTA["r"], VISTA["p"],
                                              VISTA["t"])
    return (
        '<script>\n'
        '/* Pagina de um imovel: abre enquadrado no lote. `lerLink()` do\n'
        '   ui/position-link.js le location.search no boot, entao basta escrever a\n'
        '   posicao ANTES do programa rodar -- replaceState nao recarrega.\n'
        '   Se a pessoa chegou com posicao propria no link, ela manda. */\n'
        'try {\n'
        '  var _p = new URLSearchParams(location.search);\n'
        '  if (!_p.get("em")) {\n'
        '    var _b = _p.toString();\n'
        '    history.replaceState(null, "", location.pathname + "?" +\n'
        '      (_b ? _b + "&" : "") + %s + location.hash);\n'
        '  }\n'
        '} catch (e) { /* origem opaca em file:// recusa: abre no centro da cidade */ }\n'
        '/* O mapa completo abre ONDE A PESSOA ESTA, nao onde o imovel esta: o\n'
        '   position-link.js mantem ?em/r/p/t atualizados enquanto ela orbita, entao\n'
        '   basta carregar a busca corrente no clique. */\n'
        'addEventListener("click", function (ev) {\n'
        '  var a = ev.target.closest && ev.target.closest("#irAoMapa");\n'
        '  if (a) a.search = location.search;\n'
        '}, true);\n'
        '</script>\n'
        '<a id="irAoMapa" class="card" href="%s"\n'
        '   title="Abrir a cidade inteira nesta mesma posicao">Navegar pelo mapa ›</a>\n'
        '<style>\n'
        '/* `color` explicito: sem ele a ancora herda o azul de link do navegador,\n'
        '   que nao existe em lugar nenhum do resto da interface. */\n'
        '#irAoMapa{position:fixed;right:14px;top:14px;z-index:40;padding:9px 13px;\n'
        '  border-radius:10px;text-decoration:none;color:#e8edf2;\n'
        '  font:600 13px/1 system-ui,-apple-system,sans-serif}\n'
        '#irAoMapa:hover{color:#fff}\n'
        '/* Dentro do apartamento ele SAI. A ancora ocupa de right:14px pra dentro e\n'
        '   cobre o `#imob` (right:62px), entao clicar em "Moveis" saia da pagina. E\n'
        '   ali dentro ja existe "Voltar ao mapa". `body.dentro` e o sinal do proprio\n'
        '   renderizador (estilo/80-moveis.css). */\n'
        'body.dentro #irAoMapa{display:none}\n'
        '@media (max-width:700px){#irAoMapa{top:auto;bottom:76px;right:10px}}\n'
        '</style>\n'
    ) % (json.dumps(em), mapa_href)


def _esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def _brl(v):
    """190662.66 -> "R$ 190.662,66". O formato do Python usa virgula pra milhar e
    ponto pra decimal; aqui os dois trocam de lugar."""
    return "R$ " + "{:,.2f}".format(v).translate(str.maketrans(",.", ".,"))


def _texto_da_ficha(u):
    """(titulo, descricao) desta unidade, pro <title> e pras OG tags."""
    f = u.get("ficha") or {}
    nome = f.get("empreendimento") or f.get("titulo") or u.get("id")
    lugar = ", ".join(x for x in (f.get("bairro"), f.get("municipio")) if x)
    partes = []
    if f.get("area_util"):
        partes.append(("%0.1f m2" % f["area_util"]).replace(".", ",").replace("m2", "m²"))
    q = f.get("quartos")
    if q:
        partes.append("%d dorm." % q if q > 1 else "1 dormitório")
    if f.get("suites"):
        partes.append("%d suíte%s" % (f["suites"], "s" if f["suites"] > 1 else ""))
    if f.get("vagas"):
        partes.append("%d vaga%s" % (f["vagas"], "s" if f["vagas"] > 1 else ""))
    if f.get("preco"):
        partes.append(_brl(f["preco"]) + ("/mês" if f.get("tipo") == "aluguel" else ""))
    else:
        partes.append("Sob consulta")
    titulo = nome + (" — " + " · ".join(partes[:2]) if partes else "")
    desc = " · ".join(partes)
    if lugar:
        desc = (desc + " · " if desc else "") + lugar
    localizacao = u.get("lote") or u.get("ancora") or {}
    if localizacao.get("confirmado") is not True:
        desc += ". Localização aproximada, ainda não confirmada"
    return titulo, desc + (". Mapa 3D com planta e visita pelo apartamento."
                           if desc else "Mapa 3D com planta e visita.")


def _cabeca(u, base, url=None, imagem=None):
    """<title> proprio e OG tags — o preview do WhatsApp le o HTML CRU.

    Por isso elas tem que estar no arquivo, nao postas por JS: nenhum robo de preview
    executa script. E a razao de existir um HTML por imovel em vez de um mapa so
    respondendo a `?imovel=` -- alem do peso, que e a outra metade.

    `url` e a URL canonica; sem ela, sai do nome fisico ao lado do mapa
    (`<base>/imovel-<id>.html`). `og:image` so com `imagem` dada: a foto e gerada a
    parte (pipeline/foto.py), e deduzir o endereco dela da `base` punha no preview
    uma imagem que podia nao existir (N4)."""
    titulo, desc = _texto_da_ficha(u)
    url = url or ((base.rstrip("/") + "/imovel-%s.html" % u["id"]) if base else None)
    m = ['<title>%s</title>' % _esc(titulo),
         '<meta name="description" content="%s">' % _esc(desc),
         '<meta property="og:type" content="website">',
         '<meta property="og:site_name" content="Mapa 3D">',
         '<meta property="og:title" content="%s">' % _esc(titulo),
         '<meta property="og:description" content="%s">' % _esc(desc),
         '<meta name="twitter:card" content="summary_large_image">']
    if url:
        m.append('<meta property="og:url" content="%s">' % _esc(url))
    if imagem:
        m.append('<meta property="og:image" content="%s">' % _esc(imagem))
    return "\n".join(m) + "\n"


def _unidades(CID, apenas=None):
    todas = json.loads(blocos_dado.bloco_unidades(CID))
    fica = []
    for u in todas:
        if not (u.get("lote") or {}).get("lat"):
            continue
        if not (u.get("planta") or {}).get("comodos"):
            continue
        if apenas and u.get("id") not in apenas:
            continue
        fica.append(u)
    return fica


def gera(config, unidade, raio, destino, mapa_href, base="", maquete_href=None,
         prefixo_tiles=None, url=None, imagem=None, carimbo=None):
    CID = config.cidade()
    lote = unidade["lote"]
    r = recorte.para_unidade(CID, unidade, raio, prefixo_tiles)
    t0 = time.time()
    # Sem `carimbo`, o montador poe a hora no HUD e duas paginas do mesmo dado saem
    # diferentes. Quem precisa de pagina reproduzivel (pipeline/build_imovel.py) passa
    # um fixo.
    html = montar.monta(carimbo=carimbo, config=config, recorte=r)
    alvo = os.path.join(destino, "imovel-%s.html" % unidade["id"])
    # O <title> do mapa vira o do imovel, e as OG tags entram no lugar dele -- que ja
    # esta dentro do <head> implicito, antes de qualquer script.
    novo, n = re.subn(r"<title>[^<]*</title>", lambda _: _cabeca(unidade, base, url, imagem),
                      html, count=1)
    if not n:
        raise SystemExit("nao achei o <title> pra trocar pelo do imovel")
    html = novo
    corte = html.index('<canvas id="c">')
    html = (html[:corte]
            + _snippet(lote["lat"], lote["lon"], mapa_href, unidade["id"])
            + _voltar(maquete_href)
            + _deep_link(unidade["id"])
            + html[corte:])
    io.open(alvo, "w", encoding="utf-8", newline="").write(html)
    return alvo, r, time.time() - t0


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--cidade", default=None)
    p.add_argument("--variante", default=None)
    p.add_argument("--raio", type=float, default=2500.0,
                   help="metros em volta do lote (padrao 2500)")
    p.add_argument("--id", action="append", dest="ids",
                   help="so esta unidade; pode repetir")
    p.add_argument("--destino", default=None)
    p.add_argument("--base", default="",
                   help="URL publica da pasta (ex.: https://exemplo.web.app/mapa); "
                        "sem ela as OG tags saem sem og:url")
    p.add_argument("--mapa", default=None,
                   help="href do mapa completo pro botao Navegar; sem isto, aponta "
                        "pro HTML que esta build produz")
    args = p.parse_args(argv)

    config = resolve(args.cidade, args.variante)
    CID = config.cidade()

    # A pagina do imovel nasce IRMA do mapa publicado, dentro de `publicado/mapa/`.
    # Nao e arrumacao: os tiles de quintal sao buscados como `./quintais/<chave>.bin`
    # RELATIVO a pagina (exterior-details.js), e so existem ali. Numa pasta propria
    # sao 186 pedidos 404 por pagina, sem erro visivel -- o mapa so fica sem os
    # 64.769 quintais e avisa no console. Mesmo motivo do `confere_tiles` do
    # publicar.py.
    destino = args.destino or os.path.join(
        os.path.dirname(str(config.saida("html_comprimido", CID))), "publicado", "mapa")
    os.makedirs(destino, exist_ok=True)

    # Sem --mapa, o botao aponta pro mapa publicado ao lado; se ele ainda nao foi
    # publicado, pro nome que `publicar.py` vai dar.
    mapa_href = args.mapa or ("%s-%s.html" % (CID.slug, config.versao))

    unidades = _unidades(CID, set(args.ids) if args.ids else None)
    if not unidades:
        raise SystemExit("nenhuma unidade com lote e comodos em %s" % CID.slug)

    print("cidade %s / variante %s / raio %.0f m" % (CID.slug, config.versao, args.raio))
    for u in unidades:
        alvo, r, dt = gera(config, u, args.raio, destino, mapa_href, args.base)
        mb = os.path.getsize(alvo) / 1e6
        print("\n%s -> %s" % (u["id"], os.path.relpath(alvo, RAIZ)))
        print("   %.2f MB em %.0f s" % (mb, dt))
        for chave in ("quarteiroes", "predios"):
            if chave in r.relatorio:
                de, para = r.relatorio[chave]
                print("   %-12s %7d -> %6d" % (chave, de, para))
        for ident, (antes, depois) in sorted(r.relatorio.items()):
            if ident.startswith("__"):
                print("   %-18s %7.2f -> %6.2f MB" % (ident, antes / 1e6, depois / 1e6))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

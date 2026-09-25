# -*- coding: utf-8 -*-
"""Publicacao de um build de imovel no site de imoveis (proposta, secao 7).

    python pipeline/publicar_imovel.py montar-preview <id> <build>
    python pipeline/publicar_imovel.py montar-live promover <id> <build> --estado-vazio
    python pipeline/publicar_imovel.py montar-live promover <id> <build> --estado estado.json
    python pipeline/publicar_imovel.py montar-live reverter <id> --estado estado.json

Por enquanto so monta, sem Firebase e sem rede: `publicacao/site/` vira exatamente o que o
proximo deploy sobe (o `public` do firebase.imoveis.json).

- preview: so o build conferido e os tiles de quintal.
- live: o snapshot inteiro do site no ar, reconstruido do zero a partir do estado anterior
  (explicito: nada e lido do site):

      index.html  404.html  estado.json
      imovel/<id>  maquete/<id>            ponteiros, sem extensao
      b/<id>/<atual>/  b/<id>/<anterior>/  so esses dois, por imovel
      quintais/<hash>/*.bin

  Promover poe o build em `atual` e o atual em `anterior`; reverter troca os dois. Nenhum
  build e gerado de novo: todo arquivo de `b/` e copia conferida de `publicacao/builds/`.

`site/` nunca e atualizado no lugar: a montagem nasce em `publicacao/.site-*`, e conferida
inteira e so entao substitui `site/`; se algo falhar, o `site/` anterior fica como estava.

A ultima linha do stdout e um JSON com o resultado.
"""
import argparse
from datetime import datetime, timezone
import hashlib
from html import escape
import json
from pathlib import Path
import re
import shutil
import sys
import tempfile

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))

from pipeline.build_imovel import (ARQUIVOS, BUILDS, TERRENOS, build_id,  # noqa: E402
                                   prefixo_publico, SITE as SITE_PUBLICO)

SITE = RAIZ / 'publicacao/site'
# Onde os tiles moram no repositorio: ao lado do mapa publicado (os mesmos 239 que o mapa usa).
TILES = RAIZ / 'v16-moveis/publicado/mapa'
PUBLICADOS = ARQUIVOS + ('manifest.json',)
SLUG = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')        # o mesmo do painel (src/lib/publicacao.ts)
BUILD = re.compile(r'^[0-9a-f]{12}$')
PONTEIROS = (('imovel', 'tour.html'), ('maquete', 'maquete.html'))


def _sha(caminho):
    return hashlib.sha256(caminho.read_bytes()).hexdigest()


def _grava(caminho, texto):
    """LF sempre: `write_text` no Windows poria CRLF, e o estado.json guarda o hash dos bytes."""
    caminho.parent.mkdir(parents=True, exist_ok=True)
    caminho.write_bytes(texto.encode('utf-8'))


def confere_build(pasta, imovel, build):
    """O build e o que o manifest.json dele diz ser, byte a byte; devolve o manifesto."""
    manifesto = json.loads((pasta / 'manifest.json').read_text(encoding='utf-8'))
    if (manifesto.get('imovel'), manifesto.get('build')) != (imovel, build):
        raise ValueError('manifest.json de %s/%s diz ser %s/%s' % (
            imovel, build, manifesto.get('imovel'), manifesto.get('build')))
    dados = {}
    for n in ARQUIVOS:
        dados[n] = (pasta / n).read_bytes()
        esperado = manifesto['arquivos'][n]
        if (len(dados[n]), hashlib.sha256(dados[n]).hexdigest()) != (esperado['bytes'], esperado['sha256']):
            raise ValueError('%s de %s/%s nao bate com o manifest.json' % (n, imovel, build))
    if build_id(*(dados[n] for n in ARQUIVOS)) != build:
        raise ValueError('o conteudo de %s/%s nao e o do build %s' % (imovel, build, build))
    return manifesto


def troca_site(novo, site):
    """Poe `novo` no lugar de `site`, inteiro. O anterior sai de lado primeiro; se o novo nao
    conseguir entrar, o anterior volta. So depois do novo instalado o anterior e apagado."""
    if not site.exists():
        novo.rename(site)
        return
    anterior = Path(tempfile.mkdtemp(prefix='.site-anterior-', dir=site.parent))
    anterior.rmdir()                      # so o nome unico; o rename cria a pasta
    site.rename(anterior)
    try:
        novo.rename(site)
    except BaseException:
        anterior.rename(site)
        raise
    shutil.rmtree(anterior)


def _tiles(prefixo_do_build, terrenos):
    """(pasta, chaves) dos tiles de um build: o conjunto tem de ser o do manifesto dos terrenos."""
    t = json.loads(terrenos.read_text(encoding='utf-8'))
    if prefixo_do_build != prefixo_publico(t['prefix']):
        raise ValueError('o build usa os tiles %s, o manifesto dos terrenos traz %s'
                         % (prefixo_do_build, prefixo_publico(t['prefix'])))
    for k in t['keys']:
        if Path(k).name != k or '/' in k or '\\' in k:
            raise ValueError('chave de tile invalida: %r' % k)
    return prefixo_do_build.strip('/'), t['keys']


def _copia_tiles(trabalho, pasta, chaves, tiles_origem):
    (trabalho / pasta).mkdir(parents=True)
    for k in chaves:
        fonte = tiles_origem / pasta / (k + '.bin')
        if not fonte.is_file() or fonte.stat().st_size == 0:
            raise ValueError('tile ausente ou vazio: %s' % fonte)
        shutil.copyfile(fonte, trabalho / pasta / (k + '.bin'))
    return ['%s/%s.bin' % (pasta, k) for k in chaves]


def _copia_build(origem, trabalho, imovel, build):
    """Copia o build e confere a copia: o manifest.json publicado e o original, e o build
    continua batendo com ele. E o que o painel le para provar qual build revisa."""
    b = trabalho / 'b' / imovel / build
    b.mkdir(parents=True)
    for n in PUBLICADOS:
        shutil.copyfile(origem / n, b / n)
        if (b / n).read_bytes() != (origem / n).read_bytes():
            raise ValueError('%s de %s/%s mudou na copia' % (n, imovel, build))
    confere_build(b, imovel, build)
    return ['b/%s/%s/%s' % (imovel, build, n) for n in PUBLICADOS]


def _instala(site, preenche):
    """Monta em `publicacao/.site-*`, exige a arvore exata que `preenche` declara e so entao
    troca `site/` inteiro. Em qualquer falha a pasta temporaria sai e o site anterior fica."""
    site.parent.mkdir(parents=True, exist_ok=True)
    trabalho = Path(tempfile.mkdtemp(prefix='.site-', dir=site.parent))
    try:
        esperado = sorted(preenche(trabalho))
        arvore = sorted(p.relative_to(trabalho).as_posix() for p in trabalho.rglob('*') if p.is_file())
        if arvore != esperado:
            raise ValueError('a montagem tem arquivos alem do esperado: %s'
                             % sorted(set(arvore) ^ set(esperado))[:5])
        troca_site(trabalho, site)
    except Exception:
        shutil.rmtree(trabalho, ignore_errors=True)
        raise
    return arvore


def _resultado(site, arvore, **extra):
    return dict(extra, site=site.relative_to(RAIZ).as_posix() if site.is_relative_to(RAIZ) else str(site),
                arquivos=len(arvore), bytes=sum((site / a).stat().st_size for a in arvore))


def montar_preview(imovel, build, builds=BUILDS, tiles_origem=TILES, terrenos=TERRENOS, site=SITE):
    origem = builds / imovel / build
    if not origem.is_dir():
        raise ValueError('build inexistente: %s' % origem)
    manifesto = confere_build(origem, imovel, build)
    pasta_tiles, chaves = _tiles(manifesto['tiles'], terrenos)
    arvore = _instala(site, lambda t: _copia_build(origem, t, imovel, build)
                      + _copia_tiles(t, pasta_tiles, chaves, tiles_origem))
    raiz_b = '/b/%s/%s/' % (imovel, build)
    return _resultado(site, arvore, imovel=imovel, build=build, tour=raiz_b + 'tour.html',
                      maquete=raiz_b + 'maquete.html', manifest=raiz_b + 'manifest.json',
                      tiles=manifesto['tiles'])


# ---- live -------------------------------------------------------------------

def proximo_estado(acao, imovel, build, estado, agora):
    """Os registros de `imoveis` depois da acao. So o do imovel da acao muda."""
    if not isinstance(estado, dict) or estado.get('schema') != 1 or not isinstance(estado.get('imoveis'), dict):
        raise ValueError('estado fora do formato esperado (schema 1)')
    for i, r in estado['imoveis'].items():
        anterior = r.get('anterior')
        if (not SLUG.match(i) or not BUILD.match(str(r.get('atual')))
                or (anterior is not None and (not BUILD.match(str(anterior)) or anterior == r['atual']))):
            raise ValueError('estado com registro invalido para %r' % i)
    imoveis = dict(estado['imoveis'])
    velho = imoveis.get(imovel)
    if acao == 'promover':
        if not SLUG.match(imovel) or not BUILD.match(build or ''):
            raise ValueError('imovel ou build invalido: %r %r' % (imovel, build))
        if velho and velho['atual'] == build:
            raise ValueError('%s ja esta no ar com o build %s' % (imovel, build))
        imoveis[imovel] = {'atual': build, 'anterior': velho['atual'] if velho else None, 'em': agora}
    elif acao == 'reverter':
        if not velho:
            raise ValueError('%s nao esta no ar' % imovel)
        if not velho.get('anterior'):
            raise ValueError('%s nao tem build anterior para voltar' % imovel)
        imoveis[imovel] = {'atual': velho['anterior'], 'anterior': velho['atual'], 'em': agora}
    else:
        raise ValueError('acao desconhecida: %r' % acao)
    return dict(sorted(imoveis.items()))


def _metadados(tour):
    """<title>, description, og:* e twitter:* do tour aprovado -- nunca do cadastro, que pode
    ter mudado depois da aprovacao. O og:url fica de fora: o ponteiro poe o dele."""
    texto = tour.decode('utf-8')
    fim = texto.find('<script')
    cabeca = texto[:fim] if fim >= 0 else texto
    tags = []
    for m in re.finditer(r'<title>.*?</title>|<meta\s[^>]*>', cabeca, re.S):
        tag = m.group(0)
        if tag.startswith('<title>') or (
                re.search(r'(property|name)="(description|og:[^"]+|twitter:[^"]+)"', tag)
                and 'property="og:url"' not in tag):
            tags.append(tag)
    return tags


def _titulo(tags):
    for t in tags:
        m = re.fullmatch(r'<title>(.*?)</title>', t, re.S)
        if m:
            return m.group(1)
    return None


def ponteiro(tags, url_publica, destino):
    """HTML pequeno: os metadados do build + ir para ele, levando ?busca e #ancora."""
    return ('<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n'
            + ''.join(t + '\n' for t in tags)
            + '<meta property="og:url" content="%s">\n' % escape(url_publica)
            + '<script>location.replace(%s + location.search + location.hash);</script>\n'
            % json.dumps(destino)
            + '</head>\n<body>\n<noscript><a href="%s">Abrir o imóvel</a></noscript>\n</body>\n</html>\n'
            % escape(destino))


def _indice(itens):
    links = ''.join('<li><a href="/imovel/%s">%s</a></li>\n' % (i, t) for i, t in itens)
    return ('<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
            '<title>Imóveis 3D</title>\n</head>\n<body>\n<h1>Imóveis 3D</h1>\n<ul>\n'
            + links + '</ul>\n</body>\n</html>\n')


# Link de um build que ja saiu do site (so atual e anterior ficam): o ponteiro do imovel leva
# ao build de agora. Qualquer outro 404 so oferece a raiz.
PAGINA_404 = r'''<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Página não encontrada</title>
<script>(function () {
  var m = location.pathname.match(/^\/b\/([a-z0-9]+(?:-[a-z0-9]+)*)\//);
  if (m) location.replace("/imovel/" + m[1] + location.search + location.hash);
})();</script>
</head>
<body>
<p>Página não encontrada.</p>
<p><a href="/">Ver os imóveis</a></p>
</body>
</html>
'''


def montar_live(acao, imovel, build, estado, builds=BUILDS, tiles_origem=TILES, terrenos=TERRENOS,
                site=SITE, agora=None):
    agora = agora or datetime.now(timezone.utc).isoformat(timespec='seconds')
    imoveis = proximo_estado(acao, imovel, build, estado, agora)
    # Antes de montar: todo build que o estado exige existe e e o que o manifest dele diz.
    exigidos = [(i, b) for i, r in imoveis.items() for b in (r['atual'], r['anterior']) if b]
    tiles = set()
    for i, b in exigidos:
        if not (builds / i / b).is_dir():
            raise ValueError('o estado exige o build %s/%s, que nao existe em %s' % (i, b, builds))
        tiles.add(confere_build(builds / i / b, i, b)['tiles'])
    # ponytail: um conjunto de tiles por snapshot; quando o dado dos quintais mudar, os builds
    # antigos vao pedir o conjunto antigo e esta montagem recusa -- guardar os dois conjuntos.
    if len(tiles) != 1:
        raise ValueError('os builds no ar usam conjuntos de tiles diferentes: %s' % sorted(tiles))
    pasta_tiles, chaves = _tiles(tiles.pop(), terrenos)

    def preenche(trabalho):
        feitos = [a for i, b in exigidos for a in _copia_build(builds / i / b, trabalho, i, b)]
        feitos += _copia_tiles(trabalho, pasta_tiles, chaves, tiles_origem)
        itens = []
        for i, r in imoveis.items():
            tags = _metadados((trabalho / 'b' / i / r['atual'] / 'tour.html').read_bytes())
            for tipo, alvo in PONTEIROS:
                _grava(trabalho / tipo / i, ponteiro(tags, '%s/%s/%s' % (SITE_PUBLICO, tipo, i),
                                                     '/b/%s/%s/%s' % (i, r['atual'], alvo)))
                feitos.append('%s/%s' % (tipo, i))
            itens.append((i, _titulo(tags) or i))
        _grava(trabalho / 'index.html', _indice(itens))
        _grava(trabalho / '404.html', PAGINA_404)
        feitos += ['index.html', '404.html']
        # Tudo o que e nosso, menos o proprio estado. `/__/**` nem esta aqui: o Hosting injeta.
        arquivos = {a: _sha(trabalho / a) for a in sorted(feitos)}
        _grava(trabalho / 'estado.json', json.dumps(
            {'schema': 1, 'imoveis': imoveis, 'arquivos': arquivos}, ensure_ascii=False, indent=2) + '\n')
        return feitos + ['estado.json']

    arvore = _instala(site, preenche)
    r = imoveis[imovel]
    return _resultado(site, arvore, acao=acao, imovel=imovel, atual=r['atual'], anterior=r['anterior'],
                      inventariados=len(arvore) - 1)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest='comando', required=True)
    p = sub.add_parser('montar-preview', help='monta publicacao/site/ com um build e os tiles')
    p.add_argument('imovel')
    p.add_argument('build')
    live = sub.add_parser('montar-live', help='monta publicacao/site/ com o snapshot do site no ar')
    acoes = live.add_subparsers(dest='acao', required=True)
    pr = acoes.add_parser('promover', help='poe o build no ar; o atual vira anterior')
    pr.add_argument('imovel')
    pr.add_argument('build')
    estado = pr.add_mutually_exclusive_group(required=True)
    estado.add_argument('--estado', help='estado.json do snapshot anterior')
    estado.add_argument('--estado-vazio', action='store_true', help='primeira publicacao do site')
    rv = acoes.add_parser('reverter', help='troca atual e anterior do imovel')
    rv.add_argument('imovel')
    rv.add_argument('--estado', required=True, help='estado.json do snapshot anterior')
    args = parser.parse_args(argv)
    try:
        if args.comando == 'montar-preview':
            resultado = montar_preview(args.imovel, args.build)
        else:
            anterior = ({'schema': 1, 'imoveis': {}} if getattr(args, 'estado_vazio', False)
                        else json.loads(Path(args.estado).read_text(encoding='utf-8')))
            resultado = montar_live(args.acao, args.imovel, getattr(args, 'build', None), anterior)
    except (ValueError, OSError) as exc:
        parser.exit(1, str(exc) + '\n')
    print(json.dumps(resultado, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

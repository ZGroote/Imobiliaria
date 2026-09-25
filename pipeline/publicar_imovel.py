# -*- coding: utf-8 -*-
"""Publicacao de um build de imovel no site de imoveis (proposta, secao 7).

    python pipeline/publicar_imovel.py montar-preview <id> <build>

Por enquanto so monta, sem Firebase: `publicacao/site/` vira exatamente o que o proximo
deploy sobe (o `public` do firebase.imoveis.json). No preview vai so o build conferido e
os tiles de quintal -- sem index, estado, ponteiro ou outro imovel:

    publicacao/site/
      b/<id>/<build>/tour.html  maquete.html  manifest.json
      quintais/<hash>/*.bin

`site/` nunca e atualizado no lugar: a montagem nasce em `publicacao/.site-*`, e conferida
inteira e so entao substitui `site/`. Os builds em `publicacao/builds/` nao sao tocados.

A ultima linha do stdout e um JSON com o resultado.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import sys
import tempfile

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))

from pipeline.build_imovel import ARQUIVOS, BUILDS, TERRENOS, build_id, prefixo_publico  # noqa: E402

SITE = RAIZ / 'publicacao/site'
# Onde os tiles moram no repositorio: ao lado do mapa publicado (os mesmos 239 que o mapa usa).
TILES = RAIZ / 'v16-moveis/publicado/mapa'
PUBLICADOS = ARQUIVOS + ('manifest.json',)


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


def montar_preview(imovel, build, builds=BUILDS, tiles_origem=TILES, terrenos=TERRENOS, site=SITE):
    origem = builds / imovel / build
    if not origem.is_dir():
        raise ValueError('build inexistente: %s' % origem)
    manifesto = confere_build(origem, imovel, build)
    t = json.loads(terrenos.read_text(encoding='utf-8'))
    if manifesto['tiles'] != prefixo_publico(t['prefix']):
        raise ValueError('o build usa os tiles %s, o manifesto dos terrenos traz %s'
                         % (manifesto['tiles'], prefixo_publico(t['prefix'])))
    pasta_tiles = manifesto['tiles'].strip('/')
    for k in t['keys']:
        if Path(k).name != k or '/' in k or '\\' in k:
            raise ValueError('chave de tile invalida: %r' % k)

    site.parent.mkdir(parents=True, exist_ok=True)
    trabalho = Path(tempfile.mkdtemp(prefix='.site-', dir=site.parent))
    try:
        b = trabalho / 'b' / imovel / build
        b.mkdir(parents=True)
        for n in PUBLICADOS:
            shutil.copyfile(origem / n, b / n)
        (trabalho / pasta_tiles).mkdir(parents=True)
        for k in t['keys']:
            fonte = tiles_origem / pasta_tiles / (k + '.bin')
            if not fonte.is_file() or fonte.stat().st_size == 0:
                raise ValueError('tile ausente ou vazio: %s' % fonte)
            shutil.copyfile(fonte, trabalho / pasta_tiles / (k + '.bin'))

        # A copia e conferida de novo: o manifest.json publicado e o original, e o build
        # continua batendo com ele. E o que o painel le para provar qual build revisa.
        for n in PUBLICADOS:
            if (b / n).read_bytes() != (origem / n).read_bytes():
                raise ValueError('%s mudou na copia' % n)
        confere_build(b, imovel, build)
        arvore = sorted(p.relative_to(trabalho).as_posix() for p in trabalho.rglob('*') if p.is_file())
        esperado = sorted(['b/%s/%s/%s' % (imovel, build, n) for n in PUBLICADOS]
                          + ['%s/%s.bin' % (pasta_tiles, k) for k in t['keys']])
        if arvore != esperado:
            raise ValueError('a montagem tem arquivos alem do build e dos tiles')

        # Troca inteira: o site anterior sai de lado, o novo entra, o anterior e apagado.
        if site.exists():
            velho = Path(tempfile.mkdtemp(prefix='.site-anterior-', dir=site.parent))
            velho.rmdir()
            site.rename(velho)
            trabalho.rename(site)
            shutil.rmtree(velho)
        else:
            trabalho.rename(site)
    except Exception:
        shutil.rmtree(trabalho, ignore_errors=True)
        raise

    raiz_b = '/b/%s/%s/' % (imovel, build)
    return {'imovel': imovel, 'build': build,
            'site': site.relative_to(RAIZ).as_posix() if site.is_relative_to(RAIZ) else str(site),
            'tour': raiz_b + 'tour.html', 'maquete': raiz_b + 'maquete.html',
            'manifest': raiz_b + 'manifest.json', 'tiles': manifesto['tiles'],
            'arquivos': len(arvore), 'bytes': sum((site / a).stat().st_size for a in arvore)}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest='comando', required=True)
    p = sub.add_parser('montar-preview', help='monta publicacao/site/ com um build e os tiles')
    p.add_argument('imovel')
    p.add_argument('build')
    args = parser.parse_args(argv)
    try:
        resultado = montar_preview(args.imovel, args.build)
    except ValueError as exc:
        parser.exit(1, str(exc) + '\n')
    print(json.dumps(resultado, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

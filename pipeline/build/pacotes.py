# -*- coding: utf-8 -*-
"""Pacotes de dado que entram na pagina: encaixe das casas, modelos urbanos,
exteriores e estudos dos imoveis cadastrados.

Estavam dentro do `monta()`, misturados com a serializacao do HTML. O que mais pesava
ali era o ENCAIXE: `compile_placements` abre lotes, muros e vias, monta tres indices
espaciais e resolve a casa que cabe em cada lote -- geometria de verdade, no meio de
uma funcao cujo trabalho e concatenar texto. Aqui ele e um passo de build com nome
proprio, que pode ser preparado antes:

    python -m pipeline.build.pacotes sao-carlos --variante v16-moveis

O resultado fica em `modelos_urbanos/v1/integracao/encaixes-<slug>.json`, com o hash das
entradas; a montagem seguinte le esse arquivo em vez de recalcular. Sem o arquivo, a
montagem AINDA calcula (cidade nova tem que conseguir montar na primeira vez), mas agora
diz qual dos dois caminhos tomou.
"""
import io
import json
import os

from .config import RAIZ, resolve

URBANOS = RAIZ / 'modelos_urbanos' / 'v1'
EXTERIORES = RAIZ / 'exteriores' / 'v1'
CADASTRADOS = RAIZ / 'modelos_cadastrados' / 'estudos.json'


def _texto(caminho):
    with io.open(str(caminho), encoding='utf-8') as arquivo:
        return arquivo.read()


def _json(caminho):
    return json.loads(_texto(caminho))


def usa_urbanos(config):
    return (config.fonte / 'urban-models.js').exists()


def com_encaixes(config, cid, texto_cidade, pack_text=None, cache_tag=None):
    """Texto da cidade com `urbanLots`, ou o texto original quando nao ha pacote.

    `pack_text`/cache_tag permitem ao Runtime V2 usar seu kit proprio sem alterar o
    cache ou a biblioteca visual do V1.
    """
    if not usa_urbanos(config):
        return texto_cidade
    if pack_text is None:
        pack = URBANOS / 'mapa-casas.json'
        if not pack.exists():
            return texto_cidade
        pack_text = _texto(pack)
    from pipeline.encaixar_casas_lotes import compile_placements
    placements = compile_placements(cid, texto_cidade, pack_text, RAIZ, cache_tag=cache_tag)
    cidade = json.loads(texto_cidade)
    cidade['urbanLots'] = placements
    return json.dumps(cidade, ensure_ascii=False, separators=(',', ':'))


def urbanos(config):
    """Biblioteca de casas urbanas (com os compactos somados), ou None."""
    if not usa_urbanos(config):
        return None
    pack = URBANOS / 'mapa-casas.json'
    dados = _texto(pack) if pack.exists() else '{}'
    compactos = URBANOS / 'compactos.json'
    if pack.exists() and compactos.exists():
        biblioteca = json.loads(dados)
        biblioteca['assets'] += _json(compactos)['assets']
        dados = json.dumps(biblioteca, separators=(',', ':'))
    return dados


def urbanos_v2(config):
    """Kit urbano leve e variado do Runtime V2, gerado deterministicamente no build."""
    if not usa_urbanos(config):
        return None
    from pipeline.urban_v2_kit import build_pack_json
    return build_pack_json()


def exteriores(config, cid):
    """Muro, portao, quintal e a foto aerea distante -- tudo num bloco so.

    Encaixe e tiles de terreno sao de Sao Carlos: sao o unico cadastro medido lote a
    lote. Outra cidade recebe as listas vazias, e o renderizador nao desenha quintal.
    """
    if not (config.fonte / 'exterior-details.js').exists():
        return None
    import base64
    pacote = _json(EXTERIORES / 'mapa-exteriores.json')
    tem_cadastro = cid.slug == 'sao-carlos'
    pacote['placements'] = _json(EXTERIORES / 'encaixes.json')['placements'] if tem_cadastro else []
    pacote['props'] = _json(EXTERIORES / 'componentes.json')['assets']
    terrenos = _json(EXTERIORES / 'terrenos-manifesto.json')
    pacote['parcelTiles'] = terrenos if tem_cadastro else dict(keys=[], parcels=0, size=160)
    pacote['palette'] = terrenos['palette']
    pacote['aerial'] = _json(EXTERIORES / 'atlas-distante.json')
    pacote['aerial']['image'] = 'data:image/png;base64,' + base64.b64encode(
        open(str(EXTERIORES / 'atlas-distante.png'), 'rb').read()).decode()
    return json.dumps(pacote, separators=(',', ':'))


def cadastrados(config, cid):
    """Estudos 3D dos imoveis anunciados, ou uma lista vazia."""
    if not (config.fonte / 'listing-models.js').exists():
        return None
    if cid.slug == 'sao-carlos' and CADASTRADOS.exists():
        return _texto(CADASTRADOS)
    return '{"assets":[]}'


def main(argv=None):
    import argparse
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument('cidade', nargs='?')
    p.add_argument('--variante')
    a = p.parse_args(argv)
    config = resolve(a.cidade, a.variante)
    cid = config.cidade()
    caminho = cid.caminho('city_saida')
    if not os.path.exists(caminho):
        raise SystemExit('falta a base da cidade: %s' % caminho)
    texto = com_encaixes(config, cid, io.open(caminho, encoding='utf-8', newline='').read())
    print('  cidade com encaixe: %.1f KB' % (len(texto) / 1024))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

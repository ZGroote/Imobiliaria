# -*- coding: utf-8 -*-
"""A folha de estilo da pagina, montada de pedacos em ordem explicita.

Em CSS a ORDEM e semantica: duas regras de mesma especificidade sao decididas por quem
vem depois, e media query nao soma especificidade nenhuma (e por isso que o bloco de
telefone do POI tem que vir depois do bloco normal dele, e nao no fim do arquivo). Entao
a separacao por fluxo aqui e por FAIXA CONTIGUA: cada folha e um trecho do arquivo
original, e a concatenacao na ordem do manifesto reproduz o arquivo byte a byte.

Variante sem `estilos.json` continua lendo `estilo.css` inteiro -- e o que mantem as
outras variantes montando sem nenhuma mudanca.
"""
import json


def folha(config):
    raiz = config.fonte.resolve()
    manifesto = raiz / 'estilos.json'
    if not manifesto.exists():
        with (raiz / 'estilo.css').open(encoding='utf-8', newline='') as fluxo:
            return fluxo.read()
    nomes = json.loads(manifesto.read_text(encoding='utf-8'))
    if not isinstance(nomes, list) or not nomes:
        raise ValueError('estilos.json deve listar as folhas em ordem')
    if any(not isinstance(n, str) for n in nomes) or len(nomes) != len(set(nomes)):
        raise ValueError('estilos.json contem nomes invalidos ou repetidos')
    pedacos = []
    for nome in nomes:
        p = (raiz / 'estilo' / nome).resolve()
        if not p.is_relative_to(raiz) or p.suffix != '.css':
            raise ValueError('folha fora do renderizador: %s' % nome)
        with p.open(encoding='utf-8', newline='') as fluxo:
            pedacos.append(fluxo.read())
    return '\n'.join(pedacos)

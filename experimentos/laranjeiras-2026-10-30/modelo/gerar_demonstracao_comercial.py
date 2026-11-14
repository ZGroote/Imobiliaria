"""Gera a disponibilidade e as vagas simuladas da maquete."""

import json
from pathlib import Path
from random import Random

EXP = Path(__file__).resolve().parents[1]
BOOK_SHA = 'c90d9d22d6252f86a4597fb33ac22f9ea1d11ee2a5c8608fda8e7552af956911'


def carregar(caminho):
    return json.loads((EXP / caminho).read_text(encoding='utf-8'))


def gravar(nome, dados):
    (EXP / 'site' / nome).write_text(json.dumps(dados, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def vagas_da_maquete(implantacao):
    lote = implantacao['loteM']
    cx, cz = (sum(p[eixo] for p in lote) / len(lote) for eixo in (0, 1))
    for bloco in implantacao['estacionamento']:
        (x0, z0), (x1, z1) = bloco['m']
        dx, dz = x1 - x0, z1 - z0
        horizontal = dx >= dz
        fileiras = bloco['fileiras']
        quantidade = bloco['vagas'] // fileiras
        # Os centros seguem os mesmos intervalos de modelar_laranjeiras.py.
        for fila in range(fileiras):
            for vaga in range(quantidade):
                ao_longo, entre_filas = (vaga + .5) / quantidade, (fila + .5) / fileiras
                u, v = (ao_longo, entre_filas) if horizontal else (entre_filas, ao_longo)
                yield {
                    'x': round(x0 + dx * u - cx, 3), 'z': round(z0 + dz * v - cz, 3),
                    'largura': round(max(dx, dz) / quantidade * .90, 3),
                    'comprimento': round(min(dx, dz) / fileiras * .92, 3),
                    'sentido': 'z' if horizontal else 'x',
                }


def main():
    unidades = sorted(u['id'] for u in carregar('assets/unidades.json')['units'])
    vagas = list(vagas_da_maquete(carregar('implantacao/implantacao-m.json')))
    if len(set(unidades)) != 312 or len(unidades) != 312 or len(vagas) != 285:
        raise ValueError('A geometria precisa corresponder às 312 unidades e 285 vagas desenhadas.')
    rng = Random(312285)
    rng.shuffle(unidades)
    disponiveis = set(unidades[:187])
    ordem = list(range(len(vagas)))
    rng.shuffle(ordem)
    for index, unit_id in zip(ordem, unidades):
        vagas[index].update(numero=index + 1, unitId=unit_id)
    gravar('comercial.json', {
        'schema': 'liv-commercial-v1', 'status': 'simulado', 'bookSHA256': BOOK_SHA,
        'source': {'label': 'Demonstração com dados simulados', 'asOf': '2026-11-05'},
        'units': [{'id': u, 'availability': 'disponivel' if u in disponiveis else 'vendida'} for u in sorted(unidades)],
    })
    gravar('vagas.json', {'schema': 'liv-parking-v1', 'simulated': True, 'vagas': vagas})
    print(f'{len(disponiveis)} unidades disponíveis e {len(vagas)} vínculos de vaga na simulação.')


if __name__ == '__main__':
    main()

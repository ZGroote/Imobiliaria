"""Gera a disponibilidade simulada da maquete (como o Laranjeiras, sem vagas: o Vistas não tem mapa de vagas).

python experimentos/vistas-da-quinze-2026-11-07/modelo/gerar_demonstracao_comercial.py
"""

import json
from pathlib import Path
from random import Random

EXP = Path(__file__).resolve().parents[1]
# A perspectiva colorida (anexos/c5be99a0...png) é o cadastro unidade -> tipologia: faz o papel do book.
BOOK_SHA = 'f5f6c5e2c8febd11f906feb48838bfd627451119a7a7bf285571f447a005ea49'


def main():
    unidades = sorted(u['id'] for u in json.loads((EXP/'assets'/'unidades.json').read_text(encoding='utf-8'))['units'])
    if len(set(unidades)) != 258:
        raise ValueError('O cadastro precisa ter os 258 apartamentos.')
    rng = Random(258)
    sorteio = unidades[:]
    rng.shuffle(sorteio)
    disponiveis = set(sorteio[:round(len(sorteio)*.6)])   # 60%, a proporção do Laranjeiras (187/312)
    dados = {
        'schema': 'liv-commercial-v1', 'status': 'simulado', 'bookSHA256': BOOK_SHA,
        'source': {'label': 'Demonstração com dados simulados', 'asOf': '2026-11-07'},
        'units': [{'id': u, 'availability': 'disponivel' if u in disponiveis else 'vendida'} for u in unidades],
    }
    (EXP/'site'/'comercial.json').write_text(json.dumps(dados, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(f'{len(disponiveis)} de {len(unidades)} apartamentos disponíveis na simulação.')


if __name__ == '__main__':
    main()

# -*- coding: utf-8 -*-
"""Resolve o produto efetivo da maquete sem fallback silencioso.

Sem modo explícito preserva o comportamento histórico:
- Cedros usa o PREMIUM aprovado;
- demais imóveis usam LEVE.

Com modo explícito, a escolha do pedido é autoridade:
- LEVE força a montagem LEVE;
- PREMIUM só passa onde existe pacote PREMIUM automatizado.
"""
from functools import lru_cache
from pathlib import Path
import runpy

RAIZ = Path(__file__).resolve().parents[1]
PADRAO_PREMIUM = RAIZ / 'v1.5' / 'miniaturas' / 'padrao_atual.py'
MODOS = ('leve', 'premium')


@lru_cache(maxsize=1)
def premium_uid():
    return runpy.run_path(str(PADRAO_PREMIUM))['UID']


def resolver(property_id, solicitado=None):
    if solicitado is not None and solicitado not in MODOS:
        raise ValueError('PRODUCTION_MODE_INVALID: %r' % solicitado)

    uid = premium_uid()
    if solicitado is None:
        return 'premium' if property_id == uid else 'leve'

    if solicitado == 'premium' and property_id != uid:
        raise ValueError(
            'PREMIUM_UNAVAILABLE: %s ainda nao tem pacote PREMIUM automatizado' % property_id
        )
    return solicitado

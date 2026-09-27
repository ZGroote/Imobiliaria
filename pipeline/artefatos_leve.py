# -*- coding: utf-8 -*-
"""Resolve caminhos dos artefatos LEVE a partir da fonte normalizada.

Não conhece IDs de imóveis. O único mapeamento imóvel -> perfil/variante/slug continua
em perfis-leve/imoveis.json, consumido por pipeline.fonte_leve.
"""
from pathlib import Path

from pipeline import fonte_leve

RAIZ = Path(__file__).resolve().parents[1]
MINI_ROOT = RAIZ / "v1.5" / "miniaturas"


def resolver(property_id, root=MINI_ROOT):
    fonte = fonte_leve.normalizar(property_id)
    profile = fonte["style"]["profile"]
    slug = fonte["style"]["slug"]
    pasta = Path(root) / (slug + "_blender")
    return {
        "propertyId": property_id,
        "profile": profile,
        "slug": slug,
        "dir": pasta,
        "modelo": pasta / "modelo.json",
        "glb": pasta / (slug + ".glb"),
        "validacao": pasta / "validacao.json",
    }

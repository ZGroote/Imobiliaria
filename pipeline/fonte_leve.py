# -*- coding: utf-8 -*-
"""Fonte LEVE normalizada, independente do Blender.

M2.1a só projeta fatos do cadastro e parâmetros de perfil declarativo. Não gera
geometria, não escreve arquivos e não conhece IDs de imóveis no código.
"""
from copy import deepcopy
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
PERFIS = RAIZ / "v1.5" / "miniaturas" / "perfis-leve"
MAPA = PERFIS / "imoveis.json"


class FonteLeveErro(ValueError):
    pass


def _json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _perfil(nome):
    path = PERFIS / (nome + ".json")
    if not path.is_file():
        raise FonteLeveErro("perfil LEVE desconhecido: " + nome)
    data = _json(path)
    if data.get("schema") != 1 or data.get("profile") != nome:
        raise FonteLeveErro("perfil LEVE inválido: " + nome)
    return data


def _config_imovel(property_id):
    mapa = _json(MAPA)
    if mapa.get("schema") != 1:
        raise FonteLeveErro("mapa de perfis LEVE com schema inválido")
    try:
        return deepcopy(mapa["properties"][property_id])
    except KeyError:
        raise FonteLeveErro("imóvel sem perfil LEVE declarado: " + property_id)


def _bloco_publico(bloco):
    """Campos geométricos declarados no cadastro; notas internas não entram."""
    chaves = (
        "principal", "du", "dv", "largura_m", "profundidade_m", "pavimentos",
        "classe", "cor_parede", "sacadas", "faixa_pav",
    )
    return {k: deepcopy(bloco[k]) for k in chaves if k in bloco}


def normalizar(property_id):
    cfg = _config_imovel(property_id)
    profile_name = cfg["profile"]
    profile = _perfil(profile_name)
    try:
        variant = deepcopy(profile["variants"][cfg["variant"]])
    except KeyError:
        raise FonteLeveErro(
            "variante %s ausente no perfil %s" % (cfg.get("variant"), profile_name)
        )

    unit_path = RAIZ / "plantas_fornecidas" / property_id / "unidade.json"
    if not unit_path.is_file():
        raise FonteLeveErro("cadastro da unidade ausente: " + property_id)
    unidade = _json(unit_path)
    try:
        predio = unidade["lote"]["predio"]
    except KeyError:
        raise FonteLeveErro("cadastro sem lote.predio: " + property_id)

    blocos = predio.get("blocos") or []
    torres = [_bloco_publico(b) for b in blocos if b.get("sacadas")]
    if not torres:
        raise FonteLeveErro("cadastro sem blocos com sacadas: " + property_id)
    principais = [i for i, b in enumerate(torres) if b.get("principal") is True]
    if len(principais) != 1:
        raise FonteLeveErro("cadastro precisa de um bloco principal com sacadas")

    portarias = [_bloco_publico(b) for b in blocos if b.get("classe") == 2]
    if len(portarias) != 1:
        raise FonteLeveErro("cadastro precisa de uma portaria classe 2")

    auxiliares = [
        _bloco_publico(b)
        for b in blocos
        if not b.get("sacadas") and b.get("classe") != 2
    ]

    common = deepcopy(profile["common"])
    moldura = variant.pop("molduraColor")
    materials = deepcopy(common["materials"])
    materials["moldura"]["color"] = moldura

    return {
        "schema": 1,
        "propertyId": property_id,
        "source": unit_path.relative_to(RAIZ).as_posix(),
        "style": {
            "profile": profile_name,
            "variant": cfg["variant"],
            "slug": cfg["slug"],
            "materials": materials,
            "recess": common["recess"],
            "balconyCenters": common["balconyCenters"],
            "balconyWidth": variant["balconyWidth"],
            "molduraMode": variant["molduraMode"],
            "longFacadeBands": variant["longFacadeBands"],
            "referenceImage": variant["referenceImage"],
        },
        "building": {
            "floors": predio["pavimentos"],
            "floorHeight": common["floorHeight"],
            "width": predio["largura_m"],
            "depth": predio["profundidade_m"],
            "towers": torres,
            "principalTower": principais[0],
            "portaria": portarias[0],
            "auxiliaryBlocks": auxiliares,
        },
        "render": {
            "target": variant["renderTarget"],
            "distance": common["renderDistance"],
            "ortho": variant["renderOrtho"],
            "detail": {
                "target": variant["detailTarget"],
                "distance": common["detailDistance"],
                "ortho": variant["detailOrtho"],
            },
        },
        "metadata": {
            "reference": common["reference"],
            "scope": variant["scope"],
            "uncertainty": common["uncertainty"],
        },
    }


def canonical(property_id):
    """Serialização estável para cache/teste do estágio de normalização."""
    return json.dumps(
        normalizar(property_id),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("imovel")
    args = parser.parse_args()
    print(json.dumps(normalizar(args.imovel), ensure_ascii=False, indent=2))

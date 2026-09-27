# -*- coding: utf-8 -*-
"""Fonte LEVE normalizada, independente do Blender.

Projeta fatos do cadastro e parâmetros de perfil declarativo. Não gera geometria,
não escreve arquivos e não conhece IDs de imóveis no código.
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
    if not data.get("normalizer"):
        raise FonteLeveErro("perfil LEVE sem normalizer: " + nome)
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


def _base(property_id, cfg, profile):
    try:
        variant = deepcopy(profile["variants"][cfg["variant"]])
    except KeyError:
        raise FonteLeveErro(
            "variante %s ausente no perfil %s" % (cfg.get("variant"), profile["profile"])
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
    return {
        "variant": variant,
        "unit_path": unit_path,
        "predio": predio,
        "towers": torres,
        "principal": principais[0],
        "portaria": portarias[0],
        "auxiliares": auxiliares,
    }


def _cabecalho(property_id, cfg, profile, base):
    return {
        "schema": 1,
        "propertyId": property_id,
        "source": base["unit_path"].relative_to(RAIZ).as_posix(),
    }


def _building(profile, base):
    predio = base["predio"]
    return {
        "floors": predio["pavimentos"],
        "floorHeight": profile["common"]["floorHeight"],
        "width": predio["largura_m"],
        "depth": predio["profundidade_m"],
        "towers": base["towers"],
        "principalTower": base["principal"],
        "portaria": base["portaria"],
        "auxiliaryBlocks": base["auxiliares"],
    }


def _normalizar_montes(property_id, cfg, profile, base):
    common = deepcopy(profile["common"])
    variant = deepcopy(base["variant"])
    moldura = variant.pop("molduraColor")
    materials = deepcopy(common["materials"])
    materials["moldura"]["color"] = moldura

    result = _cabecalho(property_id, cfg, profile, base)
    result.update({
        "style": {
            "profile": profile["profile"],
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
        "building": _building(profile, base),
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
    })
    return result


def _normalizar_castanheiras(property_id, cfg, profile, base):
    common = deepcopy(profile["common"])
    variant = deepcopy(base["variant"])
    result = _cabecalho(property_id, cfg, profile, base)
    result.update({
        "style": {
            "profile": profile["profile"],
            "variant": cfg["variant"],
            "slug": cfg["slug"],
            "materials": common["materials"],
            "visualBalconyDepth": common["visualBalconyDepth"],
            "referenceImage": common["referenceImage"],
            "facade": common["facade"],
        },
        "building": _building(profile, base),
        "render": common["render"],
        "metadata": {
            "reference": common["referenceReport"],
            "back": common["back"],
            "scope": variant["scope"],
            "uncertainty": variant["uncertainty"],
        },
    })
    return result


NORMALIZERS = {
    "montes-v1": _normalizar_montes,
    "castanheiras-v1": _normalizar_castanheiras,
}


def normalizar(property_id):
    cfg = _config_imovel(property_id)
    profile = _perfil(cfg["profile"])
    base = _base(property_id, cfg, profile)
    try:
        fn = NORMALIZERS[profile["normalizer"]]
    except KeyError:
        raise FonteLeveErro(
            "normalizer LEVE desconhecido: " + str(profile.get("normalizer"))
        )
    return fn(property_id, cfg, profile, base)


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

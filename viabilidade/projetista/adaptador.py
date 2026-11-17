"""Estudo do motor -> referências e terreno locais, sem importar ou alterar o motor."""
import copy
import hashlib
import json
import math
from pathlib import Path

from shapely.geometry import Point, Polygon

from .esquema import carregar_json, numero, pontos, sha256, texto


def estudo_para_site(estudo_json):
    """Aceita dict, bytes/texto JSON ou Path. Bytes/Path preservam o SHA do arquivo.

    Dict usa JSON ordenado sem arredondar a origem, pois não guarda os bytes originais.
    Retorna (StudyReference, Site, RuleSetReference), sem modificar a entrada.
    """
    if isinstance(estudo_json, dict):
        estudo = copy.deepcopy(estudo_json)
        raw = (json.dumps(estudo, ensure_ascii=False, sort_keys=True, allow_nan=False,
                          separators=(",", ":")) + "\n").encode("utf-8")
    else:
        raw = estudo_json.read_bytes() if isinstance(estudo_json, Path) else estudo_json
        if isinstance(raw, str):
            raw = raw.encode("utf-8")
        estudo = carregar_json(raw)
    try:
        lote, zona, caixa = estudo["lote"], estudo["zona"], estudo["caixa_maxima"]
        h = caixa["altura_m"]
        if h is None:
            raise ValueError("caixa_maxima.altura_m é null: estudo sem envelope calculável")
        numero(h, "caixa_maxima.altura_m", 0)
        if lote.get("crs") != "EPSG:31983":
            raise ValueError("lote.crs deve declarar EPSG:31983; não inferimos datum")
        poly = pontos(lote["poligono_utm"], "lote.poligono_utm")
        frente = pontos(lote["frente"], "lote.frente", 2)
        if len(frente) != 2:
            raise ValueError("frente deve ter dois pontos")
        (x0, y0), (x1, y1) = frente
        comprimento = math.hypot(x1 - x0, y1 - y0)
        if comprimento == 0:
            raise ValueError("frente sem comprimento")
        terreno = Polygon(poly)
        if not terreno.is_valid or terreno.area <= 0:
            raise ValueError("Polígono do lote inválido; não foi reparado")
        u = [(x1 - x0) / comprimento, (y1 - y0) / comprimento]
        v = [-u[1], u[0]]
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        for passo in (0.05, 0.5):  # mesma escolha de orientação de motor.eixos_da_frente
            a = terreno.contains(Point(mx + v[0] * passo, my + v[1] * passo))
            b = terreno.contains(Point(mx - v[0] * passo, my - v[1] * passo))
            if a != b:
                if b:
                    v = [-v[0], -v[1]]
                break
        else:
            c = terreno.centroid
            if (c.x - x0) * v[0] + (c.y - y0) * v[1] < 0:
                v = [-v[0], -v[1]]

        def local(anel):
            if anel == []:
                return []  # envelope vazio é diferente de envelope ausente
            return [[(x - x0) * u[0] + (y - y0) * u[1],
                     (x - x0) * v[0] + (y - y0) * v[1]] for x, y in pontos(anel, "projecao_utm")]

        degraus = caixa.get("degraus")
        if degraus is None or degraus == []:
            degraus = [{"z0_m": 0, "altura_m": h, "projecao_utm": caixa["projecao_utm"]}] if h > 0 else []
        if not isinstance(degraus, list):
            raise ValueError("caixa_maxima.degraus deve ser lista")
        faixas, anterior = [], 0
        for i, g in enumerate(degraus):
            z0 = numero(g["z0_m"], "degrau.z0_m", 0)
            limite = degraus[i + 1]["z0_m"] if i + 1 < len(degraus) else h
            numero(limite, "degrau seguinte", 0)
            z1 = z0 + numero(g["altura_m"], "degrau.altura_m", 0) if "altura_m" in g else limite
            if z0 != anterior or z1 <= z0 or z1 > limite or z1 > h:
                raise ValueError("Degraus devem cobrir a altura, em ordem, sem lacuna/sobreposição")
            faixas.append({"z0_m": z0, "z1_m": z1, "polygon_m": local(g["projecao_utm"])})
            anterior = z1
        if anterior != h:
            raise ValueError("Degraus não cobrem caixa_maxima.altura_m")
        lote_id, zone_id = texto(lote["id"], "lote.id"), texto(zona["id"], "zona.id")
        for obj, campo in ((lote, "zona_conferida"), (zona, "conferido")):
            if campo in obj and type(obj[campo]) is not bool:
                raise ValueError(f"{campo} deve ser booleano")
        study = {"study_id": lote_id, "study_sha256": hashlib.sha256(raw).hexdigest(),
                 "motor_version": texto(estudo["versao_motor"], "versao_motor"), "lote_id": lote_id,
                 "created_at": estudo.get("created_at")}
        site = {"lote_id": lote_id, "crs": lote["crs"], "polygon_utm": copy.deepcopy(poly),
                "front_utm": copy.deepcopy(frente), "local_frame": {"origem": [x0, y0], "u": u, "v": v},
                "area_m2": terreno.area, "envelope_by_height": faixas}
        origem = {"zona": zona, "areas_especiais": lote.get("areas_especiais", [])}
        regras = {"zone_id": zone_id, "zone_verified": zona.get("conferido", False),
                  "lot_zone_verified": lote.get("zona_conferida", False), "rules_version": sha256(origem),
                  "params": {"motor": copy.deepcopy(zona["parametros"]),
                             "areas_especiais": copy.deepcopy(origem["areas_especiais"]),
                             "zone_matches_lot": lote.get("zona_id") == zone_id,
                             "door_width_m": 0.8, "facade_min_m": 3.0, "unit_min_side_m": None},
                  "sources": {"norma.envelope": {"reference": "caixa_maxima.degraus do motor " + study["motor_version"],
                              "verified": False, "kind": "norma", "documents": copy.deepcopy(zona.get("fontes", [])),
                              "reason": "Envelope amostrado; recuos/premissas não constituem verificação normativa exata"},
                              "acesso": {"reference": "TAREFA-3: contato mínimo de 0,80 m", "verified": True, "kind": "premissa"},
                              "fachada": {"reference": "TAREFA-3: fachada mínima de 3,00 m", "verified": True, "kind": "premissa"},
                              "dimensao": {"reference": "Parâmetro do programa ainda não informado", "verified": False, "kind": "premissa"},
                              "areas.privativa": {"reference": "NBR 12721; texto/edição não conferidos nesta fatia", "verified": False, "kind": "norma"},
                              "areas.util": {"reference": "DECISOES-PA-G0: faces internas, sem divisórias detalhadas", "verified": False, "kind": "premissa"},
                              "areas.computavel": {"reference": "COE art. 51; enquadramento de cada área pendente", "verified": False, "kind": "norma"}}}
        return study, site, regras
    except (KeyError, TypeError, IndexError) as erro:
        raise ValueError(f"Estudo malformado: {erro}") from erro

"""Companion do editor: valida pisos/móveis sem ampliar o contrato geométrico M1-0."""
import math
import re

from pipeline import validar_leitura
from pipeline.normalizar_planta import serializar

CATALOGO_UI = {
    "cama-casal": "cama", "cama-queen": "cama", "cama-solteiro": "cama",
    "guardaroupa": "guardaroupa", "criado": "criado", "sofa-3": "sofa", "sofa-2": "sofa",
    "poltrona": "cadeira", "rack-tv": "rack", "mesa-jantar-4": "mesa", "mesa-jantar-6": "mesa",
    "tapete-sala": "tapete", "pia-cozinha": "pia", "fogao": "fogao", "geladeira": "geladeira",
    "balcao-americano": "balcao", "vaso-sanitario": "vaso", "gabinete-banheiro": "pia",
    "box-chuveiro": "box", "maquina-lavar": "maquina", "tanque-lavar": "pia", "escrivaninha": "mesa",
}
TIPOS_3D = set(CATALOGO_UI.values()) | {"armario", "estante", "tv", "ripado", "aereo", "coifa", "cortina"}
MAX_MOVEIS = 200
COR = re.compile(r"#[0-9a-fA-F]{6}")


def _erro(path, message):
    return {"code": "EDITOR_STATE_INVALIDO", "path": path, "message": message}


def _int(n, lo, hi):
    return type(n) is int and lo <= n <= hi


def _numero(n, lo, hi):
    return type(n) in (int, float) and lo <= n <= hi and math.isfinite(n)


def validar_furniture(items, path="/furniture"):
    if not isinstance(items, list) or len(items) > MAX_MOVEIS:
        return [_erro(path, "Declare uma lista com até 200 móveis por pavimento.")]
    errors, ids = [], set()
    required = {"id", "tipoCatalogo", "tipo3D", "nome", "xMm", "yMm", "widthMm", "depthMm", "rotDegrees"}
    for i, item in enumerate(items):
        p = f"{path}/{i}"
        if not isinstance(item, dict) or not required <= set(item) or set(item) - required - {"cor", "alturaMm"}:
            errors.append(_erro(p, "Campos do móvel inválidos."))
            continue
        fid = item.get("id")
        if not isinstance(fid, str) or not re.fullmatch(r"m[1-9][0-9]*", fid) or len(fid) > 17 or int(fid[1:]) >= 9007199254740991 or fid in ids:
            errors.append(_erro(p + "/id", "Identificador de móvel inválido ou duplicado."))
        else:
            ids.add(fid)
        if not isinstance(item.get("tipoCatalogo"), str) or not isinstance(item.get("tipo3D"), str) or CATALOGO_UI.get(item["tipoCatalogo"]) != item["tipo3D"]:
            errors.append(_erro(p + "/tipoCatalogo", "Móvel e tipo 3D precisam pertencer ao catálogo do editor."))
        if not isinstance(item.get("nome"), str) or not item["nome"].strip() or not 1 <= len(item["nome"]) <= 100:
            errors.append(_erro(p + "/nome", "Nome do móvel deve ter até 100 caracteres."))
        for key in ("xMm", "yMm"):
            if not _int(item.get(key), -1000000, 1000000):
                errors.append(_erro(p + "/" + key, "Posição deve usar milímetros inteiros dentro do limite da planta."))
        for key in ("widthMm", "depthMm", "alturaMm"):
            if key in item and not _int(item[key], 1, 10000):
                errors.append(_erro(p + "/" + key, "Dimensão do móvel deve ser de 1 a 10.000 mm."))
        if type(item["rotDegrees"]) is not int or item["rotDegrees"] not in (0, 90, 180, 270):
            errors.append(_erro(p + "/rotDegrees", "Rotação deve ser 0, 90, 180 ou 270 graus."))
        if "cor" in item and (not isinstance(item["cor"], str) or not COR.fullmatch(item["cor"])):
            errors.append(_erro(p + "/cor", "Cor deve usar #RRGGBB."))
    return errors


def validar_editor_state(leitura, state):
    if not isinstance(state, dict) or set(state) != {"schemaVersion", "activeFloor", "floors"} or state.get("schemaVersion") != "1.0.0":
        return [_erro("/editorState", "Companion deve usar schemaVersion 1.0.0, activeFloor e floors.")]
    floors = state["floors"]
    if not _int(state["activeFloor"], 0, 1) or not isinstance(floors, list) or not 1 <= len(floors) <= 2:
        return [_erro("/editorState/floors", "Declare térreo/superior e selecione um piso presente.")]
    errors, seen, active = [], set(), None
    if len(floors) == 2 and [f.get("floor") if isinstance(f, dict) else None for f in floors] != [0, 1]:
        errors.append(_erro("/editorState/floors", "Declare os pavimentos em ordem: térreo e depois superior."))
    for i, entry in enumerate(floors):
        p = f"/editorState/floors/{i}"
        if not isinstance(entry, dict) or set(entry) != {"floor", "leitura", "furniture"} or not _int(entry.get("floor"), 0, 1):
            errors.append(_erro(p, "Pavimento deve conter floor, leitura e furniture."))
            continue
        floor = entry["floor"]
        if floor in seen:
            errors.append(_erro(p + "/floor", "Pavimento duplicado."))
        seen.add(floor)
        errors += [{**e, "path": p + "/leitura" + e["path"]} for e in validar_leitura.validar(entry["leitura"])]
        errors += validar_furniture(entry["furniture"], p + "/furniture")
        if floor == state["activeFloor"]:
            active = entry["leitura"]
    if 0 not in seen or state["activeFloor"] not in seen:
        errors.append(_erro("/editorState/activeFloor", "Térreo e pavimento ativo precisam estar presentes."))
    elif serializar(active) != serializar(leitura):
        errors.append(_erro("/editorState/activeFloor", "A leitura do piso ativo difere da leitura geométrica do snapshot."))
    return errors


def validar_moveis(items):
    """Formato nominal em metros usado pelo catálogo 3D, separado da leitura."""
    if not isinstance(items, list) or len(items) > MAX_MOVEIS:
        return [_erro("/moveis", "Declare uma lista com até 200 móveis.")]
    errors = []
    for i, item in enumerate(items):
        p = f"/moveis/{i}"
        if not isinstance(item, dict) or not {"tipo", "p", "rot", "w", "h", "d"} <= set(item) or set(item) - {"tipo", "p", "rot", "w", "h", "d", "cor", "nome", "y"}:
            errors.append(_erro(p, "Campos do móvel 3D inválidos."))
            continue
        if not isinstance(item["tipo"], str) or item["tipo"] not in TIPOS_3D:
            errors.append(_erro(p + "/tipo", "Tipo não suportado pelo catálogo 3D."))
        if not isinstance(item["p"], list) or len(item["p"]) != 2 or not all(_numero(v, -1000, 1000) for v in item["p"]):
            errors.append(_erro(p + "/p", "Posição nominal deve ter duas coordenadas finitas em metros."))
        if not _int(item["rot"], 0, 3):
            errors.append(_erro(p + "/rot", "Rotação nominal deve ser 0, 1, 2 ou 3."))
        for key in ("w", "h", "d"):
            if not _numero(item[key], 0.001, 10):
                errors.append(_erro(p + "/" + key, "Dimensão nominal deve ser de 0,001 a 10 metros."))
        if "y" in item and not _numero(item["y"], 0, 10):
            errors.append(_erro(p + "/y", "Altura de montagem inválida."))
        if "cor" in item and not (isinstance(item["cor"], str) and COR.fullmatch(item["cor"]) or _int(item["cor"], 0, 0xFFFFFF)):
            errors.append(_erro(p + "/cor", "Cor deve usar #RRGGBB ou RGB inteiro."))
        if "nome" in item and (not isinstance(item["nome"], str) or not item["nome"].strip() or not 1 <= len(item["nome"]) <= 100):
            errors.append(_erro(p + "/nome", "Nome do móvel inválido."))
    return errors

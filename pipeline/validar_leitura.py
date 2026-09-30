"""Validação do contrato declarado M1-0; não normaliza nem executa a fábrica."""
import argparse
from dataclasses import dataclass
from itertools import combinations
import json
from pathlib import Path

from jsonschema import Draft202012Validator

SCHEMA = json.loads(
    (Path(__file__).resolve().parents[1] / "schemas/leitura/1.0.0.schema.json")
    .read_text(encoding="utf-8")
)
VALIDATOR = Draft202012Validator(SCHEMA)
MESSAGES = {
    "INVALID_JSON": "O arquivo deve conter JSON válido, sem chaves repetidas ou números não finitos.",
    "INPUT_UNREADABLE": "Não foi possível ler o arquivo de entrada em UTF-8.",
    "INVALID_STRUCTURE": "O documento não corresponde à estrutura fechada do contrato.",
    "UNSUPPORTED_VERSION": "A versão do contrato deve ser 1.0.0.",
    "INVALID_UNIT": "A unidade canônica deve ser mm.",
    "UNSUPPORTED_GEOMETRY": "Esta versão aceita apenas cômodos retangulares alinhados aos eixos.",
    "INVALID_DIMENSION": "Informe medidas inteiras em milímetros dentro dos limites do schema.",
    "INVALID_PROVENANCE": "Informe procedência declarada e referências; CV e derivados não são entrada.",
    "DUPLICATE_ID": "Cada entidade e parede deve ter um identificador único no documento.",
    "UNKNOWN_REFERENCE": "A referência de procedência não está cadastrada neste documento.",
    "ROOM_OVERLAP": "Os interiores dos cômodos não podem se sobrepor.",
    "DISCONNECTED_ROOM": "O cômodo precisa estar conectado por um segmento de parede ao conjunto.",
    "INCONSISTENT_RELATION": "Declare exatamente uma relação para cada par de paredes adjacentes.",
    "INVALID_OPENING": "Confira parede, par compartilhado, limites, altura e peitoril da abertura.",
    "OPENING_OVERLAP": "As aberturas não podem ocupar a mesma região física da parede.",
}


def _error(code, path):
    return {"code": code, "path": path, "message": MESSAGES[code]}


def _pointer(parts):
    return "/" + "/".join(str(p).replace("~", "~0").replace("/", "~1") for p in parts) if parts else ""


def _schema_code(error):
    path = list(error.absolute_path)
    missing = []
    if error.validator == "required" and isinstance(error.instance, dict):
        missing = [key for key in error.validator_value if key not in error.instance]
    fields = path + missing
    for field, code in (
        ("schemaVersion", "UNSUPPORTED_VERSION"), ("unit", "INVALID_UNIT"),
        ("geometry", "UNSUPPORTED_GEOMETRY"), ("provenance", "INVALID_PROVENANCE"),
    ):
        if field in fields:
            return code
    if path and path[0] == "openings":
        return "INVALID_OPENING"
    if any(str(p).endswith("Mm") for p in fields):
        return "INVALID_DIMENSION"
    if path and path[0] == "relations":
        return "INCONSISTENT_RELATION"
    return "INVALID_STRUCTURE"


@dataclass(frozen=True)
class _Wall:
    room: int
    side: str
    axis: str
    fixed: int
    start: int
    end: int


def _walls(rooms):
    result = {}
    for i, room in enumerate(rooms):
        x, y = room["xMm"], room["yMm"]
        right, top = x + room["widthMm"], y + room["depthMm"]
        for side, axis, fixed, start, end in (
            ("south", "x", y, x, right), ("north", "x", top, x, right),
            ("west", "y", x, y, top), ("east", "y", right, y, top),
        ):
            result[room["walls"][side]] = _Wall(i, side, axis, fixed, start, end)
    return result


def validar(documento):
    """Lista determinística de {code, path (JSON Pointer), message}; nunca altera entrada."""
    errors = [
        _error(_schema_code(e), _pointer(e.absolute_path))
        for e in VALIDATOR.iter_errors(documento)
    ]
    if errors:
        return _sorted(errors)

    entities = [("", documento)]
    for collection in ("references", "rooms", "relations", "openings"):
        entities.extend((f"/{collection}/{i}", item) for i, item in enumerate(documento[collection]))
    ids = set()
    for path, item in entities:
        entries = [(path + "/id", item["id"])]
        entries.extend((path + "/walls/" + side, value)
                       for side, value in sorted(item.get("walls", {}).items()))
        for id_path, value in entries:
            if value in ids:
                errors.append(_error("DUPLICATE_ID", id_path))
            ids.add(value)
    # Identificadores ambíguos impedem qualquer resolução topológica segura.
    if errors:
        return _sorted(errors)

    references = {item["id"] for item in documento["references"]}
    for path, item in entities:
        if "provenance" in item:
            for i, reference in enumerate(item["provenance"]["referenceIds"]):
                if reference not in references:
                    errors.append(_error("UNKNOWN_REFERENCE", f"{path}/provenance/referenceIds/{i}"))

    rooms = documento["rooms"]
    for (i, a), (j, b) in combinations(enumerate(rooms), 2):
        if (max(a["xMm"], b["xMm"]) < min(a["xMm"] + a["widthMm"], b["xMm"] + b["widthMm"])
                and max(a["yMm"], b["yMm"]) < min(a["yMm"] + a["depthMm"], b["yMm"] + b["depthMm"])):
            errors.append(_error("ROOM_OVERLAP", f"/rooms/{j}"))
    if any(e["code"] == "ROOM_OVERLAP" for e in errors):
        return _sorted(errors)

    walls = _walls(rooms)
    opposite = {"south": "north", "north": "south", "west": "east", "east": "west"}
    adjacent = {}
    neighbors = {i: set() for i in range(len(rooms))}
    for (aid, a), (bid, b) in combinations(walls.items(), 2):
        lo, hi = max(a.start, b.start), min(a.end, b.end)
        if (a.room != b.room and a.axis == b.axis and a.fixed == b.fixed
                and opposite[a.side] == b.side and lo < hi):
            adjacent[frozenset((aid, bid))] = (lo, hi)
            neighbors[a.room].add(b.room)
            neighbors[b.room].add(a.room)

    seen, pending = set(), [0]
    while pending:
        current = pending.pop()
        if current not in seen:
            seen.add(current)
            pending.extend(neighbors[current] - seen)
    for i in sorted(set(neighbors) - seen):
        errors.append(_error("DISCONNECTED_ROOM", f"/rooms/{i}"))

    declared = set()
    for i, relation in enumerate(documento["relations"]):
        pair = frozenset((relation["wallA"], relation["wallB"]))
        if pair not in adjacent or pair in declared:
            errors.append(_error("INCONSISTENT_RELATION", f"/relations/{i}"))
        declared.add(pair)
    if set(adjacent) - declared:
        errors.append(_error("INCONSISTENT_RELATION", "/relations"))

    physical_openings = []
    for i, opening in enumerate(documento["openings"]):
        path = f"/openings/{i}"
        wall = walls.get(opening["wallId"])
        if wall is None:
            errors.append(_error("INVALID_OPENING", path + "/wallId"))
            continue
        lo = wall.start + opening["offsetMm"]
        hi = lo + opening["widthMm"]
        bottom = opening["sillMm"]
        top = bottom + opening["heightMm"]
        invalid = hi > wall.end or top > documento["ceilingHeightMm"]
        invalid |= opening["kind"] == "door" and bottom != 0
        touched = [
            pair for pair, (start, end) in adjacent.items()
            if opening["wallId"] in pair and max(lo, start) < min(hi, end)
        ]
        paired = opening.get("pairedWallId")
        if paired is None:
            invalid |= bool(touched)
        else:
            pair = frozenset((opening["wallId"], paired))
            span = adjacent.get(pair)
            invalid |= span is None or not (span[0] <= lo and hi <= span[1])
        if invalid:
            errors.append(_error("INVALID_OPENING", path))
            continue
        for other_axis, other_fixed, other_lo, other_hi, other_bottom, other_top in physical_openings:
            if (wall.axis == other_axis and wall.fixed == other_fixed
                    and max(lo, other_lo) < min(hi, other_hi)
                    and max(bottom, other_bottom) < min(top, other_top)):
                errors.append(_error("OPENING_OVERLAP", path))
        physical_openings.append((wall.axis, wall.fixed, lo, hi, bottom, top))
    return _sorted(errors)


def _sorted(errors):
    # Não expõe textos internos/versionáveis do jsonschema como códigos de API.
    unique = {(e["path"], e["code"]): e for e in errors}
    return [unique[key] for key in sorted(unique)]


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate key")
        result[key] = value
    return result


def _invalid_constant(value):
    raise ValueError("non-finite number")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("arquivo", type=Path, help="leitura.json v1.0.0")
    args = parser.parse_args()
    try:
        text = args.arquivo.read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        errors = [_error("INPUT_UNREADABLE", "")]
    else:
        try:
            doc = json.loads(text, object_pairs_hook=_unique_object, parse_constant=_invalid_constant)
            errors = validar(doc)
        except (ValueError, RecursionError):
            errors = [_error("INVALID_JSON", "")]
    # ASCII escapado mantém stdout JSON portável também em consoles Windows.
    print(json.dumps({"valid": not errors, "errors": errors}, sort_keys=True))
    return 2 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())

"""M1-A: deriva polígonos e aberturas nominais, sem cadastro ou espessura."""
import argparse
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import sys

from jsonschema import Draft202012Validator
from pipeline import validar_leitura as entrada

# A derivada tem a versão da leitura: 1.0.0 sai byte a byte como antes do M1.1-C1.
SCHEMAS = {v: json.loads((Path(__file__).resolve().parents[1] / f"schemas/planta-derivada/{v}.schema.json")
                         .read_text(encoding="utf-8")) for v in entrada.VERSOES}
SCHEMA = SCHEMAS["1.0.0"]
RULES = [
    "mm-to-m@1", "rectangle-to-ccw-polygon@1",
    "wall-offset-to-opening-center@1", "sill-height-to-y0-y1@1",
    "preserve-nominal-axes@1",
]
RULES_1_1 = RULES + ["merge-parts-to-polygon@1"]


class LeituraInvalida(ValueError):
    def __init__(self, errors):
        super().__init__("Leitura recusada pelo validador M1-0.")
        self.errors = errors


def _canonical(value):
    # JSON Schema aceita 4000.0 como inteiro; uma só codificação para esse valor.
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, dict):
        return {k: _canonical(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_canonical(v) for v in value]
    return value


def serializar(value):
    """UTF-8, chaves ordenadas, sem espaços, LF final; não é RFC 8785."""
    return (json.dumps(_canonical(value), ensure_ascii=False, sort_keys=True,
                       separators=(",", ":"), allow_nan=False) + "\n").encode("utf-8")


def _provenance(item):
    return {"kind": "derived", "declared": deepcopy(item["provenance"])}


def normalizar(leitura):
    """Valida primeiro; retorna nova saída nominal. Não corrige nem escreve entrada."""
    errors = entrada.validar(leitura)
    if errors:
        raise LeituraInvalida(errors)

    rooms, walls = [], {}
    for room in leitura["rooms"]:
        x, y = int(room["xMm"]), int(room["yMm"])
        right, top = x + int(room["widthMm"]), y + int(room["depthMm"])
        rooms.append({
            "id": room["id"], "nome": room["name"],
            "poly": [[a / 1000, b / 1000] for a, b in
                     ((x, y), (right, y), (right, top), (x, top))],
            "walls": deepcopy(room["walls"]), "provenance": _provenance(room),
        })
        # Menor coordenada da parede e eixo de progressão, como no M1-0.
        for side, origin, axis in (
            ("south", (x, y), 0), ("north", (x, top), 0),
            ("west", (x, y), 1), ("east", (right, y), 1),
        ):
            walls[room["walls"][side]] = (origin, axis)

    # Partes ligadas por `merged` viram um cômodo: o contorno da união, sem a parede do
    # trecho comum. Cômodo de uma parte só sai como na 1.0.0.
    comodos = []
    for membros in entrada.grupos_mesclados(leitura):
        if len(membros) == 1:
            comodos.append(rooms[membros[0]])
            continue
        partes = [leitura["rooms"][i] for i in membros]
        contorno = entrada.contorno([
            (int(r["xMm"]), int(r["yMm"]), int(r["xMm"]) + int(r["widthMm"]),
             int(r["yMm"]) + int(r["depthMm"])) for r in partes])
        comodos.append({
            "id": partes[0]["id"], "nome": partes[0]["name"],
            "poly": [[a / 1000, b / 1000] for a, b in contorno],
            "parts": [{k: rooms[i][k] for k in ("id", "walls", "provenance")} for i in membros],
        })

    doors, windows = [], []
    for opening in leitura["openings"]:
        origin, axis = walls[opening["wallId"]]
        # Inteiros dobrados mantêm centros de vãos ímpares (meio milímetro).
        center = [2 * origin[0], 2 * origin[1]]
        center[axis] += 2 * int(opening["offsetMm"]) + int(opening["widthMm"])
        item = {
            "id": opening["id"], "wallId": opening["wallId"],
            "p": [v / 2000 for v in center],
            "largura": int(opening["widthMm"]) / 1000,
            "y0": int(opening["sillMm"]) / 1000,
            "y1": (int(opening["sillMm"]) + int(opening["heightMm"])) / 1000,
            "provenance": _provenance(opening),
        }
        if "pairedWallId" in opening:
            item["pairedWallId"] = opening["pairedWallId"]
        (doors if opening["kind"] == "door" else windows).append(item)

    versao = leitura["schemaVersion"]
    result = {
        "schemaVersion": versao, "kind": "derived-floor-plan", "unit": "m",
        "measurementBasis": "wall-centerlines", "construction": "not-applied",
        "source": {**{k: leitura[k] for k in ("id", "revision", "schemaVersion")},
                   "sha256": hashlib.sha256(serializar(leitura)).hexdigest()},
        "normalizer": {"id": "nominal-floor-plan", "version": versao,
                       "transformations": list(RULES if versao == "1.0.0" else RULES_1_1)},
        "provenance": _provenance(leitura),
        "references": deepcopy(leitura["references"]),
        "relations": [{**deepcopy(r), "provenance": _provenance(r)}
                      for r in leitura["relations"]],
        "planta": {"pe_direito": int(leitura["ceilingHeightMm"]) / 1000,
                   "comodos": comodos, "portas": doors, "janelas": windows},
    }
    Draft202012Validator(SCHEMAS[versao]).validate(result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("arquivo", type=Path, help="leitura.json M1-0; saída somente em stdout")
    args = parser.parse_args()
    try:
        text = args.arquivo.read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        errors = [entrada._error("INPUT_UNREADABLE", "")]
    else:
        try:
            # Mesma política de parsing da CLI M1-0: rejeita chaves duplicadas/NaN.
            doc = json.loads(text, object_pairs_hook=entrada._unique_object,
                             parse_constant=entrada._invalid_constant)
        except (ValueError, RecursionError):
            errors = [entrada._error("INVALID_JSON", "")]
        else:
            try:
                result = normalizar(doc)
            except LeituraInvalida as exc:
                errors = exc.errors
            else:
                sys.stdout.buffer.write(serializar(result))
                return 0
    sys.stdout.buffer.write(serializar({"valid": False, "errors": errors}))
    return 2


if __name__ == "__main__":
    raise SystemExit(main())

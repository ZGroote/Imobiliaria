"""Gate de persistência: stdin JSON → M1-0 → conteúdo/hash canônicos; sem escrita."""
import hashlib
import json
import sys
from pipeline import validar_leitura as entrada
from pipeline.normalizar_planta import serializar
from pipeline.editor_state import validar_editor_state


def main():
    try:
        payload = json.loads(sys.stdin.buffer.read().decode("utf-8"),
                             object_pairs_hook=entrada._unique_object,
                             parse_constant=entrada._invalid_constant)
        state, has_state = None, False
        if "--envelope" in sys.argv[1:]:
            leitura = json.loads(payload["leituraJson"], object_pairs_hook=entrada._unique_object,
                                 parse_constant=entrada._invalid_constant)
            if payload.get("editorStateJson") is not None:
                has_state = True
                state = json.loads(payload["editorStateJson"], object_pairs_hook=entrada._unique_object,
                                   parse_constant=entrada._invalid_constant)
        else:
            leitura = payload
        errors = entrada.validar(leitura)
        if has_state:
            errors += validar_editor_state(leitura, state)
    except (ValueError, RecursionError, TypeError, KeyError):
        errors = [{"code": "INVALID_JSON", "message": entrada.MESSAGES["INVALID_JSON"], "path": ""}]
    if errors:
        sys.stdout.buffer.write(serializar({"errors": errors}))
        return 2
    canonical = serializar(leitura)
    result = {"leitura": json.loads(canonical), "contentSha256": hashlib.sha256(canonical).hexdigest()}
    if has_state:
        result.update(editorState=state, editorStateSha256=hashlib.sha256(serializar(state)).hexdigest())
    sys.stdout.buffer.write(serializar(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

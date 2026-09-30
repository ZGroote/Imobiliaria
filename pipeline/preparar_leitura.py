"""Gate de persistência: stdin JSON → M1-0 → conteúdo/hash canônicos; sem escrita."""
import hashlib
import json
import sys
from pipeline import validar_leitura as entrada
from pipeline.normalizar_planta import serializar


def main():
    try:
        leitura = json.loads(sys.stdin.buffer.read().decode("utf-8"),
                             object_pairs_hook=entrada._unique_object,
                             parse_constant=entrada._invalid_constant)
        errors = entrada.validar(leitura)
    except (ValueError, RecursionError):
        errors = [{"code": "INVALID_JSON", "message": entrada.MESSAGES["INVALID_JSON"], "path": ""}]
    if errors:
        sys.stdout.buffer.write(serializar({"errors": errors}))
        return 2
    canonical = serializar(leitura)
    sys.stdout.buffer.write(serializar({"leitura": json.loads(canonical),
                                       "contentSha256": hashlib.sha256(canonical).hexdigest()}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Baixa os mapas da lei que ficam fora do git (release privada) e confere o sha256.

python -I viabilidade/baixar_mapas.py              # baixa só o que falta ou está diferente
python -I viabilidade/baixar_mapas.py --conferir   # só confere, sem rede

Precisa do `gh` autenticado com leitura no repositório de artefatos (no CI: GH_TOKEN).
"""
import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
MANIFESTO = RAIZ / "viabilidade/terreno/dados/mapas-externos.json"


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else None


def main():
    m = json.loads(MANIFESTO.read_text(encoding="utf-8"))
    so_conferir = "--conferir" in sys.argv
    erros = 0
    for item in m["arquivos"]:
        destino = RAIZ / item["destino"]
        if sha(destino) == item["sha256"]:
            continue
        if so_conferir:
            print("FALTA/DIFERENTE", item["destino"])
            erros += 1
            continue
        with tempfile.TemporaryDirectory() as tmp:
            subprocess.run(["gh", "release", "download", m["release"], "-R", m["repo"], "-p", item["asset"], "-D", tmp],
                           check=True)
            baixado = Path(tmp) / item["asset"]
            if sha(baixado) != item["sha256"]:
                print("SHA256 DIFERENTE do manifesto:", item["asset"])
                erros += 1
                continue
            destino.parent.mkdir(parents=True, exist_ok=True)
            destino.write_bytes(baixado.read_bytes())
            print("baixado", item["destino"])
    print("mapas:", "ok" if not erros else f"{erros} problema(s)")
    sys.exit(1 if erros else 0)


if __name__ == "__main__":
    main()

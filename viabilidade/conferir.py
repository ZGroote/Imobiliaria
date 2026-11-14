"""Conferência da central sem gastar IA: testes de cada frente + arquivos soltos por frente.

python -I -X utf8 viabilidade/conferir.py
Saída curta. A IA central só lê o que falhou.
"""
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
TESTES = {
    "motor": [sys.executable, "-I", "-X", "utf8", "viabilidade/motor/test_motor.py"],
    "terreno": [sys.executable, "-I", "-X", "utf8", "viabilidade/terreno/testar_pilotos.py", "--reproduzir"],
}
TMP = RAIZ / "viabilidade" / "lei" / "__zonas_conferir.json"


def rodar(cmd):
    r = subprocess.run(cmd, cwd=RAIZ, capture_output=True, text=True, encoding="utf-8", errors="replace")
    return r.returncode, (r.stdout + r.stderr).strip().splitlines()[-3:]


def main():
    falhou = False
    for frente, cmd in TESTES.items():
        if not (RAIZ / cmd[4]).exists():
            continue
        cod, fim = rodar(cmd)
        print(f"{'OK ' if cod == 0 else 'FALHOU'} {frente}" + ("" if cod == 0 else "\n   " + "\n   ".join(fim)))
        falhou |= cod != 0
    cod, fim = rodar([sys.executable, "-I", "-X", "utf8", "viabilidade/lei/gera_zonas.py", str(TMP)])
    igual = cod == 0 and TMP.read_bytes() == (RAIZ / "viabilidade/lei/zonas.json").read_bytes()
    TMP.unlink(missing_ok=True)
    print(("OK " if igual else "FALHOU") + " lei (gera_zonas.py refaz zonas.json igual)")
    falhou |= not igual
    linhas = subprocess.run(["git", "status", "--short", "--", "viabilidade"], cwd=RAIZ,
                                  capture_output=True, text=True, encoding="utf-8").stdout.splitlines()
    soltos = {}
    for l in linhas:
        partes = l[3:].split("/")
        frente = partes[1] if len(partes) > 2 else "(raiz)"
        soltos[frente] = soltos.get(frente, 0) + 1
    print("soltos: " + (", ".join(f"{f}={n}" for f, n in sorted(soltos.items())) or "nenhum"))
    sys.exit(1 if falhou else 0)


if __name__ == "__main__":
    main()

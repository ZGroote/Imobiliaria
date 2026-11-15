"""Conferência da central sem gastar IA: testes de cada frente, mudanças fora do módulo e arquivos soltos.

python -I -X utf8 viabilidade/conferir.py [--base origin/main] [--saida viabilidade/.conferir]

Saída curta na tela; log completo de cada verificação + resumo.json na pasta --saida.
Estados: aprovado, reprovado, nao_executado. Só sai 0 se tudo for aprovado:
teste obrigatório ausente, sem ferramenta, estourado no tempo ou com "skipped" conta como falha.
"""
import argparse
import datetime
import hashlib
import json
import os
import platform
import shutil
import subprocess
import sys
import time
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PY = [sys.executable, "-I", "-X", "utf8"]
# frente -> (arquivo de teste obrigatório, comando)
TESTES = {
    "motor": ("viabilidade/motor/test_motor.py", PY + ["viabilidade/motor/test_motor.py"]),
    "terreno": ("viabilidade/terreno/testar_pilotos.py", PY + ["viabilidade/terreno/testar_pilotos.py", "--reproduzir"]),
    "relatorio": ("viabilidade/relatorio/test_relatorio.py", PY + ["viabilidade/relatorio/test_relatorio.py"]),
    "lei": ("viabilidade/lei/gera_zonas.py", None),  # refaz zonas.json e compara bytes
    "visual": ("viabilidade/visual/testar.cjs", ["node", "viabilidade/visual/testar.cjs"]),
}
EVIDENCIAS_VISUAL = "viabilidade/visual/evidencias"
TEMPO_MAX = 900
# única exceção fora de viabilidade/: o workflow que roda este script no GitHub
FORA_PERMITIDO = [":(exclude)viabilidade", ":(exclude).github/workflows/viabilidade.yml",
                  ":(exclude)tests/test_tamanho_versionado.py"]  # exceção de tamanho do relevo (portão 1E)


def git(*args):
    r = subprocess.run(["git", *args], cwd=RAIZ, capture_output=True, text=True, encoding="utf-8")
    return r.returncode, r.stdout.strip()


def rodar(cmd, env=None):
    """-> (estado, código, saída completa)."""
    try:
        r = subprocess.run(cmd, cwd=RAIZ, capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=TEMPO_MAX, env=env)
    except FileNotFoundError as e:
        return "nao_executado", None, f"ferramenta ausente: {e}"
    except subprocess.TimeoutExpired as e:
        return "nao_executado", None, f"estourou {TEMPO_MAX}s\n{e.stdout or ''}{e.stderr or ''}"
    saida = r.stdout + r.stderr
    if r.returncode != 0:
        return "reprovado", r.returncode, saida
    if "skipped=" in saida:  # unittest pulou caso: não é aprovação
        return "nao_executado", 0, saida + "\n[conferir] há teste pulado (skipped)"
    return "aprovado", 0, saida


def rodar_lei():
    tmp = RAIZ / "viabilidade" / "lei" / "__zonas_conferir.json"
    estado, cod, saida = rodar(PY + ["viabilidade/lei/gera_zonas.py", str(tmp)])
    if estado == "aprovado":
        igual = tmp.read_bytes() == (RAIZ / "viabilidade/lei/zonas.json").read_bytes()
        saida += f"\n[conferir] zonas.json refeito igual ao versionado: {igual}"
        estado = "aprovado" if igual else "reprovado"
    tmp.unlink(missing_ok=True)
    return estado, cod, saida


def rodar_visual():
    if not shutil.which("node"):
        return "nao_executado", None, "node não encontrado"
    _, sujo = git("status", "--porcelain", "--", EVIDENCIAS_VISUAL)
    srv = subprocess.Popen([sys.executable, "-I", "-u", "-m", "http.server", "0", "--bind", "127.0.0.1"],
                           cwd=RAIZ, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    try:
        linha = srv.stdout.readline()  # "Serving HTTP on 127.0.0.1 port 54321 ..."
        porta = linha.split(" port ")[1].split()[0]
        env = dict(os.environ, VISUAL_URL=f"http://127.0.0.1:{porta}/viabilidade/visual/")
        estado, cod, saida = rodar(TESTES["visual"][1], env)
    finally:
        srv.terminate()
        srv.wait()
    # o teste regrava os prints versionados; se estavam limpos antes, volta como estavam
    if not sujo:
        git("checkout", "--", EVIDENCIAS_VISUAL)
        saida += f"\n[conferir] {EVIDENCIAS_VISUAL} restaurado (estava limpo antes do teste)"
    return estado, cod, saida


def fora_do_modulo(base):
    """-> (estado, lista de arquivos alterados fora de viabilidade/, texto)."""
    cod, mb = git("merge-base", base, "HEAD")
    if cod:
        return "nao_executado", [], f"referência '{base}' não encontrada (git fetch?)"
    _, commitados = git("diff", "--name-only", mb, "HEAD", "--", ".", *FORA_PERMITIDO)
    _, soltos = git("status", "--porcelain", "--", ".", *FORA_PERMITIDO)
    lista = [l for l in commitados.splitlines() if l] + [l[3:] for l in soltos.splitlines() if l]
    texto = f"base {base} -> merge-base {mb}\ncommitados:\n{commitados or '-'}\nsoltos:\n{soltos or '-'}"
    return ("reprovado" if lista else "aprovado"), lista, texto


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="origin/main", help="referência Git para mudanças fora de viabilidade/")
    ap.add_argument("--saida", default="viabilidade/.conferir", help="pasta dos logs completos")
    a = ap.parse_args()
    saida = RAIZ / a.saida
    saida.mkdir(parents=True, exist_ok=True)

    resultados = {}
    for frente, (arquivo, cmd) in TESTES.items():
        t = time.time()
        if not (RAIZ / arquivo).exists():  # teste obrigatório: sumiu = falha, nunca "ok"
            estado, cod, log = "nao_executado", None, f"teste obrigatório não encontrado: {arquivo}"
        elif frente == "lei":
            estado, cod, log = rodar_lei()
        elif frente == "visual":
            estado, cod, log = rodar_visual()
        else:
            estado, cod, log = rodar(cmd)
        arq = saida / f"{frente}.log"
        arq.write_text(log, encoding="utf-8")
        resultados[frente] = {"estado": estado, "codigo": cod, "segundos": round(time.time() - t, 1),
                              "log": arq.relative_to(RAIZ).as_posix(),
                              "sha256_log": hashlib.sha256(arq.read_bytes()).hexdigest()}
        ultima = log.strip().splitlines()[-1:] or [""]
        print(f"{estado.upper():13} {frente} ({resultados[frente]['segundos']}s)"
              + ("" if estado == "aprovado" else f"\n   {ultima[0][:200]}  -> {arq.name}"))

    estado_fora, lista_fora, texto_fora = fora_do_modulo(a.base)
    (saida / "fora-do-modulo.log").write_text(texto_fora, encoding="utf-8")
    print(f"{estado_fora.upper():13} nada fora de viabilidade/ desde {a.base}"
          + ("" if estado_fora == "aprovado" else f"\n   {len(lista_fora) or texto_fora}"
             + (f" arquivo(s): {', '.join(lista_fora[:5])}" if lista_fora else "")))

    _, st = git("status", "--porcelain", "--", "viabilidade")
    soltos = {}
    for l in st.splitlines():
        partes = l[3:].split("/")
        frente = partes[1] if len(partes) > 2 else "(raiz)"
        soltos[frente] = soltos.get(frente, 0) + 1
    print("soltos em viabilidade/: " + (", ".join(f"{f}={n}" for f, n in sorted(soltos.items())) or "nenhum"))

    estados = [r["estado"] for r in resultados.values()] + [estado_fora]
    contagem = {e: estados.count(e) for e in ("aprovado", "reprovado", "nao_executado")}
    contagem["executados"] = contagem["aprovado"] + contagem["reprovado"]
    _, head = git("rev-parse", "HEAD")
    resumo = {"data": datetime.datetime.now().astimezone().isoformat(timespec="seconds"), "head": head,
              "base": a.base, "python": platform.python_version(), "plataforma": platform.platform(),
              "verificacoes": resultados,
              "fora_do_modulo": {"estado": estado_fora, "arquivos": lista_fora},
              "soltos": soltos, "contagem": contagem}
    (saida / "resumo.json").write_text(json.dumps(resumo, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"executados {contagem['executados']} | aprovados {contagem['aprovado']} | reprovados "
          f"{contagem['reprovado']} | não executados {contagem['nao_executado']} | log: {a.saida}/resumo.json")
    sys.exit(0 if contagem["aprovado"] == len(estados) else 1)


if __name__ == "__main__":
    main()

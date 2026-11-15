"""Um comando do lote do cadastro ao relatório (V1-001).

    python -I -X utf8 viabilidade/motor/estudar.py --base completo --indices 30516 --zona SC-Z4 --pasta DESTINO
        [--premissas premissas.json]

Encadeia, no mesmo processo, as três peças que já existiam:
  terreno/novo_lote.py (lote) -> motor.gerar_estudo (estudo) -> relatorio.gerar_html (relatório).
Grava em DESTINO: lote.json, estudo.json, relatorio.html e resumo.txt.
Tudo é calculado antes de gravar; se algo falhar, a execução não deixa nada para trás.
A pasta de destino tem que não existir ou estar vazia.
"""
import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

sys.dont_write_bytecode = True
AQUI = Path(__file__).resolve().parent
VIAB = AQUI.parent
for pasta in (AQUI, VIAB / "terreno", VIAB / "relatorio"):  # -I não põe nada disso no path
    sys.path.insert(0, str(pasta))
import novo_lote  # noqa: E402  (terreno)
import relatorio  # noqa: E402
from motor import gerar_estudo  # noqa: E402

ARQUIVOS = ("lote.json", "estudo.json", "relatorio.html", "resumo.txt")


def _conferir_pasta(pasta):
    if pasta.exists() and (not pasta.is_dir() or any(pasta.iterdir())):
        raise ValueError(f"A pasta {pasta} já existe e não está vazia; escolha outra ou esvazie esta.")


def _resumo(lote, estudo, rev):
    d = estudo["dominio"]
    dominio = d["status"] + (": " + "; ".join(d["motivos"]) if d["motivos"] else "")
    linhas = [
        f"Lote: {lote['id']} (base {lote['fonte']['base']}, feições {lote['fonte']['indices_feicoes_zero_based']})",
        f"Área: {lote['area_m2']:.3f} m²",
        f"Zona: {lote['zona_id']} (informada pelo usuário, não conferida)",
        f"Domínio do motor: {dominio}",
        f"Opções calculadas: {len(estudo['opcoes'])} ({', '.join(o['id'] for o in estudo['opcoes']) or 'nenhuma'})",
        f"Opções ausentes: {len(estudo['opcoes_ausentes'])}",
    ]
    linhas += [f"  {a['id']} {a['nome']}: {a['motivo']}" + (f" ({a['detalhe']})" if a.get("detalhe") else "")
               for a in estudo["opcoes_ausentes"]]
    linhas.append(f"Revisão do estudo: {rev} (motor {estudo['versao_motor']})")
    return "\n".join(linhas) + "\n"


def estudar(base, indices, zona, pasta, premissas=None, cadastro=None):
    """Roda a cadeia inteira e devolve o resumo. `cadastro` evita reler a base (uso em testes)."""
    pasta = Path(pasta)
    _conferir_pasta(pasta)
    novo_lote.validar_zona(zona)
    lote = (cadastro or novo_lote.Cadastro(base)).gerar(indices, zona)
    zonas = {z["id"]: z for z in novo_lote.gl.ler("viabilidade/lei/zonas.json")}
    estudo = gerar_estudo(lote, zonas[zona], premissas)
    # mesmo formato do gerar.py; o hash é o dos bytes que vão para o disco, como no relatório
    bytes_estudo = (json.dumps(estudo, ensure_ascii=False, indent=1) + "\n").encode("utf-8")
    sha = hashlib.sha256(bytes_estudo).hexdigest()
    html = relatorio.gerar_html(json.loads(bytes_estudo), sha)
    resumo = _resumo(lote, estudo, sha[:12])
    textos = {
        "lote.json": (json.dumps(lote, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8"),
        "estudo.json": bytes_estudo,
        "relatorio.html": html.encode("utf-8"),
        "resumo.txt": resumo.encode("utf-8"),
    }
    criou_pasta = not pasta.exists()
    criados = []
    try:
        pasta.mkdir(parents=True, exist_ok=True)
        for nome, conteudo in textos.items():
            criados.append(pasta / nome)
            (pasta / nome).write_bytes(conteudo)
    except BaseException:
        for arq in criados:
            arq.unlink(missing_ok=True)
        if criou_pasta:
            try:
                pasta.rmdir()
            except OSError:
                pass
        raise
    return {"pasta": pasta, "revisao": sha[:12], "resumo": resumo}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base", required=True, choices=novo_lote.BASES)
    ap.add_argument("--indices", required=True, type=int, nargs="+")
    ap.add_argument("--zona", required=True)
    ap.add_argument("--pasta", required=True, type=Path)
    ap.add_argument("--premissas", type=Path, help="JSON com premissas que trocam as do padrão")
    a = ap.parse_args(argv)
    try:
        premissas = json.loads(a.premissas.read_text(encoding="utf-8")) if a.premissas else None
        r = estudar(a.base, a.indices, a.zona, a.pasta, premissas)
    except Exception as erro:  # a mensagem da etapa que falhou (novo_lote, motor ou relatório) vai inteira
        ap.exit(2, f"Erro: {erro}\n")
    print(r["resumo"], end="")
    print(f"-> {r['pasta']}")


if __name__ == "__main__":
    main()

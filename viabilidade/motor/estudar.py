"""Um comando do lote do cadastro ao relatório (V1-001).

    python -I -X utf8 viabilidade/motor/estudar.py --base completo --indices 30516 --zona SC-Z4 --pasta DESTINO
    python -I -X utf8 viabilidade/motor/estudar.py --base completo --ponto "-22.0175, -47.8908" --zona auto --pasta DESTINO
        [--premissas premissas.json]

--ponto ("latitude, longitude", como no Google Maps) acha o lote e vale no lugar de --indices;
--zona auto pede a zona ao mapa do Plano Diretor. As duas regras, e as mensagens de recusa, são do terreno/novo_lote.py.

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


INCIDENCIA = {"sobreposicao_visual": "sobreposição visual", "possivel_incidencia": "possível incidência"}


def _linha_zona(lote):
    if lote["zona_origem"] == "informada_pelo_usuario":
        return f"Zona: {lote['zona_id']} (informada pelo usuário, não conferida)"
    outras = ", ".join(lote["zona_sugestao"]["alternativas"]) or "nenhuma"
    return f"Zona: {lote['zona_id']} (sugerida pelo mapa do Plano Diretor, não conferida; outras zonas por perto: {outras})"


def _linhas_areas_especiais(lote):
    achadas = [f"{a['nome']} ({INCIDENCIA[a['incidencia']]})" for a in lote["areas_especiais"] if a["incidencia"] in INCIDENCIA]
    nao_verif = [f"Anexo {a['anexo']}" for a in lote["areas_especiais"] if a["tipo"] == "nao_verificada"]
    return [f"Áreas especiais encontradas: {'; '.join(achadas) or 'nenhuma'}",
            "Áreas especiais não verificadas: " + (", ".join(nao_verif) + " (o resultado pode passar do que o terreno permite; conferir)"
                                                    if nao_verif else "nenhuma")]


def _resumo(lote, estudo, rev):
    d = estudo["dominio"]
    dominio = d["status"] + (": " + "; ".join(d["motivos"]) if d["motivos"] else "")
    linhas = [
        f"Lote: {lote['id']} (base {lote['fonte']['base']}, feições {lote['fonte']['indices_feicoes_zero_based']})",
        f"Área: {lote['area_m2']:.3f} m²",
        _linha_zona(lote),
        *_linhas_areas_especiais(lote),
        f"Domínio do motor: {dominio}",
        f"Opções calculadas: {len(estudo['opcoes'])} ({', '.join(o['id'] for o in estudo['opcoes']) or 'nenhuma'})",
        f"Opções ausentes: {len(estudo['opcoes_ausentes'])}",
    ]
    linhas += [f"  {a['id']} {a['nome']}: {a['motivo']}" + (f" ({a['detalhe']})" if a.get("detalhe") else "")
               for a in estudo["opcoes_ausentes"]]
    linhas.append(f"Revisão do estudo: {rev} (motor {estudo['versao_motor']})")
    return "\n".join(linhas) + "\n"


def _gerar_lote(base, indices, ponto, zona, cadastro):
    """Lote do terreno. Recusa do terreno sai inteira; zona automática duvidosa ganha o jeito de continuar."""
    if (indices is None) == (ponto is None):
        raise ValueError("Informe o lote por --indices ou por --ponto (um dos dois, não os dois)")
    novo_lote.validar_zona(zona, permitir_auto=True)
    xy = novo_lote.ler_ponto(ponto) if ponto is not None else None
    cadastro = cadastro or novo_lote.Cadastro(base)
    try:
        return cadastro.gerar([cadastro.localizar(xy)] if xy is not None else indices, zona)
    except ValueError as erro:
        sugestao = getattr(erro, "sugestao", None)  # ZonaIncerta, do terreno/sugerir_zona.py
        if sugestao is None:
            raise
        opcoes = ", ".join(sugestao["alternativas"]) or "nenhuma identificada pelo mapa; veja as zonas válidas em viabilidade/lei/zonas.json"
        raise ValueError(f"{erro} Rode de novo com --zona SC-XX, uma destas: {opcoes}.") from None


def estudar(base, indices, zona, pasta, premissas=None, cadastro=None, ponto=None):
    """Roda a cadeia inteira e devolve o resumo. `cadastro` evita reler a base (uso em testes).
    O lote vem de `indices` ou de `ponto` ("lat, lon"); `zona` pode ser "auto"."""
    pasta = Path(pasta)
    _conferir_pasta(pasta)
    lote = _gerar_lote(base, indices, ponto, zona, cadastro)
    zonas = {z["id"]: z for z in novo_lote.gl.ler("viabilidade/lei/zonas.json")}
    estudo = gerar_estudo(lote, zonas[lote["zona_id"]], premissas)
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
    lote = ap.add_mutually_exclusive_group(required=True)
    lote.add_argument("--indices", type=int, nargs="+")
    lote.add_argument("--ponto", help='"latitude, longitude" (WGS84, ponto decimal), como no Google Maps')
    ap.add_argument("--zona", required=True, help='SC-XX, ou "auto" para o mapa do Plano Diretor sugerir')
    ap.add_argument("--pasta", required=True, type=Path)
    ap.add_argument("--premissas", type=Path, help="JSON com premissas que trocam as do padrão")
    argv = list(sys.argv[1:] if argv is None else argv)
    if "--ponto" in argv and argv.index("--ponto") + 1 < len(argv):  # argparse lê "-22.0,-47.8" como opção
        i = argv.index("--ponto")
        argv[i:i + 2] = [f"--ponto={argv[i + 1]}"]
    a = ap.parse_args(argv)
    try:
        premissas = json.loads(a.premissas.read_text(encoding="utf-8")) if a.premissas else None
        r = estudar(a.base, a.indices, a.zona, a.pasta, premissas, ponto=a.ponto)
    except Exception as erro:  # a mensagem da etapa que falhou (novo_lote, motor ou relatório) vai inteira
        ap.exit(2, f"Erro: {erro}\n")
    print(r["resumo"], end="")
    print(f"-> {r['pasta']}")


if __name__ == "__main__":
    main()

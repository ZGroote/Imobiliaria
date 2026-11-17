"""Um comando do lote do cadastro ao relatório (V1-001).

    python -I -X utf8 viabilidade/motor/estudar.py --base completo --indices 30516 --zona SC-Z4 --pasta DESTINO
    python -I -X utf8 viabilidade/motor/estudar.py --base completo --ponto "-22.0175, -47.8908" --zona auto --pasta DESTINO
        [--premissas premissas.json] [--apto-m2 N] [--comum-m2 N] [--laje-min-m2 N]

--ponto ("latitude, longitude", como no Google Maps) acha o lote e vale no lugar de --indices;
--apto-m2, --comum-m2 e --laje-min-m2 trocam premissas de produto (apartamento, área comum por pavimento, laje mínima)
e contam como informadas pelo usuário; não valem junto com a mesma premissa em --premissas.
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


# atalho da linha de comando -> (premissa do motor, mínimo, máximo, rótulo no resumo)
ATALHOS = {
    "apto_m2": ("area_privativa_por_unidade_m2", 20, 400, "apto"),
    "comum_m2": ("area_comum_por_pavimento_m2", 0, 400, "comum por pavimento"),
    "laje_min_m2": ("laje_minima_m2", 20, 1000, "laje mínima"),
}


def juntar_premissas(premissas, **atalhos):
    """Premissas do JSON + atalhos da linha de comando (valor None = não usado). Recusa fora da faixa e conflito."""
    premissas = dict(premissas or {})
    for nome, valor in atalhos.items():
        if valor is None:
            continue
        chave, lo, hi, _ = ATALHOS[nome]
        flag = "--" + nome.replace("_", "-")
        if not lo <= valor <= hi:
            raise ValueError(f"{flag} {valor:g} fora da faixa plausível: de {lo} a {hi} m².")
        if chave in premissas:
            raise ValueError(f"{flag} e --premissas trazem {chave}; use só um dos dois.")
        premissas[chave] = valor
    return premissas


def _linha_premissas(premissas):
    rotulos = {chave: rot for chave, _, _, rot in ATALHOS.values()}
    partes = [f"{rotulos[k]} {v:g} m²" if k in rotulos else f"{k} {v}" for k, v in (premissas or {}).items()]
    return ["Premissas do usuário: " + "; ".join(partes)] if partes else []


def _conferir_pasta(pasta):
    if pasta.exists() and (not pasta.is_dir() or any(pasta.iterdir())):
        raise ValueError(f"A pasta {pasta} já existe e não está vazia; escolha outra ou esvazie esta.")


INCIDENCIA = {"sobreposicao_visual": "sobreposição visual", "possivel_incidencia": "possível incidência"}


def _linha_zona(lote):
    if lote["zona_origem"] == "informada_pelo_usuario":
        return f"Zona: {lote['zona_id']} (informada pelo usuário, não conferida)"
    if lote["zona_origem"] == "candidata_na_divisa":
        return f"Zona: {lote['zona_id']} (uma das candidatas na divisa: {', '.join(lote['zona_sugestao']['candidatas'])}; não conferida, confirmar na Prefeitura)"
    outras = ", ".join(lote["zona_sugestao"]["alternativas"]) or "nenhuma"
    return f"Zona: {lote['zona_id']} (sugerida pelo mapa do Plano Diretor, não conferida; outras zonas por perto: {outras})"


def _linhas_areas_especiais(lote):
    achadas = [f"{a['nome']} ({INCIDENCIA[a['incidencia']]})" for a in lote["areas_especiais"] if a["incidencia"] in INCIDENCIA]
    nao_verif = [f"Anexo {a['anexo']}" for a in lote["areas_especiais"] if a["tipo"] == "nao_verificada"]
    return [f"Áreas especiais encontradas: {'; '.join(achadas) or 'nenhuma'}",
            "Áreas especiais não verificadas: " + (", ".join(nao_verif) + " (o resultado pode passar do que o terreno permite; conferir)"
                                                    if nao_verif else "nenhuma")]


def _resumo(lote, estudo, rev, premissas=None):
    d = estudo["dominio"]
    dominio = d["status"] + (": " + "; ".join(d["motivos"]) if d["motivos"] else "")
    linhas = [
        f"Lote: {lote['id']} (base {lote['fonte']['base']}, feições {lote['fonte']['indices_feicoes_zero_based']})",
        f"Área: {lote['area_m2']:.3f} m²",
        _linha_zona(lote),
        *_linhas_areas_especiais(lote),
        *_linha_premissas(premissas),
        f"Domínio do motor: {dominio}",
        f"Opções calculadas: {len(estudo['opcoes'])} ({', '.join(o['id'] for o in estudo['opcoes']) or 'nenhuma'})",
        f"Opções ausentes: {len(estudo['opcoes_ausentes'])}",
    ]
    linhas += [f"  {a['id']} {a['nome']}: {a['motivo']}" + (f" ({a['detalhe']})" if a.get("detalhe") else "")
               for a in estudo["opcoes_ausentes"]]
    linhas.append(f"Revisão do estudo: {rev} (motor {estudo['versao_motor']})")
    return "\n".join(linhas) + "\n"


class _Divisa(ValueError):
    """A única dúvida de zona é a divisa (terreno T23): leva as candidatas para estudar uma a uma."""
    def __init__(self, erro, sugestao):
        super().__init__(str(erro))
        self.sugestao = sugestao


def _resolver(base, indices, ponto, zona, cadastro):
    if (indices is None) == (ponto is None):
        raise ValueError("Informe o lote por --indices ou por --ponto (um dos dois, não os dois)")
    novo_lote.validar_zona(zona, permitir_auto=True)
    xy = novo_lote.ler_ponto(ponto) if ponto is not None else None
    cadastro = cadastro or novo_lote.Cadastro(base)
    return cadastro, ([cadastro.localizar(xy)] if xy is not None else indices)


def _gerar_lote(cadastro, indices, zona):
    """Lote do terreno. Recusa do terreno sai inteira; zona automática duvidosa ganha o jeito de continuar."""
    try:
        return cadastro.gerar(indices, zona)
    except ValueError as erro:
        sugestao = getattr(erro, "sugestao", None)  # ZonaIncerta, do terreno/sugerir_zona.py
        if sugestao is None:
            raise
        if sugestao.get("so_divisa") and zona == "auto":
            raise _Divisa(erro, sugestao) from None
        opcoes = ", ".join(sugestao["alternativas"]) or "nenhuma identificada pelo mapa; veja as zonas válidas em viabilidade/lei/zonas.json"
        raise ValueError(f"{erro} Rode de novo com --zona SC-XX, uma destas: {opcoes}.") from None


def _calcular(lote, premissas):
    """Estudo de um lote, tudo em memória: ({arquivo: bytes}, resumo, revisão, estudo)."""
    zonas = {z["id"]: z for z in novo_lote.gl.ler("viabilidade/lei/zonas.json")}
    estudo = gerar_estudo(lote, zonas[lote["zona_id"]], premissas)
    # mesmo formato do gerar.py; o hash é o dos bytes que vão para o disco, como no relatório
    bytes_estudo = (json.dumps(estudo, ensure_ascii=False, indent=1) + "\n").encode("utf-8")
    sha = hashlib.sha256(bytes_estudo).hexdigest()
    html = relatorio.gerar_html(json.loads(bytes_estudo), sha)
    resumo = _resumo(lote, estudo, sha[:12], premissas)
    textos = {
        "lote.json": (json.dumps(lote, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8"),
        "estudo.json": bytes_estudo,
        "relatorio.html": html.encode("utf-8"),
        "resumo.txt": resumo.encode("utf-8"),
    }
    return textos, resumo, sha[:12], estudo


def _gravar(pasta, arquivos):
    """Grava {caminho relativo: bytes}; se falhar, apaga o que criou (arquivos e pastas)."""
    criou_pasta = not pasta.exists()
    criados, subpastas = [], []
    try:
        pasta.mkdir(parents=True, exist_ok=True)
        for nome, conteudo in arquivos.items():
            alvo = pasta / nome
            if not alvo.parent.exists():
                alvo.parent.mkdir()
                subpastas.append(alvo.parent)
            criados.append(alvo)
            alvo.write_bytes(conteudo)
    except BaseException:
        for arq in criados:
            arq.unlink(missing_ok=True)
        for sub in subpastas + ([pasta] if criou_pasta else []):
            try:
                sub.rmdir()
            except OSError:
                pass
        raise


def _melhor(estudo, campo):
    return max((o["metricas"][campo] for o in estudo["opcoes"]), default=None)


def _resumo_divisa(lote_ref, candidatas, feitos, falhas):
    """resumo.txt da raiz: as candidatas lado a lado. feitos: {zona: (estudo, revisão)}; falhas: {zona: motivo}."""
    dist = lote_ref["zona_sugestao"].get("distancia_divisa_m")
    fmt = lambda v, f: "-" if v is None else format(v, f)
    linhas = [f"Lote: {lote_ref['id']} (base {lote_ref['fonte']['base']}, feições {lote_ref['fonte']['indices_feicoes_zero_based']})",
              f"Área: {lote_ref['area_m2']:.3f} m²",
              f"Lote na divisa entre zonas ({' | '.join(candidatas)}" + (f", divisa a {dist:g} m" if dist is not None else "") + "): um estudo por zona candidata.",
              "Lote na divisa entre zonas: confirmar a zona na Prefeitura antes de usar qualquer um dos estudos.", "",
              "Zona    | Opções | Melhor CA | Unidades | Área vendável (m²) | Revisão      | Pasta"]
    for z in candidatas:
        if z in feitos:
            e, rev = feitos[z]
            linhas.append(f"{z:7} | {len(e['opcoes']):6} | {fmt(_melhor(e, 'ca_usado'), '9.3f'):>9} | {fmt(_melhor(e, 'unidades_estimadas'), 'd'):>8} "
                          f"| {fmt(_melhor(e, 'area_privativa_m2'), '.1f'):>18} | {rev} | zona-{z}/" + ("  (nenhuma opção cabe)" if not e["opcoes"] else ""))
        else:
            linhas.append(f"{z:7} | sem estudo: {falhas[z]}")
    linhas.append("Melhor = maior valor entre as opções de cada zona (CA usado, unidades, área privativa).")
    return "\n".join(linhas) + "\n"


def _estudar_divisa(cadastro, indices, divisa, pasta, premissas):
    candidatas = divisa.sugestao["candidatas"]
    arquivos, feitos, falhas, lote_ref = {}, {}, {}, None
    for z in candidatas:
        try:
            lote = cadastro.gerar(indices, "auto:" + z)
            textos, _, rev, estudo = _calcular(lote, premissas)
        except ValueError as erro:  # uma candidata que não gera estudo não derruba a outra
            falhas[z] = " ".join(str(erro).split())
            continue
        lote_ref = lote_ref or lote
        feitos[z] = (estudo, rev)
        arquivos.update({f"zona-{z}/{nome}": b for nome, b in textos.items()})
    if not feitos:
        raise ValueError(f"{divisa} Nenhuma das zonas candidatas gerou estudo: " + "; ".join(f"{z}: {m}" for z, m in falhas.items()))
    resumo = _resumo_divisa(lote_ref, candidatas, feitos, falhas)
    arquivos["resumo.txt"] = resumo.encode("utf-8")
    _gravar(pasta, arquivos)
    return {"pasta": pasta, "revisao": ", ".join(f"{z}:{r}" for z, (_, r) in feitos.items()), "resumo": resumo, "divisa": candidatas}


def estudar(base, indices, zona, pasta, premissas=None, cadastro=None, ponto=None):
    """Roda a cadeia inteira e devolve o resumo. `cadastro` evita reler a base (uso em testes).
    O lote vem de `indices` ou de `ponto` ("lat, lon"); `zona` pode ser "auto".
    Com "auto" e a divisa como única dúvida (terreno T23), grava um estudo por candidata em pasta/zona-SC-Zx/ e devolve "divisa"."""
    pasta = Path(pasta)
    _conferir_pasta(pasta)
    cadastro, indices = _resolver(base, indices, ponto, zona, cadastro)
    try:
        lote = _gerar_lote(cadastro, indices, zona)
    except _Divisa as divisa:
        return _estudar_divisa(cadastro, indices, divisa, pasta, premissas)
    textos, resumo, rev, _ = _calcular(lote, premissas)
    _gravar(pasta, textos)
    return {"pasta": pasta, "revisao": rev, "resumo": resumo}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base", required=True, choices=novo_lote.BASES)
    lote = ap.add_mutually_exclusive_group(required=True)
    lote.add_argument("--indices", type=int, nargs="+")
    lote.add_argument("--ponto", help='"latitude, longitude" (WGS84, ponto decimal), como no Google Maps')
    ap.add_argument("--zona", required=True, help='SC-XX, ou "auto" para o mapa do Plano Diretor sugerir')
    ap.add_argument("--pasta", required=True, type=Path)
    ap.add_argument("--premissas", type=Path, help="JSON com premissas que trocam as do padrão")
    ap.add_argument("--apto-m2", type=float, help="área privativa por apartamento, m² (padrão 60; aceita 20 a 400)")
    ap.add_argument("--comum-m2", type=float, help="área comum por pavimento, m² (padrão 40; aceita 0 a 400)")
    ap.add_argument("--laje-min-m2", type=float, help="laje mínima de uma opção, m² (padrão 80; aceita 20 a 1000)")
    argv = list(sys.argv[1:] if argv is None else argv)
    if "--ponto" in argv and argv.index("--ponto") + 1 < len(argv):  # argparse lê "-22.0,-47.8" como opção
        i = argv.index("--ponto")
        argv[i:i + 2] = [f"--ponto={argv[i + 1]}"]
    a = ap.parse_args(argv)
    try:
        premissas = json.loads(a.premissas.read_text(encoding="utf-8")) if a.premissas else None
        premissas = juntar_premissas(premissas, apto_m2=a.apto_m2, comum_m2=a.comum_m2, laje_min_m2=a.laje_min_m2) or None
        r = estudar(a.base, a.indices, a.zona, a.pasta, premissas, ponto=a.ponto)
    except Exception as erro:  # a mensagem da etapa que falhou (novo_lote, motor ou relatório) vai inteira
        ap.exit(2, f"Erro: {erro}\n")
    print(r["resumo"], end="")
    print(f"-> {r['pasta']}")


if __name__ == "__main__":
    main()

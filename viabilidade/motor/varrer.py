"""Varredura de lotes de uma região (Motor, tarefa 20).

    python -I -X utf8 viabilidade/motor/varrer.py --base completo --ponto "lat, lon" --raio 300 --saida PASTA
        [--min-m2 400] [--apto-m2 N] [--comum-m2 N] [--laje-min-m2 N]

Pega os lotes do cadastro cujo centroide fica a até --raio metros (UTM) do ponto, roda estudar.estudar()
em cada um com --zona auto, no mesmo processo, e grava em PASTA:
  varredura.csv  uma linha por lote (recusa e erro entram com o motivo), ordenada pela maior área computável;
  RESUMO.md      os 10 melhores, as recusas e o aviso fixo;
  lotes/<índice>/  o que o estudar.py grava (lote, estudo, relatório, resumo) de cada lote estudado.
Mais de 500 lotes: erro (diminua o raio ou suba --min-m2). A pasta tem que não existir ou estar vazia.
"""
import argparse
import csv
import json
import re
import sys
from collections import Counter
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
import estudar  # noqa: E402  (põe terreno/ e relatorio/ no path)
import novo_lote  # noqa: E402

MAX_LOTES = 500
AVISO = ("Varredura automática: zona e áreas especiais sugeridas pela leitura do mapa, não conferidas. "
         "Não é lista de lotes à venda nem garantia de aprovação.")
COLUNAS = ["indice", "area_m2", "zona", "status", "motivo", "n_opcoes", "maior_area_computavel_m2", "maior_unidades",
           "areas_especiais_encontradas", "areas_especiais_nao_verificadas", "frente_presumida", "revisao", "estudo_json"]
ORIGEM = {"sugerida_pelo_mapa": "sugerida pelo mapa", "informada_pelo_usuario": "informada pelo usuário", "candidata_na_divisa": "candidata na divisa"}


def lotes_do_raio(cadastro, ponto, raio, min_m2=None):
    """Índices (ordem do cadastro) dos lotes com centroide a até `raio` m do ponto e área >= min_m2."""
    achados = cadastro.tree.query(ponto, predicate="dwithin", distance=raio)  # pré-filtro: borda do lote a até raio
    return sorted(int(i) for i in achados
                  if cadastro.geos[i].centroid.distance(ponto) <= raio and (min_m2 is None or cadastro.geos[i].area >= min_m2))


def _linha(cadastro, i, pasta, premissas, fn):
    """Linha do CSV de um lote. Recusa do terreno/motor e erro inesperado viram linha, nunca derrubam a varredura."""
    linha = dict.fromkeys(COLUNAS, "")
    linha.update(indice=i, area_m2=round(cadastro.geos[i].area, 1))
    destino = pasta / "lotes" / str(i)
    try:
        r = fn(cadastro.base, [i], "auto", destino, premissas, cadastro)
    except ValueError as erro:
        return {**linha, "status": "recusa", "motivo": " ".join(str(erro).split())}
    except Exception as erro:  # noqa: BLE001  (um lote ruim não pode matar as outras centenas)
        return {**linha, "status": "erro", "motivo": f"{type(erro).__name__}: {' '.join(str(erro).split())}"}
    if r.get("divisa"):  # uma linha só, sem números: cada candidata tem estudo próprio (ver resumo.txt da pasta)
        return {**linha, "status": "divisa", "zona": "divisa: " + " | ".join(r["divisa"]),
                "motivo": "lote na divisa entre zonas: confirmar a zona na Prefeitura; um estudo por candidata em " + f"lotes/{i}/zona-SC-Zx/",
                "estudo_json": f"lotes/{i}/resumo.txt"}
    revisao = r["revisao"]
    lote = json.loads((destino / "lote.json").read_text(encoding="utf-8"))
    estudo = json.loads((destino / "estudo.json").read_text(encoding="utf-8"))
    opcoes = estudo["opcoes"]
    ae = lote["areas_especiais"]
    linha.update(
        zona=f"{lote['zona_id']} ({ORIGEM[lote['zona_origem']]})", status="estudo",
        n_opcoes=len(opcoes),
        maior_area_computavel_m2=max((o["metricas"]["area_computavel_m2"] for o in opcoes), default=0),
        maior_unidades=max((o["metricas"]["unidades_estimadas"] for o in opcoes), default=0),
        areas_especiais_encontradas=sum(a["incidencia"] in estudar.INCIDENCIA for a in ae),  # mesmo critério do resumo.txt
        areas_especiais_nao_verificadas=sum(a["tipo"] == "nao_verificada" for a in ae),
        frente_presumida="sim" if any(t.startswith("Frente presumida") for t in estudo["incertezas"]) else "não",
        revisao=revisao,
        estudo_json=str((destino / "estudo.json").relative_to(pasta)).replace("\\", "/"))
    if not opcoes:
        linha["motivo"] = "estudado, mas nenhuma opção cabe (ver opcoes_ausentes no estudo.json)"
    return linha


def _ordem(l):
    estudado = l["status"] == "estudo"  # recusas e erros no fim, por índice; estudos pela maior área computável
    return (not estudado, -(l["maior_area_computavel_m2"] or 0) if estudado else 0, l["indice"])


def _resumo_md(linhas, ponto_txt, raio, min_m2, premissas):
    estudados = [l for l in linhas if l["status"] == "estudo"]
    com_opcao = [l for l in estudados if l["n_opcoes"]]
    fora = [l for l in linhas if l["status"] != "estudo"]
    out = ["# Varredura de lotes", "", f"> {AVISO}", "",
           f"Ponto {ponto_txt}, raio {raio:g} m" + (f", área mínima {min_m2:g} m²" if min_m2 else "") + f". "
           f"{len(linhas)} lotes: {len(estudados)} estudados ({len(com_opcao)} com alguma opção), {len(fora)} recusados ou com erro.",
           *(estudar._linha_premissas(premissas) if premissas else []), "", "## Os 10 melhores (maior área computável)", ""]
    if com_opcao:
        out += ["| # | Lote | Área do lote | Zona | Área computável | Unidades | Frente presumida | Estudo |", "|---|---|---|---|---|---|---|---|"]
        out += [f"| {n} | {l['indice']} | {l['area_m2']:g} m² | {l['zona']} | {l['maior_area_computavel_m2']:g} m² | {l['maior_unidades']} "
                f"| {l['frente_presumida']} | `{l['estudo_json']}` |" for n, l in enumerate(com_opcao[:10], 1)]
    else:
        out.append("Nenhum lote com opção que caiba.")
    out += ["", "## Recusados e erros", ""]
    if fora:
        # os números da mensagem (área, distância) mudam de lote para lote: agrupa pelo texto com eles trocados por N
        grupos = Counter((l["status"], re.sub(r"\d+(?:[.,]\d+)?", "N", l["motivo"])) for l in fora)
        exemplo = {}
        for l in fora:
            exemplo.setdefault((l["status"], re.sub(r"\d+(?:[.,]\d+)?", "N", l["motivo"])), l)
        out += [f"- {n} × {st}: {exemplo[(st, m)]['motivo']} (exemplo: lote {exemplo[(st, m)]['indice']})" for (st, m), n in grupos.most_common()]
    else:
        out.append("Nenhum.")
    return "\n".join(out) + "\n"


def varrer(base, ponto, raio, saida, min_m2=None, premissas=None, cadastro=None, estudar_fn=None, max_lotes=MAX_LOTES, ponto_txt=None):
    """Roda a varredura e devolve as linhas (já ordenadas). `estudar_fn` troca o estudar.estudar (testes)."""
    saida = Path(saida)
    estudar._conferir_pasta(saida)
    if not 0 < raio <= 5000:
        raise ValueError(f"--raio {raio:g} fora da faixa: de 1 a 5000 m.")
    xy = novo_lote.ler_ponto(ponto)
    cadastro = cadastro or novo_lote.Cadastro(base)
    indices = lotes_do_raio(cadastro, xy, raio, min_m2)
    if not indices:
        raise ValueError(f"Nenhum lote com centroide a até {raio:g} m do ponto" + (f" e área de {min_m2:g} m² ou mais." if min_m2 else "."))
    if len(indices) > max_lotes:
        raise ValueError(f"{len(indices)} lotes no raio de {raio:g} m; o limite é {max_lotes} por varredura. "
                         "Diminua o raio ou suba --min-m2.")
    fn = estudar_fn or estudar.estudar
    linhas = []
    for n, i in enumerate(indices, 1):
        linhas.append(_linha(cadastro, i, saida, premissas, fn))
        if n % 25 == 0:
            print(f"  {n}/{len(indices)} lotes", file=sys.stderr, flush=True)
    linhas.sort(key=_ordem)
    saida.mkdir(parents=True, exist_ok=True)
    with open(saida / "varredura.csv", "w", encoding="utf-8-sig", newline="") as f:  # BOM: o Excel abre com acento
        w = csv.DictWriter(f, COLUNAS)
        w.writeheader()
        w.writerows(linhas)
    (saida / "RESUMO.md").write_text(_resumo_md(linhas, ponto_txt or ponto, raio, min_m2, premissas), encoding="utf-8")
    return linhas


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base", required=True, choices=novo_lote.BASES)
    ap.add_argument("--ponto", required=True, help='"latitude, longitude" (WGS84, ponto decimal)')
    ap.add_argument("--raio", required=True, type=float, help="metros, de 1 a 5000")
    ap.add_argument("--saida", required=True, type=Path)
    ap.add_argument("--min-m2", type=float, help="só lotes com esta área ou mais")
    ap.add_argument("--apto-m2", type=float)
    ap.add_argument("--comum-m2", type=float)
    ap.add_argument("--laje-min-m2", type=float)
    argv = list(sys.argv[1:] if argv is None else argv)
    if "--ponto" in argv and argv.index("--ponto") + 1 < len(argv):  # argparse lê "-22.0,-47.8" como opção
        i = argv.index("--ponto")
        argv[i:i + 2] = [f"--ponto={argv[i + 1]}"]
    a = ap.parse_args(argv)
    try:
        premissas = estudar.juntar_premissas(None, apto_m2=a.apto_m2, comum_m2=a.comum_m2, laje_min_m2=a.laje_min_m2) or None
        linhas = varrer(a.base, a.ponto, a.raio, a.saida, a.min_m2, premissas)
    except Exception as erro:
        ap.exit(2, f"Erro: {erro}\n")
    print((a.saida / "RESUMO.md").read_text(encoding="utf-8"), end="")
    print(f"-> {a.saida}")


if __name__ == "__main__":
    main()

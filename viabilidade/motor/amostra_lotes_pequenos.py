"""Tarefa 16: por que lote pequeno dá poucas opções? Sorteia 40 lotes de 250 a 800 m² e, para cada opção ausente,
diz se a causa é a LEI/geometria ou a BUSCA do motor (a prova é a busca exaustiva fina de busca_fina.py).

    python -I -X utf8 viabilidade/motor/amostra_lotes_pequenos.py [SEMENTE] [SAIDA.json]
"""
import json
import random
import sys
from multiprocessing import Pool
from pathlib import Path

sys.dont_write_bytecode = True
AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
sys.path.insert(0, str(AQUI.parent / "terreno"))
import busca_fina  # noqa: E402
import motor  # noqa: E402
import novo_lote  # noqa: E402

SEMENTE = 20261115


def sortear(semente, n=40):
    cad = novo_lote.Cadastro("completo")
    cands = [i for i, g in enumerate(cad.geos) if g.is_valid and 250 <= g.area <= 800]
    random.Random(semente).shuffle(cands)
    lotes = []
    for i in cands:
        if len(lotes) == n:
            break
        try:
            lote, como = cad.gerar([i], "auto"), "auto"
        except ValueError as e:
            alt = (getattr(e, "sugestao", None) or {}).get("alternativas")
            if not alt:
                continue
            try:
                lote, como = cad.gerar([i], alt[0]), "sugestao"
            except ValueError:
                continue
        lote["_indice"], lote["_como"] = i, como
        lotes.append(lote)
    return lotes


def _teto(f, op):
    """Maior laje (m²) que a opção teria no melhor caso (1 pavimento), só pelos recuos: separa 'não cabe' de 'cabe, mas falha outra regra'."""
    pr = f.pr
    if op == "D":  # a torre fica sobre o embasamento de 2 pav.: a caixa é a do topo, dentro da do embasamento
        nb = pr["pavimentos_embasamento"]
        hb = motor._altura(pr, nb, True)
        r = motor._recuos_topo(f.ctx, nb + 1, hb + motor._altura(pr, 1, False))
        c = motor._para_local(f.caixas.legal(*r), f.ctx["origem"], f.ctx["u"]).intersection(f.topo(nb)[1])
    else:
        c = f.topo(1)[1]
    if c.is_empty:
        return 0.0
    if op == "B":
        l = motor.dois_quadrados(c, pr["afastamento_entre_torres_m"], pr["laje_torre_max_m2"])
        return l[0].area if len(l) == 2 else 0.0
    if op == "C":
        return motor._maior_lamina(c, f.ctx["zp"].get("taxa_ocupacao", 1) * f.A).area
    return motor.maior_retangulo(c, 1.0, pr["laje_torre_max_m2"]).area


def _causa(teto, pr):
    um_apto = pr["area_privativa_por_unidade_m2"] / pr["eficiencia"]  # laje que dá 60 m² privativos por andar
    um_apto = max(um_apto, pr["area_privativa_por_unidade_m2"] + pr["area_comum_por_pavimento_m2"])
    if teto < pr["laje_minima_m2"]:
        return f"laje<{pr['laje_minima_m2']:g}"
    if teto < um_apto:
        return f"laje<{um_apto:g}(sem apto)"
    return "outra regra"


def um_lote(lote):
    zonas = {z["id"]: z for z in novo_lote.gl.ler("viabilidade/lei/zonas.json")}
    z = zonas[lote["zona_id"]]
    e = motor.gerar_estudo(lote, z)
    ausentes = {a["id"]: a for a in e["opcoes_ausentes"]}
    f = busca_fina.Fina(lote, z)
    saida = {"indice": lote["_indice"], "zona": lote["zona_id"], "como": lote["_como"], "area": round(lote["area_m2"]),
             "tem": [o["id"] for o in e["opcoes"]], "ausentes": {}}
    for op, a in ausentes.items():
        achou = getattr(f, "opcao_" + op.lower())()
        saida["ausentes"][op] = {"motor": a["motivo"], "fina": achou,
                                 "motivo": "BUSCA" if achou else "lei",
                                 "causa": None if achou else _causa(_teto(f, op), f.pr), "teto": round(_teto(f, op), 1)}
    return saida


if __name__ == "__main__":
    semente = int(sys.argv[1]) if len(sys.argv) > 1 else SEMENTE
    lotes = sortear(semente)
    with Pool() as p:
        res = p.map(um_lote, lotes, chunksize=1)
    if len(sys.argv) > 2:
        Path(sys.argv[2]).write_text(json.dumps({"semente": semente, "lotes": res}, ensure_ascii=False, indent=1), encoding="utf-8")
    from collections import Counter
    c = Counter()
    for r in res:
        for op, a in r["ausentes"].items():
            c[(op, a["motivo"], a["causa"])] += 1
    print("semente", semente, "lotes", len(res), "| com 4 opções:", sum(1 for r in res if not r["ausentes"]))
    for k, v in sorted(c.items(), key=lambda kv: str(kv[0])):
        print(v, k)

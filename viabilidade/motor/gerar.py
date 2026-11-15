"""Gera estudo.json a partir de um Lote e uma Zona (formatos do viabilidade/README.md).

    python -I viabilidade/motor/gerar.py --lote LOTE.json --zona ZONA.json --saida estudo.json

LOTE.json / ZONA.json podem ser um objeto ou uma lista (aí use --lote-id / --zona-id;
sem id pega o primeiro; sem --zona-id usa o zona_id do lote).
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # -I não põe a pasta do script no path
from motor import gerar_estudo  # noqa: E402


def _pega(caminho, id_):
    with open(caminho, encoding="utf-8") as f:
        d = json.load(f)
    if isinstance(d, dict):
        return d
    if id_ is None:
        return d[0]
    for item in d:
        if item.get("id") == id_:
            return item
    sys.exit(f"id {id_!r} não está em {caminho}")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--lote", required=True)
    ap.add_argument("--zona", required=True)
    ap.add_argument("--saida", required=True)
    ap.add_argument("--lote-id")
    ap.add_argument("--zona-id")
    ap.add_argument("--premissas", help="JSON com premissas que trocam as do padrão")
    a = ap.parse_args(argv)

    lote = _pega(a.lote, a.lote_id)
    zona = _pega(a.zona, a.zona_id or lote.get("zona_id"))
    premissas = None
    if a.premissas:
        with open(a.premissas, encoding="utf-8") as f:
            premissas = json.load(f)
    estudo = gerar_estudo(lote, zona, premissas)
    with open(a.saida, "w", encoding="utf-8", newline="\n") as f:
        json.dump(estudo, f, ensure_ascii=False, indent=1)
        f.write("\n")
    for o in estudo["opcoes"]:
        m = o["metricas"]
        print(f"{o['id']} {o['nome']}: {m['pavimentos']} pav, CA {m['ca_usado']}, TO {m['to_usada']}, "
              f"{m['area_construida_m2']:.0f} m², ~{m['unidades_estimadas']} unid, {len(o['alertas'])} alertas")
    print(f"-> {a.saida}")


if __name__ == "__main__":
    main()

"""Refaz de uma vez os estudos dos lotes-piloto: exemplos/pilotos/<id>.json + tabela no terminal.

    python -I viabilidade/motor/gerar_pilotos.py

Cada lote usa a zona do próprio campo zona_id (lei/zonas.json). Premissas: as do padrão do motor.
"""
import json
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from motor import gerar_estudo  # noqa: E402

VIAB = os.path.join(AQUI, "..")
SAIDA = os.path.join(AQUI, "exemplos", "pilotos")


def _json(*partes):
    with open(os.path.join(VIAB, *partes), encoding="utf-8") as f:
        return json.load(f)


def melhor_opcao(estudo):
    """A de mais área privativa; empate fica com a de menos pavimentos."""
    return max(estudo["opcoes"], key=lambda o: (o["metricas"]["area_privativa_m2"], -o["metricas"]["pavimentos"]), default=None)


def main():
    zonas = {z["id"]: z for z in _json("lei", "zonas.json")}
    os.makedirs(SAIDA, exist_ok=True)
    print("lote | zona | melhor opção | unidades | CA usado | alertas")
    for lote in _json("terreno", "lotes-piloto.json"):
        estudo = gerar_estudo(lote, zonas[lote["zona_id"]])
        with open(os.path.join(SAIDA, lote["id"] + ".json"), "w", encoding="utf-8", newline="\n") as f:
            json.dump(estudo, f, ensure_ascii=False, indent=1)
            f.write("\n")
        o = melhor_opcao(estudo)
        if o is None:
            print(f"{lote['id']} | {lote['zona_id']} | nenhuma coube | - | - | -")
            continue
        m = o["metricas"]
        esp = sum(a.startswith("ÁREA ESPECIAL") for a in o["alertas"])
        print(f"{lote['id']} | {lote['zona_id']} | {o['id']} {o['nome']} | {m['unidades_estimadas']} | {m['ca_usado']:.2f} | "
              f"{len(o['alertas'])}" + (f" ({esp} de área especial)" if esp else ""))


if __name__ == "__main__":
    main()

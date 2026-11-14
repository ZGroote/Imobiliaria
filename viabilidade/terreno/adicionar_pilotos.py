"""Acrescenta os dois pilotos da tarefa 2 sem substituir os cinco originais.

python -I viabilidade/terreno/adicionar_pilotos.py
Depois reaplique zonas e relevo conforme LOTES.md.
"""
import json
from pathlib import Path
import runpy
import sys

sys.dont_write_bytecode = True
AQUI = Path(__file__).resolve().parent


def main():
    caminho = AQUI / "lotes-piloto.json"
    lotes = json.loads(caminho.read_text(encoding="utf-8"))
    por_id = {l["id"]: l for l in lotes}
    assert len(por_id) == len(lotes)
    for categoria in ("eixo", "z2"):
        novo = json.loads((AQUI / f"dados/novo-{categoria}.json").read_text(encoding="utf-8"))
        assert novo["categoria"] == categoria
        if novo["id"] in por_id:
            existente = por_id[novo["id"]]
            for campo in ("poligono_utm", "frente", "fonte", "categoria"):
                assert existente[campo] == novo[campo], "Piloto existente diverge da geometria revisada"
        else:
            lotes.append(novo)
            por_id[novo["id"]] = novo
    assert len(lotes) == 7
    runpy.run_path(str(AQUI / "gerar_lotes.py"))["checar"](lotes)
    temporario = caminho.with_suffix(".json.tmp")
    temporario.write_text(json.dumps(lotes, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    temporario.replace(caminho)
    print("OK: sete pilotos; originais e enriquecimentos existentes preservados.")


if __name__ == "__main__":
    main()

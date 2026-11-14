"""Aplica as anotações manuais dos anexos aos pilotos, preservando relevo e geometria.

python -I viabilidade/terreno/preparar_zonas.py
python -I viabilidade/terreno/preparar_zonas.py --testar
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

AQUI = Path(__file__).resolve().parent


def ler(caminho):
    return json.loads(caminho.read_text(encoding="utf-8"))


def preparar(lotes, anotacoes, zonas):
    por_id = {a["id"]: a for a in anotacoes}
    assert len(por_id) == len(anotacoes) == len(lotes)
    assert set(por_id) == {l["id"] for l in lotes}
    for lote in lotes:
        a = por_id[lote["id"]]
        digest = hashlib.sha256(json.dumps(lote["poligono_utm"], separators=(",", ":"), allow_nan=False).encode()).hexdigest()
        assert a["poligono_sha256"] == digest, "Geometria mudou: revisar anotação do mapa"
        assert a["zona_id"] in zonas and a["zona_origem"] == "anotada_a_mao"
        assert a["zona_conferida"] is False
        assert a["conferido"] is False and a["fontes"]
        assert isinstance(a["areas_especiais"], list)
        for especial in a["areas_especiais"]:
            assert especial["tipo"] and especial["fonte"]
            if especial.get("altura_max_m") is not None:
                assert math.isfinite(especial["altura_max_m"]) and especial["altura_max_m"] > 0
        lote.pop("zona_anotada_a_mao", None)
        for campo in ("zona_id", "zona_origem", "zona_conferida", "areas_especiais"):
            lote[campo] = a[campo]
        lote["anotacao_zoneamento"] = {k: v for k, v in a.items()
                                       if k not in ("id", "zona_id", "zona_origem", "zona_conferida", "areas_especiais")}
        lote["conferido"] = False
        lote["observacoes"] = lote["observacoes"].replace("Relevo e zona pendentes. ", "")
        aviso = "Zona anotada à mão nos anexos oficiais; conferir limites e restrições em ZONAS.md."
        if aviso not in lote["observacoes"]:
            lote["observacoes"] += " " + aviso
        limitacoes = a["limitacoes"]
        if isinstance(limitacoes, list):
            limitacoes = " ".join(limitacoes)
        if limitacoes and limitacoes not in lote["observacoes"]:
            lote["observacoes"] += " " + limitacoes
    return lotes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--testar", action="store_true")
    args = parser.parse_args()
    caminho = AQUI / "lotes-piloto.json"
    lotes = ler(caminho)
    anotacoes = ler(AQUI / "dados/anotacoes-zonas.json")
    zonas = {z["id"] for z in ler(AQUI.parent / "lei/zonas.json")}
    resultado = preparar(lotes, anotacoes, zonas)
    if args.testar:
        assert resultado == ler(caminho), "Anotações ainda não aplicadas ou saída divergente"
        print("OK: anotações, geometrias de referência, zonas e aplicação idempotente.")
        return
    temporario = caminho.with_suffix(".json.tmp")
    temporario.write_text(json.dumps(resultado, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    temporario.replace(caminho)
    print(f"Anotações manuais aplicadas aos {len(resultado)} pilotos.")


if __name__ == "__main__":
    main()

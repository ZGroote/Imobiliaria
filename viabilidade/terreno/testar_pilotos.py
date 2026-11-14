"""Verifica entrega v4 e preservação integral dos cinco pilotos da entrega 1.

python -I viabilidade/terreno/testar_pilotos.py
python -I viabilidade/terreno/testar_pilotos.py --reproduzir
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import runpy
import subprocess
import sys

sys.dont_write_bytecode = True
AQUI = Path(__file__).resolve().parent
# Objetos do commit 7f7dd15, sem o campo de origem de zona substituído no v4.
ORIGINAIS = {
    "SC-completo-30516": "292c94cd46e83bbd0702202b1e2173bf47f8515a3860f7ec8761c1d4c5e00a09",
    "SC-completo-37607": "a81b7ac676622186f0a22d8ad4e4e554b38446842326db5a3304ac122c528fee",
    "SC-completo-22426": "9cb631013fe065b9de1e01595acfe8ba188aee14acc9686d6873aefe4a0374ac",
    "SC-completo-22421": "bcd11ef5a43f2a9cfe7ba6bdc48ab567b91996ed685c51d6b9f6fd0685ef6cfb",
    "SC-completo-25297": "5707bc316289fd245925846d667c311d6bfd76d7a59de67d481fef60c5c69691",
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reproduzir", action="store_true")
    args = parser.parse_args()
    if args.reproduzir:
        caminhos = [AQUI / "lotes-piloto.json"] + [AQUI / "dados" / n for n in (
            "anotacoes-zonas.json", "relevo-pilotos.json", "novo-eixo.json", "novo-z2.json",
            "anotacao-eixo.json", "anotacao-z2.json", "eixo-contiguidade.json",
            "eixo-posicionamento.json", "z2-posicionamento.json")]
        antes = {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in caminhos}
        for script in ("dados/eixo-reproduzir.py", "dados/z2-reproduzir.py", "adicionar_pilotos.py",
                       "dados/zonas-anotar.py", "preparar_zonas.py", "preparar_relevo.py"):
            subprocess.run([sys.executable, "-I", str(AQUI / script)], cwd=AQUI.parent.parent, check=True)
        assert all(hashlib.sha256(p.read_bytes()).hexdigest() == h for p, h in antes.items()), "Reprodução alterou bytes da entrega"
        print("OK: reprodução completa preservou os bytes dos dez JSONs verificados.")
    ler = lambda p: json.loads(p.read_text(encoding="utf-8"))
    lotes = ler(AQUI / "lotes-piloto.json")
    assert len(lotes) == 7
    runpy.run_path(str(AQUI / "gerar_lotes.py"))["checar"](lotes)
    anotacoes = ler(AQUI / "dados/anotacoes-zonas.json")
    zonas = {z["id"] for z in ler(AQUI.parent / "lei/zonas.json")}
    preparar = runpy.run_path(str(AQUI / "preparar_zonas.py"))["preparar"]
    assert preparar(copy.deepcopy(lotes), anotacoes, zonas) == lotes
    relevo = {l["id"]: l for l in ler(AQUI / "dados/relevo-pilotos.json")["lotes"]}
    assert set(relevo) == {l["id"] for l in lotes}
    for lote in lotes:
        assert lote["relevo"] is not None
        assert all(relevo[lote["id"]][k] == v for k, v in lote["relevo"].items())
        assert all((AQUI / e).is_file() for e in lote["anotacao_zoneamento"]["evidencias"])
        if lote["id"] in ORIGINAIS:
            original = {k: v for k, v in lote.items() if k not in ("zona_origem", "zona_conferida")}
            digest = hashlib.sha256(json.dumps(original, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()
            assert digest == ORIGINAIS[lote["id"]], "Dado original alterado: " + lote["id"]
        else:
            assert lote["zona_id"] in ("SC-EIXO", "SC-Z2")
            assert not any(e["tipo"] in ("interesse_ambiental", "interesse_industrial_servicos") for e in lote["areas_especiais"])
    print("OK: sete pilotos v4, cinco originais preservados, relevo e evidências presentes.")


if __name__ == "__main__":
    main()

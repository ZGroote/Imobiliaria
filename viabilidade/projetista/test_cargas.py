"""python -I -B -X utf8 viabilidade/projetista/test_cargas.py"""
import copy
import functools
from pathlib import Path
import sys
import tempfile

sys.dont_write_bytecode = True
RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ))
from viabilidade.projetista.adaptador import estudo_para_site
from viabilidade.projetista.cargas import (AVISO, KN, KN_M2, PILHA_AUSENTE, PREMISSAS_PADRAO, cargas_validas,
                                           conferir_premissas, estimar, selar_cargas)
from viabilidade.projetista.editor import mover_divisa
from viabilidade.projetista.esquema import gravar, selar, serializar
from viabilidade.projetista.gerador import gerar_pavimento
from viabilidade.projetista.test_projetista import bom

P22421 = RAIZ/"viabilidade/motor/exemplos/pilotos/SC-completo-22421.json"
PROIBIDAS = ("pilar", "fundac", "fundaç", "capacidade", "sapata", "estaca", "tensao", "tensão", "combinac", "combinaç",
             "dimension", "sondagem", "admissivel", "admissível")


@functools.cache
def _gerada():
    e, site, regras = estudo_para_site(P22421)
    r = gerar_pavimento(site, regras, {"unidades": 6}, None, e)
    assert r["outcome"] == "gerado", r["outcome"]
    return r["revisoes"][0]


def gerada():
    return copy.deepcopy(_gerada())


def numeros(x, pai=None):
    """(número, dict onde está) de cada folha numérica."""
    if isinstance(x, dict):
        for v in x.values():
            yield from numeros(v, x)
    elif isinstance(x, list):
        for v in x:
            yield from numeros(v, pai)
    elif type(x) in (int, float):
        yield x, pai


def faixas(x):
    if isinstance(x, dict):
        if {"min", "central", "max"} <= x.keys():
            yield x
        for v in x.values():
            yield from faixas(v)
    elif isinstance(x, list):
        for v in x:
            yield from faixas(v)


def chaves(x):
    if isinstance(x, dict):
        return set(x) | set().union(*map(chaves, x.values()))
    if isinstance(x, list):
        return set().union(*map(chaves, x))
    return set()


def test_22421():
    c = estimar(gerada())
    assert len(c["pavimentos"]) == 1 and c["avisos"] == [PILHA_AUSENTE]
    for n, dono in numeros(c):
        assert dono is not None and dono.get("unidade") in (KN, KN_M2, "m²", "m"), (n, dono)
    fx = list(faixas(c))
    assert fx and all(f["min"] <= f["central"] <= f["max"] for f in fx)
    pav = c["pavimentos"][0]
    assert pav["g"]["min"] > 0 and pav["q"]["min"] > 0 and pav["total"]["unidade"] == KN
    assert {p["tipo"] for p in pav["parcelas"]} == {"g", "q"} and all(p["element_ids"] for p in pav["parcelas"])
    ids_q = {i for p in pav["parcelas"] if p["tipo"] == "q" for i in p["element_ids"]}
    rev = gerada()
    elementos = {x["id"] for f in rev["floor_plates"] for k in ("unit_placements", "shared_spaces", "cores") for x in f[k]}
    assert ids_q | {v["element_id"] for v in pav["sem_sobrecarga"]} == elementos  # nada sumiu
    assert all(p["verified"] is False and p["revisado_por"] is None for p in c["premissas"])
    assert cargas_validas(c, rev) == (True, "")
    print("   22421:", {k: round(pav["total_por_m2"][k], 2) for k in ("min", "central", "max")}, "kN/m²;",
          {k: round(c["total_torre"][k]) for k in ("min", "central", "max")}, "kN")


def tres_pavimentos():
    r = bom()
    base = r["floor_plates"][0]
    r["floor_plates"] = []
    for i in range(3):
        f = copy.deepcopy(base)
        f.update(id=f"andar_{i + 1}", z0_m=3.0 * i)
        for k in ("unit_placements", "shared_spaces", "cores"):
            for x in f[k]:
                x["id"] = f"{x['id']}_{i + 1}"
        r["floor_plates"].append(f)
    if i:  # o último pavimento sem corredor: pavimentos diferentes, cargas diferentes
        f["shared_spaces"] = []
    return selar(r)


def test_tres_pavimentos():
    c = estimar(tres_pavimentos())
    pavs = c["pavimentos"]
    assert [p["id"] for p in pavs] == ["andar_3", "andar_2", "andar_1"] and not c["avisos"]
    for k in ("min", "central", "max"):
        acc = [p["acumulado_do_topo"][k] for p in pavs]
        assert all(a < b for a, b in zip(acc, acc[1:])), acc
        assert abs(c["total_torre"][k] - sum(p["total"][k] for p in pavs)) <= 0.01
        assert abs(acc[-1] - c["total_torre"][k]) <= 0.01
    assert pavs[0]["total"]["central"] < pavs[1]["total"]["central"]  # topo sem corredor


def test_mover_divisa_invalida():
    rev = gerada()
    c = estimar(rev)
    filha, _ = mover_divisa(rev, "apto_03", "apto_04", 0.5)
    ok, motivo = cargas_validas(c, filha)
    assert not ok and "geometria mudou" in motivo, motivo
    mexida = copy.deepcopy(rev)
    mexida["floor_plates"][0]["outline_m"][0][0] += 0.05
    assert cargas_validas(c, mexida) == (False, "geometria mudou")
    assert cargas_validas(c, selar(mexida))[1] == "geometria mudou"
    adulterada = copy.deepcopy(c)
    adulterada["total_torre"]["max"] = 1.0
    assert cargas_validas(adulterada, rev) == (False, "selo")
    assert serializar(estimar(filha)) != serializar(c)


def test_verified_sem_revisor():
    ps = copy.deepcopy(list(PREMISSAS_PADRAO))
    ps[0]["verified"] = True
    assert any("revisado_por" in e for e in conferir_premissas(ps))
    try:
        estimar(gerada(), ps)
    except ValueError as e:
        assert "revisado_por" in str(e)
    else:
        raise AssertionError("verified true sem revisor passou")
    ps[0]["revisado_por"] = {"nome": "Fulana de Tal", "conselho": "CREA-SP", "registro": ""}
    assert conferir_premissas(ps)
    ps[0]["revisado_por"]["registro"] = "0000000000"
    assert not conferir_premissas(ps)
    # Premissa verificada mas mexida depois do selo: cargas_validas recusa.
    c = estimar(gerada(), ps)
    c["premissas"][0]["revisado_por"] = None
    assert cargas_validas(selar_cargas(c), gerada()) == (False, "premissas inválidas")
    ruim = copy.deepcopy(list(PREMISSAS_PADRAO))
    ruim[1]["valor"]["min"] = 99
    assert conferir_premissas(ruim)


def test_aviso_e_chaves_proibidas():
    for c in (estimar(gerada()), estimar(tres_pavimentos())):
        assert "não é carga na fundação" in c["aviso"] and c["aviso"] == AVISO
        ruins = [k for k in chaves(c) if any(p in k.lower() for p in PROIBIDAS)]
        assert not ruins, ruins


def test_mesmos_bytes():
    a, b = estimar(gerada()), estimar(gerada())
    assert serializar(a) == serializar(b)
    with tempfile.TemporaryDirectory() as d:
        for _ in range(2):
            gravar(Path(d)/"cargas.json", a, selador=selar_cargas)
        assert (Path(d)/"cargas.json").read_bytes() == serializar(a)


def main():
    testes = [(nome, fn) for nome, fn in globals().items() if nome.startswith("test_") and callable(fn)]
    for nome, fn in testes:
        fn()
        print("OK", nome)
    print(f"{len(testes)} testes passaram.")


if __name__ == "__main__":
    main()

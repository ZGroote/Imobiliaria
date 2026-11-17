"""Testes do editor manual (só assert). Rodar: python -I -X utf8 viabilidade/projetista/test_editor.py"""
import copy
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ))
from shapely.geometry import Polygon

from viabilidade.projetista.adaptador import estudo_para_site
from viabilidade.projetista.editor import (EdicaoRecusada, cadeia, dividir_unidade, juntar_unidades, mover_divisa,
                                           renomear)
from viabilidade.projetista.esquema import selar, serializar
from viabilidade.projetista.gerador import gerar_pavimento
from viabilidade.projetista.sintese import avaliacao_valida, avaliar
from viabilidade.projetista.validador import _posicionar

P22421 = RAIZ / "viabilidade" / "motor" / "exemplos" / "pilotos" / "SC-completo-22421.json"
_cache = {}


def base():
    if "r" not in _cache:
        e, site, regras = estudo_para_site(P22421)
        r = gerar_pavimento(site, regras, {"unidades": 6}, None, e)
        assert r["outcome"] == "gerado", r["outcome"]
        _cache["r"] = r["revisoes"][0]
    return copy.deepcopy(_cache["r"])


def unidades(rev):
    """{id: polígono posicionado} de todas as unidades."""
    tp = {t["id"]: Polygon(t["outline_m"]) for t in rev["unit_types"]}
    return {p["id"]: _posicionar(tp[p["unit_type_id"]], p) for f in rev["floor_plates"] for p in f["unit_placements"]}


def soma(rev, ids=None):
    return sum(g.area for i, g in unidades(rev).items() if ids is None or i in ids)


def recusa(f, *a, **k):
    try:
        f(*a, **k)
    except EdicaoRecusada as e:
        assert e.motivos, "recusa sem motivo"
        return " | ".join(e.motivos)
    raise AssertionError("devia recusar")


def sequencia():
    r0 = base()
    r1, _ = mover_divisa(r0, "apto_03", "apto_04", 0.5)
    r2, _ = renomear(r1, "apto_03", "Cobertura")
    r3, _ = juntar_unidades(r2, "apto_05", "apto_06")
    r4, _ = dividir_unidade(r3, "apto_05+apto_06", 0.5)
    return [r0, r1, r2, r3, r4]


def test_mover_divisa_conserva_area_e_pai():
    pai = base()
    antes = serializar(pai)
    filha, achados = mover_divisa(pai, "apto_03", "apto_04", 0.50)
    assert serializar(pai) == antes, "o pai foi alterado"
    assert filha["parent_revision_id"] == pai["revision_id"] and filha["revision_id"] != pai["revision_id"]
    assert filha["content_sha256"] == selar(filha)["content_sha256"]
    assert abs(soma(filha, {"apto_03", "apto_04"}) - soma(pai, {"apto_03", "apto_04"})) <= 0.01
    assert abs(soma(filha) - soma(pai)) <= 0.01
    a, b = unidades(filha)["apto_03"].area, unidades(pai)["apto_03"].area
    assert a > b + 2, "a unidade A devia crescer cerca de 0,5 x 9,95 m²"
    assert not any(x["status"] in ("violacao", "erro_tecnico") for x in achados)


def test_mover_de_volta_mesma_geometria_outro_id():
    pai = base()
    filha, _ = mover_divisa(pai, "apto_03", "apto_04", 0.50)
    neta, _ = mover_divisa(filha, "apto_03", "apto_04", -0.50)
    assert neta["revision_id"] not in (pai["revision_id"], filha["revision_id"])
    assert neta["parent_revision_id"] == filha["revision_id"]
    g0, g2 = unidades(pai), unidades(neta)
    assert g0.keys() == g2.keys()
    assert all(g0[i].symmetric_difference(g2[i]).area < 0.005 for i in g0), "a geometria não voltou"
    assert abs(neta["floor_plates"][0]["residuals_m2"] - pai["floor_plates"][0]["residuals_m2"]) <= 0.001


def test_juntar_e_dividir():
    pai = base()
    par = {"apto_03", "apto_04"}
    junta, _ = juntar_unidades(pai, "apto_03", "apto_04")
    ids = {i for i in unidades(junta)}
    assert len(ids) == 5 and "apto_03+apto_04" in ids and not par & ids
    assert abs(soma(junta, {"apto_03+apto_04"}) - soma(pai, par)) <= 0.01
    dividida, _ = dividir_unidade(junta, "apto_03+apto_04", 0.5)
    novos = {"apto_03+apto_04.1", "apto_03+apto_04.2"}
    assert novos <= set(unidades(dividida)) and len(unidades(dividida)) == 6
    assert abs(soma(dividida, novos) - soma(pai, par)) <= 0.01
    g = unidades(dividida)
    assert abs(g["apto_03+apto_04.1"].area - g["apto_03+apto_04.2"].area) <= 0.01
    assert dividida["parent_revision_id"] == junta["revision_id"]


def test_recusas_com_motivo():
    pai = base()
    # B ficaria com 0,45 m de largura: abaixo do lado mínimo
    assert "dimensao" in recusa(mover_divisa, pai, "apto_03", "apto_04", 5.0)
    # B ficaria com 3,45 x 9,95 = 34 m²: lado ok, área abaixo dos 45 m² da premissa
    assert "area_minima" in recusa(mover_divisa, pai, "apto_03", "apto_04", 2.0)
    assert "zera" in recusa(mover_divisa, pai, "apto_03", "apto_04", 5.45)
    # entrada inválida
    assert "inexistente" in recusa(mover_divisa, pai, "apto_03", "apto_99", 0.5)
    assert "não são vizinhas" in recusa(mover_divisa, pai, "apto_01", "apto_04", 0.5)
    assert "inexistente" in recusa(dividir_unidade, pai, "apto_99", 0.5)
    for frac in (0, 1, -0.2, 1.5, float("nan")):
        assert "frac" in recusa(dividir_unidade, pai, "apto_03", frac)
    assert "delta" in recusa(mover_divisa, pai, "apto_03", "apto_04", 0)
    assert "inexistente" in recusa(renomear, pai, "nada", "x")
    # pai não foi tocado pelas recusas
    assert serializar(pai) == serializar(base())


def test_forcar_marca_rascunho_com_violacao():
    pai = base()
    filha, achados = mover_divisa(pai, "apto_03", "apto_04", 2.0, forcar=True)
    e = filha["metrics_summary"]["edicao"]
    assert filha["status"] == "RASCUNHO" and e["forcada"] is True and e["violacoes"]
    assert "arquitetura.area_minima_unidade" in e["violacoes"]
    assert cadeia([pai, filha])


def test_renomear_so_o_rotulo():
    pai = base()
    filha, _ = renomear(pai, "tipo_02", "Dois quartos")
    assert next(t for t in filha["unit_types"] if t["id"] == "tipo_02")["name"] == "Dois quartos"
    assert filha["revision_id"] != pai["revision_id"]
    a, b = copy.deepcopy(filha), copy.deepcopy(pai)
    for r in (a, b):
        for k in ("revision_id", "parent_revision_id", "content_sha256", "metrics_summary"):
            r.pop(k)
        for t in r["unit_types"]:
            t.pop("name")
    assert serializar(a) == serializar(b), "renomear mexeu em algo além do rótulo"


def test_cadeia_de_quatro_edicoes():
    rs = sequencia()
    assert len(rs) == 5 and cadeia(rs)
    for i in range(1, 5):
        assert rs[i]["parent_revision_id"] == rs[i - 1]["revision_id"]
    # adulterar o conteúdo da do meio sem re-selar: o selo não bate
    ruim = copy.deepcopy(rs)
    ruim[2]["floor_plates"][0]["residuals_m2"] += 1
    try:
        cadeia(ruim)
        raise AssertionError("devia dar erro")
    except ValueError as e:
        assert "revisão 2" in str(e) and "selo" in str(e)
    # adulterar e re-selar: o selo bate, mas a seguinte não deriva mais dela
    ruim = copy.deepcopy(rs)
    ruim[2]["floor_plates"][0]["residuals_m2"] += 1
    ruim[2] = selar(ruim[2])
    try:
        cadeia(ruim)
        raise AssertionError("devia dar erro")
    except ValueError as e:
        assert "revisão 3" in str(e)
    # elo fora de ordem
    try:
        cadeia([rs[0], rs[2]])
        raise AssertionError("devia dar erro")
    except ValueError as e:
        assert "parent_revision_id" in str(e)


def test_avaliacao_do_pai_nao_vale_para_a_filha():
    pai = base()
    filha, _ = mover_divisa(pai, "apto_03", "apto_04", 0.50)
    av = avaliar(pai)
    assert avaliacao_valida(av, pai)[0] is True
    ok, motivo = avaliacao_valida(av, filha)
    assert ok is False and motivo in ("outra revisão", "geometria mudou"), motivo


def test_mesma_sequencia_mesmos_bytes():
    a, b = sequencia(), sequencia()
    assert [serializar(x) for x in a] == [serializar(x) for x in b]
    assert len({x["revision_id"] for x in a}) == 5


def test_suites_anteriores():
    for t in ("test_projetista.py", "test_gerador.py", "test_para_vista.py"):
        r = subprocess.run([sys.executable, "-I", "-X", "utf8", str(Path(__file__).with_name(t))],
                           capture_output=True, text=True, encoding="utf-8")
        assert r.returncode == 0, t + "\n" + r.stdout[-800:] + r.stderr[-800:]


def main():
    for nome, f in sorted(globals().items()):
        if nome.startswith("test_") and callable(f):
            f()
            print("ok", nome)
    print("todos os testes do editor passaram")


if __name__ == "__main__":
    main()

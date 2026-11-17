"""Testes da torre (só assert). Rodar: python -I -X utf8 viabilidade/projetista/test_torre.py"""
import copy
import json
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ))
from shapely.geometry import Polygon
from shapely.ops import unary_union

from viabilidade.projetista.editor import EdicaoRecusada, cadeia, mover_divisa
from viabilidade.projetista.esquema import selar, serializar
from viabilidade.projetista.para_vista import revisao_para_estudo
from viabilidade.projetista.sintese import avaliacao_valida, avaliar
from viabilidade.projetista.test_editor import P22421, base
from viabilidade.projetista.torre import _sem_cruzar, compor
from viabilidade.projetista.validador import _posicionar, validar


def unidades_por_andar(t):
    return [len(f["unit_placements"]) for f in t["floor_plates"]]


def test_numeros_do_22421():
    pai = base()
    t = compor(pai)
    assert [f["id"] for f in t["floor_plates"]] == ["andar_01", "andar_02"]
    assert unidades_por_andar(t) == [6, 6]
    T = t["metrics_summary"]["torre"]
    assert T["unidades"] == {"valor": 12, "unidade": "unidades"} and T["vagas"]["valor"] is None
    assert T["pavimentos"]["valor"] == 2 and T["altura_total"] == {"valor": 6.0, "unidade": "m"}
    assert T["privativa_total"]["unidade"] == "m²" and T["computavel_total"]["valor"] > T["privativa_total"]["valor"]

    c = compor(pai, terreo=True)
    assert [f["id"] for f in c["floor_plates"]] == ["terreo", "andar_01"]
    assert unidades_por_andar(c) == [0, 6]
    assert [(f["z0_m"], f["height_m"]) for f in c["floor_plates"]] == [(0, 3), (3, 3)]
    T = c["metrics_summary"]["torre"]
    assert T["unidades"]["valor"] == 6 and T["vagas"]["valor"] == 12 and T["pavimentos"]["valor"] == 2
    assert T["andares_tipo"]["valor"] == 1
    # pedir andares demais é erro claro, e pedir menos corta
    try:
        compor(pai, pavimentos=3)
        assert False
    except EdicaoRecusada as e:
        assert "não cabem 3" in str(e)
    assert unidades_por_andar(compor(pai, pavimentos=1)) == [6]


def _envelope_que_encolhe(pai):
    """Faixa 0–6 m igual à original; faixa 6–9 m só abrange núcleo, circulação e 4 das 6 unidades; teto em 9 m."""
    fp = pai["floor_plates"][0]
    tp = {t["id"]: Polygon(t["outline_m"]) for t in pai["unit_types"]}
    manter = [_posicionar(tp[p["unit_type_id"]], p) for p in fp["unit_placements"][:4]]
    manter += [Polygon(e["polygon_m"]) for e in fp["shared_spaces"] + fp["cores"]]
    estreita = unary_union(manter).buffer(0.3, join_style="mitre").simplify(0.01)
    assert estreita.geom_type == "Polygon"
    sintetica = copy.deepcopy(pai)
    f0 = copy.deepcopy(pai["site"]["envelope_by_height"][0])
    sintetica["site"]["envelope_by_height"] = [
        {**f0, "z0_m": 0, "z1_m": 6},
        {"z0_m": 6, "z1_m": 9, "polygon_m": [[x, y] for x, y in estreita.exterior.coords][:-1]}]
    return selar(sintetica)


def test_escalonamento_perde_unidade_e_depois_some():
    pai = _envelope_que_encolhe(base())
    t = compor(pai)  # sem limite: vai até onde der
    ids = [f["id"] for f in t["floor_plates"]]
    assert ids == ["andar_01", "andar_02", "andar_03"], ids  # o 4º (9 a 12 m, acima do teto) sumiu
    assert unidades_por_andar(t) == [6, 6, 4]  # o 3º perdeu 2 unidades em vez de sumir
    a2, a3 = t["floor_plates"][1], t["floor_plates"][2]
    assert a3["id"] != a2["id"] and a3["outline_m"] != a2["outline_m"]  # pavimento próprio, não cópia marcada
    assert Polygon(a3["outline_m"]).area < Polygon(a2["outline_m"]).area
    assert (a3["z0_m"], a3["height_m"]) == (6, 3)
    assert t["metrics_summary"]["torre"]["unidades"]["valor"] == 16
    # as unidades que ficaram são as 4 que cabiam; as outras não aparecem em andar nenhum acima
    assert {p["id"].replace("_andar_03", "") for p in a3["unit_placements"]} == {"apto_01", "apto_02", "apto_03", "apto_04"}
    # o validador confere a torre inteira e não acha violação
    assert [a for a in validar(t, t["site"], t["rules_ref"]) if a["status"] == "violacao"] == []


def test_filha_da_revisao_de_um_pavimento_e_cadeia():
    pai = base()
    t = compor(pai, terreo=True)
    assert t["parent_revision_id"] == pai["revision_id"] and t["revision_id"] != pai["revision_id"]
    assert len(pai["floor_plates"]) == 1  # a entrada não muda
    assert cadeia([pai, t])
    assert selar(t)["content_sha256"] == t["content_sha256"]
    # a torre de um estudo editado também encadeia
    filha, _ = mover_divisa(pai, "apto_03", "apto_04", 0.50)
    assert cadeia([pai, filha, compor(filha)])
    # e não se compõe sobre torre
    try:
        compor(t)
        assert False
    except EdicaoRecusada as e:
        assert "já é uma torre" in str(e)


def test_editar_o_pai_da_outra_torre():
    pai = base()
    t1 = compor(pai, terreo=True)
    filha, _ = mover_divisa(pai, "apto_03", "apto_04", 0.50)
    t2 = compor(filha, terreo=True)
    assert t2["revision_id"] != t1["revision_id"] and t2["content_sha256"] != t1["content_sha256"]
    assert t2["parent_revision_id"] == filha["revision_id"]
    av = avaliar(t1)
    assert avaliacao_valida(av, t1)[0] is True
    ok, motivo = avaliacao_valida(av, t2)
    assert ok is False and motivo in ("outra revisão", "geometria mudou"), motivo


def test_mesmos_bytes_em_duas_rodadas():
    for kw in ({}, {"terreo": True}):
        assert serializar(compor(base(), **kw)) == serializar(compor(base(), **kw))


def _volumes(estudo):
    return {v["id"]: v for o in estudo["opcoes"] if o["id"] == "projetista" for v in o["volumes"]}, \
           [o for o in estudo["opcoes"] if o["id"] == "projetista"][0]


def test_previa_da_torre_igual_a_de_hoje():
    pai = base()
    for kw in ({}, {"terreo": True}):
        antiga, oa = _volumes(revisao_para_estudo(pai, P22421, **kw))
        nova, on = _volumes(revisao_para_estudo(compor(pai, **kw), P22421))
        assert list(antiga) == list(nova)  # mesmos volumes, mesma ordem
        for k, v in antiga.items():
            w = nova[k]
            assert {a: b for a, b in v.items() if a != "base_utm"} == {a: b for a, b in w.items() if a != "base_utm"}, k
            # a torre guarda a geometria em 4 casas locais; a prévia antiga desenhava a exata: até 1 mm de diferença
            dif = max(abs(a - b) for p, q in zip(v["base_utm"], w["base_utm"]) for a, b in zip(p, q))
            assert len(v["base_utm"]) == len(w["base_utm"]) and dif < 0.001, (k, dif)
        assert oa["metricas"] == on["metricas"]
        assert on["fonte"]["revision_id"] != oa["fonte"]["revision_id"]  # a fonte é a torre, de propósito
    # a prévia não recalcula: pedir térreo ou pavimentos sobre torre é erro
    try:
        revisao_para_estudo(compor(pai), P22421, terreo=True)
        assert False
    except ValueError as e:
        assert "já tem a torre" in str(e)


# garagem do piloto q1382: um vértice cai em cima da própria borda; arredondada a 4 casas, o contorno se cruza
GARAGEM_ENCOSTADA = [(-6.5237, 4.2367), (-9.0072, 20.2458), (22.8157, 25.1826), (25.2992, 9.1735), (8.695177, 6.597659),
                     (7.468846, 14.502882), (7.468826, 14.502879), (6.870858, 18.356769), (-1.528108, 17.053686),
                     (-0.807704, 12.410699), (-0.010478, 7.271433), (-0.010448, 7.271437), (0.296208, 5.294697),
                     (5.594126, 6.116582)]


def _arredondado(g):
    return Polygon([(round(x, 4), round(y, 4)) for x, y in g.exterior.coords])


def test_contorno_que_encosta_na_propria_borda():
    g = Polygon(GARAGEM_ENCOSTADA)
    assert g.is_valid and not _arredondado(g).is_valid  # o defeito de verdade
    partes = _sem_cruzar(g)
    assert partes and all(_arredondado(q).is_valid and q.area > 1e-3 for q in partes)
    assert abs(sum(q.area for q in partes) - g.area) < 0.01  # só some a lasca do encosto (~0,2 cm²)
    ok = Polygon([(0, 0), (4, 0), (4, 3), (0, 3)])
    assert _sem_cruzar(ok) == [ok]  # quem já era válido passa intacto
    # de ponta a ponta, no piloto q1382: o térreo sai e nenhum contorno se cruza depois do selo
    from viabilidade.projetista.adaptador import estudo_para_site
    from viabilidade.projetista.gerador import gerar_pavimento
    est, site, regras = estudo_para_site(RAIZ / "viabilidade/motor/exemplos/pilotos/SC-completo-q1382-11984-11988.json")
    rev = gerar_pavimento(site, regras, {"unidades": 6}, None, est)["revisoes"][0]
    t = compor(rev, terreo=True)
    terreo = t["floor_plates"][0]
    assert terreo["id"] == "terreo" and any(e["kind"] == "garagem" for e in terreo["shared_spaces"])
    for e in terreo["shared_spaces"] + terreo["cores"]:
        assert Polygon(e["polygon_m"]).is_valid, e["id"]
    assert t["metrics_summary"]["torre"]["vagas"]["valor"] > 0


def test_suites_anteriores():
    for t in ("test_projetista.py", "test_gerador.py", "test_para_vista.py", "test_editor.py", "test_sintese.py"):
        r = subprocess.run([sys.executable, "-I", "-X", "utf8", str(Path(__file__).with_name(t))],
                           capture_output=True, text=True, encoding="utf-8")
        assert r.returncode == 0, t + "\n" + r.stdout[-800:] + r.stderr[-800:]


def main():
    for nome, f in sorted(globals().items()):
        if nome.startswith("test_") and callable(f):
            f()
            print("ok", nome)
    print("todos os testes da torre passaram")


if __name__ == "__main__":
    main()

"""python -I -B -X utf8 viabilidade/projetista/test_projetista.py"""
import copy
import hashlib
import json
from pathlib import Path
import sys
import tempfile
from unittest.mock import patch

sys.dont_write_bytecode = True
RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ))
from shapely.geometry import Polygon
from viabilidade.projetista.adaptador import estudo_para_site
from viabilidade.projetista.esquema import SCHEMA_VERSION, TOLERANCIAS, gravar, ler, selar, serializar
from viabilidade.projetista.validador import medir_areas, validar, _trecho


def ret(x, y, w, h):
    return [[x, y], [x+w, y], [x+w, y+h], [x, y+h]]


def estudo():
    return {"versao_motor": "sintetico-1", "lote": {"id": "lote_teste", "crs": "EPSG:31983",
            "poligono_utm": ret(200000, 7500000, 40, 30), "frente": [[200000, 7500000], [200040, 7500000]],
            "zona_id": "zona_teste", "zona_conferida": True},
            "zona": {"id": "zona_teste", "conferido": True, "parametros": {}, "fontes": []},
            "caixa_maxima": {"altura_m": 6, "projecao_utm": ret(200000, 7500000, 40, 30), "degraus": []}}


def bom():
    study, site, rules = estudo_para_site(estudo())
    site["envelope_by_height"] = [{"z0_m": 0, "z1_m": 6, "polygon_m": ret(-1, -1, 32, 16)}]
    rules["params"]["unit_min_side_m"] = 3.0
    for rule in ("norma.envelope", "dimensao", "areas.privativa", "areas.computavel"):
        rules["sources"][rule] = {"reference": "Fixture sintética conferida, não é fonte legal", "verified": True,
                                  "kind": "premissa" if rule == "dimensao" else "norma"}
    tipos, placements = [], []
    for row in range(2):
        for col in range(3):
            id_ = f"tipo_{row}_{col}"
            tipos.append({"id": id_, "name": id_, "version": "1", "outline_m": ret(0, 0, 10, 6),
                          "thickness_m": {"interna": .15, "externa": .20, "divisa": .20},
                          "edge_kinds": ["externa" if row == 0 else "divisa", "externa" if col == 2 else "divisa",
                                         "externa" if row == 1 else "divisa", "externa" if col == 0 else "divisa"],
                          "balcony_m2": 0, "metrics": {}})
            placements.append({"id": f"apto_{row}_{col}", "unit_type_id": id_, "x": col*10, "y": row*8,
                               "rot_deg": 0, "mirror": False})
    return {"schema_version": SCHEMA_VERSION, "unit": "m", "revision_id": "rev_1", "parent_revision_id": None,
            "content_sha256": "", "study_ref": study, "site": site, "rules_ref": rules,
            "status": "RASCUNHO", "tolerances": dict(TOLERANCIAS), "unit_types": tipos,
            "floor_plates": [{"id": "andar_1", "name": "Tipo", "outline_m": ret(0, 0, 30, 14),
                              "z0_m": 0, "height_m": 3, "unit_placements": placements,
                              "shared_spaces": [{"id": "corredor", "kind": "corredor", "polygon_m": ret(0, 6, 28, 2), "computable": True}],
                              "cores": [{"id": "nucleo", "kind": "escada", "polygon_m": ret(28, 6, 2, 2), "computable": False}],
                              "residuals_m2": 0}], "metrics_summary": {}}


def achados(r):
    antes = copy.deepcopy(r)
    out = validar(r, r["site"], r["rules_ref"])
    assert r == antes, "Validador alterou a revisão"
    for f in out:
        assert set(("rule_id", "status", "measured", "limit", "unit", "element_ids", "source", "diff")) <= f.keys()
        assert f["status"] in ("conforme", "violacao", "nao_verificado", "erro_tecnico")
    return out


def encontrar(out, rule, status, id_):
    encontrados = [f for f in out if f["rule_id"] == rule and f["status"] == status and id_ in f["element_ids"]]
    assert encontrados, (rule, status, id_, out)
    return encontrados[0]


def recusa(fn, tipo=ValueError):
    try:
        fn()
    except tipo:
        return
    raise AssertionError("Entrada deveria ter sido recusada")


def test_pavimento_bom():
    r = bom()
    out = achados(r)
    assert not [f for f in out if f["status"] in ("violacao", "erro_tecnico")], out
    assert sum(f["rule_id"] == "acesso" and f["status"] == "conforme" for f in out) == 6
    encontrar(out, "balanco", "conforme", "andar_1")
    encontrar(out, "areas.util", "nao_verificado", "andar_1")
    assert achados(r) == out


def test_poligonos_invalidos():
    for grupo, chave, id_ in (("unit_types", "outline_m", "tipo_0_0"), ("floor_plates", "outline_m", "andar_1")):
        r = bom()
        r[grupo][0][chave] = [[0, 0], [10, 6], [10, 0], [0, 6]]
        encontrar(achados(r), "geometria.poligono", "violacao", id_)
    for collection, id_ in (("shared_spaces", "corredor"), ("cores", "nucleo")):
        r = bom()
        r["floor_plates"][0][collection][0]["polygon_m"] = [[0, 0], [2, 2], [0, 2], [2, 0]]
        encontrar(achados(r), "geometria.poligono", "violacao", id_)
    r = bom()
    r["unit_types"][0]["outline_m"][1] = [0, 0]
    encontrar(achados(r), "areas.faces", "violacao", "tipo_0_0")


def test_elementos_fora_do_envelope():
    for collection, id_ in (("unit_placements", "apto_0_0"), ("shared_spaces", "corredor"), ("cores", "nucleo")):
        r = bom()
        e = r["floor_plates"][0][collection][0]
        if collection == "unit_placements":
            e["x"] = 100
        else:
            e["polygon_m"] = ret(100, 100, 2, 2)
        encontrar(achados(r), "geometria.envelope", "violacao", id_)
        encontrar(achados(r), "geometria.laje", "violacao", id_)


def test_altura_e_degrau():
    r = bom()
    r["site"]["envelope_by_height"] = [
        {"z0_m": 0, "z1_m": 2, "polygon_m": ret(-1, -1, 32, 16)},
        {"z0_m": 2, "z1_m": 6, "polygon_m": ret(-1, -1, 16, 16)}]
    encontrar(achados(r), "geometria.envelope", "violacao", "apto_0_2")
    r["floor_plates"][0]["height_m"] = 2
    assert not [f for f in achados(r) if f["status"] in ("violacao", "erro_tecnico")]
    r["floor_plates"][0]["z0_m"] = 7
    encontrar(achados(r), "geometria.envelope", "violacao", "andar_1")


def test_envelope_vazio_invalido_e_lacuna():
    r = bom()
    r["site"]["envelope_by_height"][0]["polygon_m"] = []
    encontrar(achados(r), "geometria.envelope", "violacao", "andar_1")
    r["site"]["envelope_by_height"][0]["polygon_m"] = [[0, 0], [10, 10], [10, 0], [0, 10]]
    encontrar(achados(r), "geometria.envelope", "erro_tecnico", "andar_1")
    r = bom()
    r["site"]["envelope_by_height"][0]["z0_m"] = 1
    encontrar(achados(r), "contrato", "erro_tecnico", "rev_1")


def test_sobreposicoes():
    for collection, id_ in (("unit_placements", "apto_0_1"), ("shared_spaces", "corredor"), ("cores", "nucleo")):
        r = bom()
        if collection == "unit_placements":
            r["floor_plates"][0][collection][1]["x"] = 9
        else:
            r["floor_plates"][0][collection][0]["polygon_m"] = ret(1, 1, 2, 2)
        f = encontrar(achados(r), "geometria.sobreposicao", "violacao", id_)
        assert "apto_0_0" in f["element_ids"]


def test_balanco_e_residuo():
    r = bom()
    r["floor_plates"][0]["residuals_m2"] = 1
    out = achados(r)
    encontrar(out, "balanco", "violacao", "andar_1")
    encontrar(out, "balanco.residuo", "violacao", "andar_1")
    r["floor_plates"][0]["residuals_m2"] = .005
    encontrar(achados(r), "balanco", "conforme", "andar_1")
    r = bom()
    r["floor_plates"][0]["unit_placements"].pop()
    r["floor_plates"][0]["residuals_m2"] = 60
    encontrar(achados(r), "balanco.residuo", "conforme", "andar_1")


def test_acesso_e_fachada():
    r = bom()
    r["floor_plates"][0]["shared_spaces"][0]["polygon_m"] = ret(9.5, 6, 18.5, 2)
    f = encontrar(achados(r), "acesso", "violacao", "apto_0_0")
    assert abs(f["measured"] - .5) < 1e-8 and f["limit"] == .8
    r = bom()
    r["floor_plates"][0]["outline_m"] = ret(-1, -1, 32, 16)
    encontrar(achados(r), "fachada", "violacao", "apto_0_0")
    r = bom()
    r["rules_ref"]["params"]["facade_min_m"] = 11
    encontrar(achados(r), "fachada", "violacao", "apto_0_1")


def test_contato_nao_soma_trechos_ou_cantos():
    from shapely.geometry import LineString, MultiLineString
    a = LineString([(0, 0), (10, 0)])
    b = MultiLineString([[(0, 0), (.5, 0)], [(2, 0), (2.5, 0)]])
    assert _trecho(a, b, .001) == .5
    canto = LineString([(0, .5), (0, 0), (.5, 0)])
    assert _trecho(canto, canto, .001) == .5
    assert _trecho(a, LineString([(0, 0), (0, 2)]), .001) == 0


def test_dimensao_e_parametro_ausente():
    r = bom()
    r["unit_types"][0]["outline_m"] = ret(0, 0, 2.5, 6)
    encontrar(achados(r), "dimensao", "violacao", "apto_0_0")
    r = bom()
    r["rules_ref"]["params"].pop("unit_min_side_m")
    encontrar(achados(r), "dimensao", "nao_verificado", "apto_0_0")


def test_faces_areas_e_compartilhamento():
    r = bom()
    a, b = r["unit_types"][:2]
    ma, mb = medir_areas(a), medir_areas(b)
    assert abs(ma["privativa_m2"] - 10.1*6.1) < 1e-8
    assert abs(mb["privativa_m2"] - 10*6.1) < 1e-8
    assert abs(ma["util_m2"] - 9.8*5.8) < 1e-8
    assert ma["computavel_m2"] == ma["privativa_m2"] != ma["util_m2"]
    b["metrics"] = {"util_m2": 60}
    encontrar(achados(r), "areas.declaradas", "violacao", "apto_0_1")
    # A soma das faces privativas acrescenta só a meia espessura de fachada.
    out = achados(bom())
    priv = encontrar(out, "areas.privativa", "conforme", "andar_1")["measured"]
    comp = encontrar(out, "areas.computavel", "conforme", "andar_1")["measured"]
    assert abs(priv - (4*61.61 + 2*61)) < 1e-8
    assert abs(comp - (priv + 56)) < 1e-8


def test_espessuras_cantos_e_orientacao():
    t = bom()["unit_types"][0]
    t["outline_m"] = ret(0, 0, .1, 6)
    recusa(lambda: medir_areas(t))
    t = bom()["unit_types"][0]
    esperado = medir_areas(t)
    t["outline_m"] = list(reversed(t["outline_m"]))
    t["edge_kinds"] = ["divisa", "divisa", "externa", "externa"]
    assert all(abs(medir_areas(t)[k] - v) < 1e-8 for k, v in esperado.items())
    # Espessura externa diferente altera apenas as faces correspondentes.
    t = bom()["unit_types"][0]
    t["thickness_m"]["externa"] = .15
    assert abs(medir_areas(t)["privativa_m2"] - 10.075*6.075) < 1e-8


def test_transformacoes():
    r = bom()
    p = r["floor_plates"][0]["unit_placements"][0]
    p.update(x=10, y=6, rot_deg=180)
    # Mantém a mesma pegada, trocando o lado exterior junto com o giro.
    r["unit_types"][0]["edge_kinds"] = ["divisa", "externa", "externa", "divisa"]
    assert not [f for f in achados(r) if f["status"] in ("violacao", "erro_tecnico")]
    r = bom()
    p = r["floor_plates"][0]["unit_placements"][0]
    p.update(x=10, mirror=True)
    r["unit_types"][0]["edge_kinds"] = ["externa", "externa", "divisa", "divisa"]
    assert not [f for f in achados(r) if f["status"] in ("violacao", "erro_tecnico")]


def test_varanda_e_fontes():
    r = bom()
    r["unit_types"][0]["balcony_m2"] = 6
    out = achados(r)
    encontrar(out, "areas.varanda_computavel", "nao_verificado", "apto_0_0")
    assert encontrar(out, "areas.computavel", "conforme", "apto_0_0")["measured"] == medir_areas(r["unit_types"][0])["computavel_m2"]
    r["unit_types"][0]["balcony_m2"] = 600
    encontrar(achados(r), "areas.varanda_limite", "violacao", "apto_0_0")
    for flag in ("zone_verified", "lot_zone_verified"):
        r = bom()
        r["rules_ref"][flag] = False
        out = achados(r)
        encontrar(out, "norma.envelope", "nao_verificado", "andar_1")
        encontrar(out, "areas.computavel", "nao_verificado", "apto_0_0")
        encontrar(out, "geometria.envelope", "conforme", "apto_0_0")
    r = bom()
    r["rules_ref"]["sources"].pop("fachada")
    r["rules_ref"]["sources"]["acesso"]["verified"] = False
    out = achados(r)
    encontrar(out, "fachada", "nao_verificado", "apto_0_0")
    encontrar(out, "acesso", "nao_verificado", "apto_0_0")


def test_dados_malformados_e_vinculos():
    for alterar in (lambda r: r.update(unit="mm"),
                    lambda r: r["floor_plates"][0]["unit_placements"][0].update(x=float("nan")),
                    lambda r: r["floor_plates"][0]["cores"][0].update(id="corredor"),
                    lambda r: r["floor_plates"][0]["unit_placements"][0].update(unit_type_id="ausente"),
                    lambda r: r["rules_ref"].update(zone_verified="true"),
                    lambda r: r["rules_ref"]["params"].update(door_width_m=-1)):
        r = bom()
        alterar(r)
        encontrar(validar(r, r["site"], r["rules_ref"]), "contrato", "erro_tecnico", "rev_1")
    r = bom()
    outro = copy.deepcopy(r["site"])
    outro["lote_id"] = "outro"
    encontrar(validar(r, outro, r["rules_ref"]), "contrato", "erro_tecnico", "rev_1")


def test_json_sha_e_atomicidade():
    r = bom()
    r["unit_types"][0]["metrics"]["util_m2"] = 56.84000001
    antes = copy.deepcopy(r)
    with tempfile.TemporaryDirectory(dir=Path(__file__).parent, prefix=".teste-projetista-") as pasta:
        p = Path(pasta)/"rev_1.json"
        salvo = gravar(p, r)
        assert r == antes
        assert ler(p) == salvo == selar(r)
        assert salvo["content_sha256"] == ler(p)["content_sha256"]
        assert serializar(ler(p)) == p.read_bytes()
        assert gravar(p, r) == salvo
        assert selar(dict(reversed(list(r.items()))))["content_sha256"] == salvo["content_sha256"]
        adulterado = copy.deepcopy(salvo)
        adulterado["unit_types"][0]["outline_m"][0][0] = .1
        encontrar(validar(adulterado, adulterado["site"], adulterado["rules_ref"]), "contrato", "erro_tecnico", "rev_1")
        recusa(lambda: gravar(p, adulterado), FileExistsError)
        assert ler(p) == salvo
        q = Path(pasta)/"adulterado.json"
        q.write_bytes(serializar(adulterado))
        recusa(lambda: ler(q))
        q.write_text('{"schema_version":"x","schema_version":"y"}', encoding="utf8")
        recusa(lambda: ler(q))
        q.write_text('{"v":NaN}', encoding="utf8")
        recusa(lambda: ler(q))
        with patch("viabilidade.projetista.esquema.os.replace", side_effect=OSError("falha simulada")):
            recusa(lambda: gravar(Path(pasta)/"falha.json", r), OSError)
        assert not (Path(pasta)/"falha.json").exists()
        assert not list(Path(pasta).glob(".projetista-*.tmp"))
        assert ler(p) == salvo


def test_adaptador_contrato_e_entrada_intacta():
    d = estudo()
    antes = copy.deepcopy(d)
    ref, site, rules = estudo_para_site(d)
    assert d == antes
    assert site["envelope_by_height"] == [{"z0_m": 0, "z1_m": 6, "polygon_m": ret(0, 0, 40, 30)}]
    assert ref["created_at"] is None and rules["lot_zone_verified"] is True
    site["polygon_utm"][0][0] = 0
    assert d == antes
    d["caixa_maxima"]["altura_m"] = None
    try:
        estudo_para_site(d)
        assert False
    except ValueError as erro:
        assert "altura_m" in str(erro) and "null" in str(erro)
    for alterar in (lambda d: d["lote"].pop("crs"),
                    lambda d: d["lote"].update(frente=[[0, 0], [0, 0]]),
                    lambda d: d["lote"].update(zona_conferida="false"),
                    lambda d: d["caixa_maxima"].update(degraus=[{"z0_m": 1, "projecao_utm": []}])):
        d = estudo()
        alterar(d)
        recusa(lambda: estudo_para_site(d))


def test_adaptador_pilotos():
    pasta = RAIZ/"viabilidade/motor/exemplos/pilotos"
    for nome, contagem in (("SC-completo-q1382-11984-11988", 12), ("SC-completo-25297", 2)):
        path = pasta/(nome + ".json")
        raw = path.read_bytes()
        original = json.loads(raw)
        ref, site, rules = estudo_para_site(path)
        assert ref["study_sha256"] == hashlib.sha256(raw).hexdigest()
        assert estudo_para_site(raw) == estudo_para_site(raw.decode("utf8")) == (ref, site, rules)
        assert rules["lot_zone_verified"] is original["lote"]["zona_conferida"] is False
        assert rules["zone_verified"] is original["zona"]["conferido"]
        assert len(site["envelope_by_height"]) == contagem
        frame = site["local_frame"]
        for i, faixa in enumerate(site["envelope_by_height"]):
            g = original["caixa_maxima"]["degraus"][i]
            assert len(g["projecao_utm"]) == len(faixa["polygon_m"])
            assert faixa["z1_m"] > faixa["z0_m"]
            assert Polygon(g["projecao_utm"]).is_valid == Polygon(faixa["polygon_m"]).is_valid
            for (x, y), (e, n) in zip(faixa["polygon_m"], g["projecao_utm"]):
                assert abs(frame["origem"][0] + x*frame["u"][0] + y*frame["v"][0] - e) < 1e-7
                assert abs(frame["origem"][1] + x*frame["u"][1] + y*frame["v"][1] - n) < 1e-7
        assert site["envelope_by_height"][-1]["z1_m"] == original["caixa_maxima"]["altura_m"]
        assert path.read_bytes() == raw


def main():
    testes = [(nome, fn) for nome, fn in globals().items() if nome.startswith("test_") and callable(fn)]
    for nome, fn in testes:
        fn()
        print("OK", nome)
    print(f"{len(testes)} testes passaram; 2 pilotos lidos sem alteração.")


if __name__ == "__main__":
    main()

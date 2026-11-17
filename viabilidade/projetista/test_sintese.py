"""python -I -B -X utf8 viabilidade/projetista/test_sintese.py"""
import copy
import functools
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ))
from viabilidade.projetista.adaptador import estudo_para_site
from viabilidade.projetista.esquema import selar, serializar
from viabilidade.projetista.gerador import gerar_pavimento
from viabilidade.projetista.sintese import (CONDICIONAL, ENGINE_VERSION, GEOTECNICO_SEM_METODO, HIPOTESE, INCONSISTENTE,
                                            VERIFICADO, avaliacao_valida, avaliar, classificar, selar_avaliacao, sintetizar)
from viabilidade.projetista.sondagem import ler_sondagem, referencia, selo
from viabilidade.projetista.test_projetista import bom, ret
from viabilidade.projetista.validador import validar

PILOTO = RAIZ/"viabilidade/motor/exemplos/pilotos/SC-completo-25297.json"
PILOTO_GERADO = RAIZ/"viabilidade/motor/exemplos/pilotos/SC-completo-22421.json"
CAMPOS = ("quantity_kind", "assumptions", "source_version", "confidence", "engine_version")
SEM = {"sondagem": False, "metodo_estrutural": None, "revisao_profissional": {"estrutural": None, "geotecnico": None}}
PRO = {"nome": "Fulana de Tal", "conselho": "CREA-SP", "registro": "0000000000"}
CAD = ler_sondagem(Path(__file__).with_name("exemplo-sondagem-ficticia.json"))
COM = {"sondagem": referencia(CAD), "metodo_estrutural": "faixas preliminares, concreto armado",
       "revisao_profissional": {"estrutural": dict(PRO), "geotecnico": dict(PRO)}}


def revisao_piloto():
    """Pavimento simples dentro do envelope real do piloto 25297 (zona do lote não conferida)."""
    r = bom()
    r["study_ref"], r["site"], r["rules_ref"] = estudo_para_site(PILOTO)
    for i, t in enumerate(r["unit_types"][:2]):
        t["outline_m"] = ret(0, 0, 12, 3)
        t["edge_kinds"] = ["externa", "divisa" if i == 0 else "externa", "divisa", "externa" if i == 0 else "divisa"]
    r["unit_types"] = r["unit_types"][:2]
    plate = r["floor_plates"][0]
    plate.update({"outline_m": ret(2, 4.5, 24, 4.5), "cores": [],
                  "shared_spaces": [{"id": "corredor", "kind": "corredor", "polygon_m": ret(2, 7.5, 24, 1.5), "computable": True}],
                  "unit_placements": [{"id": f"apto_{i}", "unit_type_id": t["id"], "x": 2 + 12*i, "y": 4.5,
                                       "rot_deg": 0, "mirror": False} for i, t in enumerate(r["unit_types"])]})
    return r


def achado(rule, status="conforme", **extra):
    return {"rule_id": rule, "status": status, "measured": None, "limit": None, "unit": "", "diff": None,
            "element_ids": ["x"], "source": {"reference": "fixture", "verified": True}, "suggestion": "", **extra}


TODOS = [achado(r) for r in ("geometria.laje", "norma.envelope", "arquitetura.circulacao",
                             "estrutura.pilar", "geotecnia.recalque")]
ESCOPO5 = ["geometrico", "urbanistico", "arquitetonico", "estrutural", "geotecnico"]


def chaves(x):
    if isinstance(x, dict):
        return set(x) | set().union(*map(chaves, x.values()))
    if isinstance(x, list):
        return set().union(*map(chaves, x))
    return set()


def test_piloto():
    r = revisao_piloto()
    out = validar(r, r["site"], r["rules_ref"])
    assert not [f for f in out if f["status"] in ("violacao", "erro_tecnico")], [f for f in out if f["status"] in ("violacao", "erro_tecnico")]
    a = sintetizar(out, ["geometrico", "urbanistico"], SEM)
    assert a["sintese"] in (CONDICIONAL, HIPOTESE) and a["sintese"] != VERIFICADO
    urb = a["dominios"]["urbanistico"]
    assert urb["estado"] == "nao_verificado" and {"norma.envelope", "areas.computavel"} <= set(urb["pendentes"])
    assert not a["regras_sem_dominio"] and not a["motivos_trava"]
    print("   piloto 25297:", a["sintese"], "regra", a["regra_da_precedencia"],
          {d: v["estado"] for d, v in a["dominios"].items() if v["no_escopo"]})
    # Com a zona do lote conferida continua sem conforme urbanístico: as fontes do piloto têm verified=False.
    r["rules_ref"]["lot_zone_verified"] = True
    b = sintetizar(validar(r, r["site"], r["rules_ref"]), ["geometrico", "urbanistico"], SEM)
    assert b["sintese"] in (CONDICIONAL, HIPOTESE), b["sintese"]
    print("   piloto 25297 com zona conferida:", b["sintese"], "regra", b["regra_da_precedencia"],
          {d: v["pendentes"] for d, v in b["dominios"].items() if v["no_escopo"]})


def test_estrutural_sem_regra():
    out = validar(bom(), bom()["site"], bom()["rules_ref"])
    a = sintetizar(out, ["geometrico", "estrutural"], COM)
    assert a["dominios"]["estrutural"]["estado"] == "nao_verificado"
    assert a["dominios"]["estrutural"]["required_actions"]
    assert a["sintese"] in (CONDICIONAL, HIPOTESE)


def test_trava():
    a = sintetizar(TODOS, ESCOPO5, SEM)
    # 0.3.0: regra 3, não 4. O geotécnico nunca fica conforme, então a trava já não é a única a segurar.
    assert a["sintese"] == CONDICIONAL and a["regra_da_precedencia"] == 3
    assert "Falta sondagem do terreno" in a["motivos_trava"] and len(a["motivos_trava"]) == 4
    # Era VERIFICADO até a 0.2.0. Agora, mesmo com tudo cadastrado, fica CONDICIONAL (geotécnico sem método).
    assert sintetizar(TODOS, ESCOPO5, COM, sondagem=CAD)["sintese"] == CONDICIONAL
    assert sintetizar(TODOS, ["geometrico", "estrutural"], COM, sondagem=CAD)["sintese"] == VERIFICADO
    sem_registro = copy.deepcopy(COM)
    sem_registro["revisao_profissional"]["geotecnico"]["registro"] = "  "
    b = sintetizar(TODOS, ESCOPO5, sem_registro, sondagem=CAD)
    assert b["sintese"] == CONDICIONAL and b["motivos_trava"] == ["Falta revisão profissional geotecnico com nome, conselho e registro"]
    for chave in ("sondagem", "metodo_estrutural"):
        e = copy.deepcopy(COM)
        e[chave] = None
        assert sintetizar(TODOS, ["geometrico", "estrutural"], e, sondagem=CAD)["sintese"] == CONDICIONAL
    # Sem estrutural/geotécnico no escopo a trava não se aplica.
    assert sintetizar(TODOS, ["geometrico", "urbanistico"], SEM)["sintese"] == VERIFICADO


def test_violacao_ganha():
    a = sintetizar(TODOS + [achado("geometria.sobreposicao", "violacao")], ESCOPO5, COM)
    assert a["sintese"] == INCONSISTENTE and a["dominios"]["geometrico"]["estado"] == "violacao"
    # Violação fora do escopo não decide, mas continua no resultado.
    b = sintetizar(TODOS + [achado("arquitetura.x", "violacao")], ["geometrico", "urbanistico"], SEM)
    assert b["sintese"] == VERIFICADO
    assert [x for x in b["fora_do_escopo"] if x["domain"] == "arquitetonico"][0]["contagem"]["violacao"] == 1


def test_nao_aplicavel_e_desconhecido():
    c = classificar([achado("geometria.laje", "nao_aplicavel"), achado("geometria.laje", "nao_aplicavel", reason="Sem laje em balanço"),
                     achado("regra.inventada"), achado("geometria.laje", "talvez")])
    assert [f["status"] for f in c] == ["erro_tecnico", "nao_aplicavel", "erro_tecnico", "erro_tecnico"]
    assert c[2]["domain"] is None and "sem domínio" in c[2]["reason"]
    a = sintetizar([achado("regra.inventada")] + TODOS, ["geometrico"], SEM)
    assert a["sintese"] == HIPOTESE and a["regras_sem_dominio"] == ["regra.inventada"]
    # nao_aplicavel nunca conta como conforme.
    b = sintetizar([achado("geometria.laje", "nao_aplicavel", reason="x"), achado("norma.envelope")], ["geometrico", "urbanistico"], SEM)
    assert b["sintese"] == HIPOTESE and b["dominios"]["geometrico"]["estado"] == "nao_aplicavel"
    # Econômico hoje é sempre dados_insuficientes (decisão 7).
    assert sintetizar(TODOS, ["economico"], SEM)["dominios"]["economico"]["estado"] == "dados_insuficientes"


def test_entrada_intacta_e_deterministico():
    r = revisao_piloto()
    out = validar(r, r["site"], r["rules_ref"])
    antes = copy.deepcopy(out)
    a = sintetizar(out, ["geometrico", "urbanistico"], SEM)
    assert out == antes
    assert json.dumps(a, sort_keys=True) == json.dumps(sintetizar(out, ["urbanistico", "geometrico"], SEM), sort_keys=True)
    for f in a["achados"]:
        assert {"domain", "method_version", "scope", "reason", "required_actions"} <= f.keys()
        assert "calculated_at" not in f
        assert f["required_actions"] or f["status"] in ("conforme", "nao_aplicavel")


def test_sem_viavel_e_com_aviso():
    casos = [sintetizar(TODOS, ESCOPO5, e) for e in (SEM, COM)] + [sintetizar([], ["geometrico"], None)]
    for a in casos:
        assert "viavel" not in chaves(a) and "preliminar" in a["aviso"]
    assert casos[2]["sintese"] == HIPOTESE
    try:
        sintetizar(TODOS, ["solo"], SEM)
    except ValueError:
        return
    raise AssertionError("Escopo inválido deveria ser recusado")


@functools.cache
def _gerada():
    estudo, site, regras = estudo_para_site(PILOTO_GERADO)
    r = gerar_pavimento(site, regras, {"unidades": 6}, None, estudo)
    assert r["outcome"] == "gerado", r["outcome"]
    return r["revisoes"][0]


def gerada():
    return copy.deepcopy(_gerada())


def test_avaliacao_ligada_a_revisao():
    rev = gerada()
    a = avaliar(rev)
    assert avaliacao_valida(a, rev) == (True, "")
    assert a["revision_id"] == rev["revision_id"] and a["revision_sha256"] == rev["content_sha256"]
    assert "sintese" not in rev and "avaliacao_sha256" not in rev  # arquivo à parte
    mexida = copy.deepcopy(rev)
    mexida["unit_types"][0]["outline_m"][2][0] += 0.05
    assert avaliacao_valida(a, selar(mexida)) == (False, "geometria mudou")
    assert avaliacao_valida(a, mexida) == (False, "geometria mudou")  # mexida sem selar de novo também cai
    outra = copy.deepcopy(rev)
    outra["revision_id"] = "rev_outra"
    assert avaliacao_valida(a, selar(outra)) == (False, "outra revisão")


def test_selo_e_versao_do_metodo():
    rev = gerada()
    a = avaliar(rev)
    adulterada = copy.deepcopy(a)
    adulterada["sintese"]["sintese"] = VERIFICADO
    assert avaliacao_valida(adulterada, rev) == (False, "selo")
    velha = copy.deepcopy(a)
    velha["method_version"] = "sintese/0.2.0"  # as avaliações da tarefa 7, de antes da sondagem
    assert avaliacao_valida(selar_avaliacao(velha), rev) == (False, "versão do método mudou")


def test_campos_de_grandeza():
    a = avaliar(gerada())
    achados = a["sintese"]["achados"]
    fonte = {id(f): a["fontes"][f["source_ref"]] for f in achados}
    assert achados and all(f["engine_version"] == ENGINE_VERSION == "projetista/0.1.0+sintese/0.3.0" for f in achados)
    nao_conferidas = 0
    for f in achados:
        assert set(CAMPOS) <= f.keys() and "calculated_at" not in f, f["rule_id"]
        assert {"scope", "reason", "required_actions"} <= f.keys()
        assert isinstance(f["assumptions"], list)
        for campo in CAMPOS:
            assert f[campo] is not None or f["null_reasons"].get(campo), (f["rule_id"], campo)
        if fonte[id(f)].get("verified") is not True:
            nao_conferidas += 1
            assert f["confidence"] in ("premissa", "sem_fonte"), f
        if fonte[id(f)].get("kind") == "premissa":
            assert f["confidence"] == "premissa" and f["assumptions"] == [fonte[id(f)]["reference"]]
    assert nao_conferidas
    kinds = {f["rule_id"]: f["quantity_kind"] for f in achados}
    assert kinds["areas.privativa"] == "area" and kinds["fachada"] == "comprimento"
    assert kinds["geometria.poligono"] is None
    # Fonte sem nada vira sem_fonte, com motivo para a versão nula.
    c = classificar([achado("geometria.laje", source={})])[0]
    assert c["confidence"] == "sem_fonte" and c["source_version"] is None and c["null_reasons"]["source_version"]


def test_fontes_uma_vez_so():
    rev = gerada()
    a = avaliar(rev)
    achados = a["sintese"]["achados"]
    citadas = {f["source_ref"] for f in achados}
    assert all("source" not in f for f in achados)
    assert citadas == set(a["fontes"]) and len(a["fontes"]) < len(achados)  # nada órfão, nada faltando
    # Reconstrução: fonte de volta pela citação = achados como a 0.1.0 gravava (fonte inteira em cada um).
    antes = sintetizar(validar(rev, rev["site"], rev["rules_ref"]), a["escopo"], {}, rev["rules_ref"]["rules_version"])
    refeitos = []
    for f in copy.deepcopy(achados):
        f["source"] = a["fontes"][f.pop("source_ref")]
        refeitos.append(f)
    assert serializar(refeitos) == serializar(antes["achados"])
    # As chaves que o painel do Visual lê não mudaram.
    for k in ("sintese", "regra_da_precedencia", "dominios", "motivos_trava", "fora_do_escopo", "aviso"):
        assert serializar(a["sintese"][k]) == serializar(antes[k]), k
    assert len(serializar(a)) < len(serializar({**a, "sintese": antes}))


def test_sondagem_na_sintese():
    def motivos(ev, cad=CAD, escopo=ESCOPO5):
        return sintetizar(TODOS, escopo, ev, sondagem=cad)["motivos_trava"]
    # `True` antigo trava com o motivo novo.
    assert motivos({**COM, "sondagem": True}) == ["sondagem declarada sem cadastro"]
    # Referência com sha errado trava; cadastro mexido sem selar de novo também.
    assert motivos({**COM, "sondagem": {**COM["sondagem"], "sha256": "0" * 64}}) == ["Selo da sondagem não bate com a referência"]
    mexido = copy.deepcopy(CAD)
    mexido["furos"][0]["spt"][0]["segmentos"][2]["golpes"] += 1
    assert motivos(COM, mexido) == ["Selo da sondagem não bate com a referência"]
    assert motivos(COM, None) == ["Sondagem referenciada não está no cadastro"]
    # Cadastro com selo refeito mas profissional incompleto trava.
    sem_pro = copy.deepcopy(CAD)
    sem_pro["profissional"]["registro"] = ""
    sem_pro["investigation_sha256"] = selo(sem_pro)
    m = motivos({**COM, "sondagem": referencia(sem_pro)}, sem_pro)
    assert len(m) == 1 and m[0].startswith("Sondagem com erro no cadastro") and "registro" in m[0]
    # Referência válida tira só o motivo da sondagem.
    sem_sond = motivos({**SEM, "sondagem": False})
    com_sond = motivos({**SEM, "sondagem": referencia(CAD)})
    assert sem_sond == ["Falta sondagem do terreno"] + com_sond and len(com_sond) == 3
    # Adversário: sondagem válida, achado geotécnico conforme, tudo completo -> geotécnico nunca conforme.
    for escopo in (ESCOPO5, ["geotecnico"]):
        a = sintetizar(TODOS, escopo, COM, sondagem=CAD)
        g = a["dominios"]["geotecnico"]
        assert not a["motivos_trava"] and g["contagem"]["conforme"] == 1
        assert g["estado"] == "nao_verificado" and GEOTECNICO_SEM_METODO in g["required_actions"]
        assert a["sintese"] == CONDICIONAL, a["sintese"]
    rev = gerada()
    av = avaliar(rev, ESCOPO5, COM, CAD)
    assert av["evidencias"]["sondagem"] == referencia(CAD) and av["sintese"]["sintese"] != VERIFICADO
    assert avaliacao_valida(av, rev) == (True, "")


def test_avaliacao_mesmos_bytes():
    rev = gerada()
    assert serializar(avaliar(rev)) == serializar(avaliar(copy.deepcopy(rev)))


def main():
    testes = [(nome, fn) for nome, fn in globals().items() if nome.startswith("test_") and callable(fn)]
    for nome, fn in testes:
        fn()
        print("OK", nome)
    print(f"{len(testes)} testes passaram.")


if __name__ == "__main__":
    main()

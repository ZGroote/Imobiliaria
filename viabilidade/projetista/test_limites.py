"""python -I -B -X utf8 viabilidade/projetista/test_limites.py

PA-G3: limites do prédio inteiro no validador (`torre.*`). Só assert; não depende do rótulo da síntese.
"""
import copy
from pathlib import Path
import subprocess
import sys

sys.dont_write_bytecode = True
RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ))
from shapely import affinity
from shapely.geometry import Polygon

from viabilidade.projetista.esquema import selar, serializar
from viabilidade.projetista.sintese import dominio
from viabilidade.projetista.test_cargas import gerada
from viabilidade.projetista.torre import compor
from viabilidade.projetista.validador import LIMITES, PILHA_AUSENTE, SEM_LIMITE, SEM_PERMEAVEL, medir_areas, validar

TORRE = ("torre.altura", "torre.ca", "torre.to", "torre.permeabilidade", "torre.continuidade")


def regras(rev):
    return {a["rule_id"]: a for a in validar(rev, rev["site"], rev["rules_ref"]) if a["rule_id"].startswith("torre.")}


def a_mao(rev):
    """CA e TO contados sem o validador: computável de cada peça + resíduo, maior laje sem a garagem."""
    lote = rev["site"]["area_m2"]  # a área declarada do lote (o polígono UTM dá 3e-6 a mais no CA, por arredondamento)
    tipos = {t["id"]: t for t in rev["unit_types"]}
    comp = 0.0
    for f in rev["floor_plates"]:
        comp += sum(medir_areas(tipos[p["unit_type_id"]])["computavel_m2"] for p in f["unit_placements"])
        comp += sum(Polygon(e["polygon_m"]).area for e in f["shared_spaces"] + f["cores"] if e["computable"])
        comp += f["residuals_m2"]
    garagem = rev["rules_ref"]["params"]["motor"]["garagem_conta_na_taxa_ocupacao"]
    laje = max(Polygon(f["outline_m"]).area - (0 if garagem else sum(
        Polygon(e["polygon_m"]).area for e in f["shared_spaces"] if e["kind"] == "garagem")) for f in rev["floor_plates"])
    return comp / lote, laje / lote


def com_regras(rev, **motor):
    """Mesma torre com outros limites e fontes conferidas, selada de novo (revisão sintética)."""
    r = copy.deepcopy(rev)
    rr = r["rules_ref"]
    rr["params"]["motor"].update(motor)
    rr["lot_zone_verified"] = True
    for regra in LIMITES:
        rr["sources"][regra] = {"reference": "teste: fonte sintética conferida", "verified": True, "kind": "norma"}
    return selar(r)


def test_22421_ca_to_e_altura():
    for terreo in (False, True):
        t = compor(gerada(), terreo=terreo)
        R = regras(t)
        ca, to = a_mao(t)
        assert abs(R["torre.ca"]["measured"] - ca) <= 1e-6 and abs(R["torre.to"]["measured"] - to) <= 1e-6, (R, ca, to)
        assert abs(ca - t["metrics_summary"]["torre"]["computavel_total"]["valor"] / t["site"]["area_m2"]) <= 1e-6
        assert R["torre.altura"]["status"] == "nao_verificado" and R["torre.altura"]["suggestion"] == SEM_LIMITE
        assert R["torre.altura"]["measured"] == 6 and R["torre.altura"]["limit"] is None
        assert R["torre.permeabilidade"]["status"] == "nao_verificado" and R["torre.permeabilidade"]["suggestion"] == SEM_PERMEAVEL
        assert R["torre.continuidade"]["status"] == "conforme"
        assert "torre.vagas" not in R  # o 22421 não tem mínimo de vagas: a regra não existe
        assert all(a["status"] != "conforme" for k, a in R.items() if k != "torre.continuidade")  # fonte não conferida
        print(f"   22421 {'com' if terreo else 'sem'} térreo: CA {ca:.4f}, TO {to:.4f}")


def test_ca_violacao_e_condicionado():
    t = compor(gerada())
    ca = regras(t)["torre.ca"]["measured"]
    r = com_regras(t, ca_basico=ca / 2, ca_maximo=ca * 0.9)
    alto = regras(r)["torre.ca"]
    assert alto["status"] == "violacao" and alto["limit"] == r["rules_ref"]["params"]["motor"]["ca_maximo"]  # selar arredonda
    meio = regras(com_regras(t, ca_basico=ca / 2, ca_maximo=ca * 2))["torre.ca"]
    assert meio["status"] == "nao_verificado" and meio["suggestion"].startswith("condicionado") and "outorga" in meio["suggestion"]
    baixo = regras(com_regras(t, ca_basico=ca * 2, ca_maximo=ca * 3))
    assert baixo["torre.ca"]["status"] == "conforme" and baixo["torre.to"]["status"] == "conforme"
    sem = regras(com_regras(t, ca_basico=None, ca_maximo=None, altura_max_m=None))
    assert all(sem[k]["status"] == "nao_verificado" and sem[k]["suggestion"] == SEM_LIMITE for k in ("torre.ca", "torre.altura"))
    # TO: a garagem do térreo entra só se a zona mandar contar.
    tt = compor(gerada(), terreo=True)
    assert regras(com_regras(tt, garagem_conta_na_taxa_ocupacao=True))["torre.to"]["measured"] >= regras(tt)["torre.to"]["measured"]
    # vagas: com mínimo declarado, a regra existe e confere a torre.
    v = regras(com_regras(tt, vagas_min_por_unidade=3))["torre.vagas"]
    assert v["status"] == "violacao" and v["limit"] == 18 and v["measured"] == 12


def test_revisao_a_mao_continuidade():
    t = compor(gerada())
    flutua = copy.deepcopy(t)
    flutua["floor_plates"][1]["z0_m"] += 0.5
    c = regras(selar(flutua))["torre.continuidade"]
    assert c["status"] == "violacao" and "começa em" in c["suggestion"], c
    torto = copy.deepcopy(t)
    e = next(e for e in torto["floor_plates"][1]["cores"] if e["kind"] == "elevador")
    e["polygon_m"] = [list(x) for x in affinity.translate(Polygon(e["polygon_m"]), 0.3, 0).exterior.coords[:-1]]
    c = regras(selar(torto))["torre.continuidade"]
    assert c["status"] == "violacao" and "núcleo elevador" in c["suggestion"], c
    # sem o resumo da torre (feita à mão do zero), a pilha de 2 andares ainda é conferida
    sem_resumo = copy.deepcopy(flutua)
    del sem_resumo["metrics_summary"]["torre"]
    assert regras(selar(sem_resumo))["torre.continuidade"]["status"] == "violacao"


def test_um_pavimento_nao_verificado():
    R = regras(gerada())
    assert set(R) == set(TORRE)
    assert all(a["status"] == "nao_verificado" and a["suggestion"] == PILHA_AUSENTE for a in R.values())


def test_fonte_e_dominio():
    for rev in (gerada(), compor(gerada()), com_regras(compor(gerada()), vagas_min_por_unidade=1)):
        fontes = rev["rules_ref"]["sources"]
        for k, a in regras(rev).items():
            assert a["source"].get("reference"), k
            esperado = (fontes.get(k) or fontes["norma.envelope"])["verified"] if k in LIMITES else True  # continuidade: geometria
            assert a["source"]["verified"] is esperado, (k, a["source"])
            assert dominio(k) == ("geometrico" if k == "torre.continuidade" else "urbanistico")


def test_mesmos_bytes():
    for rev in (gerada(), compor(gerada(), terreo=True)):
        assert serializar(validar(rev, rev["site"], rev["rules_ref"])) == serializar(validar(rev, rev["site"], rev["rules_ref"]))


def test_suites_anteriores():
    for t in ("test_projetista.py", "test_gerador.py", "test_editor.py", "test_torre.py", "test_para_vista.py",
              "test_sintese.py", "test_pacote.py", "test_fluxo.py", "test_cargas.py"):
        r = subprocess.run([sys.executable, "-I", "-B", "-X", "utf8", str(Path(__file__).with_name(t))],
                           capture_output=True, text=True, encoding="utf-8")
        assert r.returncode == 0, t + "\n" + r.stdout[-800:] + r.stderr[-800:]
        print(f"   {t}: {r.stdout.strip().splitlines()[-1]}")


def main():
    testes = [(nome, fn) for nome, fn in globals().items() if nome.startswith("test_") and callable(fn)]
    for nome, fn in testes:
        fn()
        print("OK", nome)
    print(f"{len(testes)} testes passaram.")


if __name__ == "__main__":
    main()

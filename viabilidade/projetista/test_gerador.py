"""Testes do gerador (só assert). Rodar: python -I -X utf8 viabilidade/projetista/test_gerador.py"""
import copy
import math
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ))
from shapely import affinity
from shapely.geometry import Polygon

from viabilidade.projetista.adaptador import estudo_para_site
from viabilidade.projetista.gerador import gerar_pavimento
from viabilidade.projetista.validador import validar

PILOTOS = RAIZ / "viabilidade" / "motor" / "exemplos" / "pilotos"


def ret(x, y, w, h):
    return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]


def estudo(w=30, h=20, graus=0):
    env = ret(200000, 7500000, w, h)
    if graus:
        env = [list(p) for p in affinity.rotate(Polygon(env), graus, origin="centroid").exterior.coords][:-1]
    return {"versao_motor": "sintetico-1",
            "lote": {"id": "lote_teste", "crs": "EPSG:31983", "poligono_utm": ret(200000, 7500000, w, h),
                     "frente": [[200000, 7500000], [200000 + w, 7500000]], "zona_id": "zona_teste", "zona_conferida": True},
            "zona": {"id": "zona_teste", "conferido": True, "parametros": {}, "fontes": []},
            "caixa_maxima": {"altura_m": 6, "projecao_utm": env, "degraus": []}}


def gerar(est, **kw):
    e, site, regras = estudo_para_site(est)
    return gerar_pavimento(site, regras, kw.pop("programa", {"unidades": 6}), kw.pop("limites", None), e)


def conferir_gerado(r, n=6):
    assert r["outcome"] == "gerado", (r["outcome"], r["motivo"], r["prova"], r["recusas"])
    for rev in r["revisoes"]:
        achados = validar(rev, rev["site"], rev["rules_ref"])
        assert not [f for f in achados if f["status"] in ("violacao", "erro_tecnico")], achados
        m = rev["metrics_summary"]
        assert m["unidades"] == n and m["fachada_min_m"] >= 3.0
        pav = rev["floor_plates"][0]
        assert len(pav["unit_placements"]) == n
        acesso = [f for f in achados if f["rule_id"] == "acesso"]
        assert len(acesso) == n and all(f["measured"] >= 0.8 for f in acesso)


def test_retangulo_sintetico():
    r = gerar(estudo())
    conferir_gerado(r)
    assert 1 <= len(r["revisoes"]) <= 3
    totais = [o["privativa_total_m2"] for o in r["objetivos"]]
    assert totais == sorted(totais, reverse=True)


def test_rotacao_37():
    a, b = gerar(estudo()), gerar(estudo(graus=37))
    conferir_gerado(b)
    ta, tb = a["objetivos"][0]["privativa_total_m2"], b["objetivos"][0]["privativa_total_m2"]
    assert abs(ta - tb) < 0.5, (ta, tb)


def test_determinismo():
    a, b = gerar(estudo()), gerar(estudo())
    assert [x["content_sha256"] for x in a["revisoes"]] == [x["content_sha256"] for x in b["revisoes"]]
    assert a["busca"] == b["busca"]


def test_piloto_q1382():
    r = gerar(PILOTOS / "SC-completo-q1382-11984-11988.json")
    conferir_gerado(r)
    assert r["reparos_envelope"], "esperava faixas refeitas no piloto q1382"


def test_piloto_25297_inviavel():
    r = gerar(PILOTOS / "SC-completo-25297.json")
    assert r["outcome"] == "inviavel" and r["prova"] and not r["revisoes"], r["outcome"]


def test_nao_encontrado_nunca_inviavel():
    # L: cabe em área e em largura mínima, então não há prova; com 3 nós a busca tem de parar sem concluir
    L = [[0, 0], [30, 0], [30, 8], [12, 8], [12, 25], [0, 25]]
    est = estudo()
    est["caixa_maxima"]["projecao_utm"] = [[200000 + x, 7500000 + y] for x, y in L]
    est["lote"]["poligono_utm"] = ret(200000, 7500000, 30, 25)
    r = gerar(est, limites={"max_nos": 3})
    assert r["outcome"] == "nao_encontrado" and not r["prova"], r["outcome"]
    assert r["busca"]["nos"] >= 3 and r["busca"]["esgotada"] is False
    # estreito (largura = lado mínimo + corredor - 0,5): prova de largura; um pouco acima não pode ser "inviável"
    estreito = gerar(estudo(w=100, h=4.0))
    assert estreito["outcome"] == "inviavel" and "largura" in estreito["prova"]


def test_fatia1_continua_passando():
    p = subprocess.run([sys.executable, "-I", "-X", "utf8", str(Path(__file__).with_name("test_projetista.py"))],
                       capture_output=True, text=True, cwd=RAIZ)
    assert p.returncode == 0, p.stdout[-800:] + p.stderr[-800:]


def main():
    for nome, f in sorted(globals().items()):
        if nome.startswith("test_") and callable(f):
            f()
            print("ok", nome)
    print("todos os testes do gerador passaram")


if __name__ == "__main__":
    main()

"""Teste curto do motor. Falha se volume sair do lote/caixa, se CA/TO/altura passarem do máximo
ou se a mesma entrada der arquivo diferente.

    python -I viabilidade/motor/test_motor.py
"""
import copy
import json
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from shapely import affinity  # noqa: E402
from shapely.geometry import Polygon  # noqa: E402

from motor import caixa_recuada, gerar_estudo, recuo_divisa  # noqa: E402


def _carrega(nome):
    with open(os.path.join(AQUI, "exemplos", nome), encoding="utf-8") as f:
        return json.load(f)


def confere(estudo):
    zp = estudo["zona"]["parametros"]
    pr = estudo["premissas"]
    lote_d = estudo["lote"]
    lote = Polygon(lote_d["poligono_utm"])
    A = lote.area
    rf = estudo["caixa_maxima"]["recuo_frontal_m"]
    caixa = Polygon(estudo["caixa_maxima"]["projecao_utm"])
    assert lote.buffer(0.02).contains(caixa), "caixa saiu do lote"
    lims = [zp.get("altura_max_m")] + [e.get("altura_max_m") for e in lote_d.get("areas_especiais") or []]
    hmax = min([x for x in lims if x], default=None)
    for o in estudo["opcoes"]:
        m = o["metricas"]
        for v in o["volumes"]:
            base = Polygon(v["base_utm"])
            topo = v["z0_m"] + v["altura_m"]
            if v.get("parede_cega"):  # encosta na divisa: só até a altura da lei, e respeita a frente
                assert v["z0_m"] == 0 and topo <= zp["parede_cega_encosta_ate_m"] + 1e-6, f"{o['id']}: parede cega alta demais"
                assert caixa_recuada(lote, lote_d["frente"], rf, 0, 0).buffer(0.02).contains(base), f"{o['id']}: parede cega saiu do lote"
                continue
            assert caixa.buffer(0.02).contains(base), f"{o['id']}: volume {v['uso']} saiu da caixa do térreo"
            if v["z0_m"] < 0:
                continue
            if hmax:
                assert topo <= hmax + 1e-6, f"{o['id']}: passou da altura {topo} > {hmax}"
            # recuo por altura conferido aqui, sem confiar no motor: pavimento do topo e sua altura
            pav_topo = round((v["z0_m"] - pr["pe_direito_terreo_m"]) / pr["pe_direito_m"]) + 1 + v["pavimentos"] if v["z0_m"] > 0 else v["pavimentos"]
            rl = recuo_divisa(zp, zp.get("recuo_lateral_m") or 0, pav_topo, topo)
            rb = recuo_divisa(zp, zp.get("recuo_fundos_m") or 0, pav_topo, topo, "fundos")
            c = caixa_recuada(lote, lote_d["frente"], rf, rl, rb)
            assert c.buffer(0.02).contains(base), f"{o['id']}: {v['uso']} fura o recuo {rl:.2f}/{rb:.2f} m da altura {topo} m"
        assert m["ca_usado"] <= zp["ca_maximo"] + 1e-3, f"{o['id']}: CA {m['ca_usado']} > {zp['ca_maximo']}"
        assert m["area_computavel_m2"] <= zp["ca_maximo"] * A + 0.05, f"{o['id']}: computável passou"
        assert m["to_usada"] <= (zp.get("taxa_ocupacao") or 1) + 1e-3, f"{o['id']}: TO passou"
        if zp.get("pavimentos_max"):
            assert m["pavimentos"] <= zp["pavimentos_max"], f"{o['id']}: pavimentos passou"
        assert not any(a.startswith("PASSOU") for a in o["alertas"]), o["alertas"]


def main():
    lote, zona = _carrega("lote-exemplo.json"), _carrega("zona-exemplo.json")

    # 1) exemplo: 4 opções, todas dentro dos limites, e o arquivo gravado bate com o que o motor gera agora
    e = gerar_estudo(lote, zona)
    confere(e)
    assert [o["id"] for o in e["opcoes"]] == ["A", "B", "C", "D"], [o["id"] for o in e["opcoes"]]
    assert json.dumps(e, ensure_ascii=False) == json.dumps(gerar_estudo(copy.deepcopy(lote), zona), ensure_ascii=False)
    assert e == _carrega("estudo-exemplo.json"), "estudo-exemplo.json desatualizado: rode preparar_exemplo.py"

    # 2) lote girado 33° e em L (corta um canto), zona apertada em pavimentos, CA alto, garagem computável
    p = Polygon(lote["poligono_utm"])
    c = p.centroid
    p = p.difference(affinity.translate(p, 30, 12.5))  # tira um canto: vira L
    p = affinity.rotate(p, 33, origin=c)
    pts = [list(q) for q in p.exterior.coords[:-1]]
    frente = affinity.rotate(Polygon(lote["poligono_utm"]), 33, origin=c).exterior.coords[0:2]
    lote2 = dict(lote, poligono_utm=pts, frente=[list(q) for q in frente])
    zona2 = copy.deepcopy(zona)
    zona2["parametros"].update(ca_maximo=6.0, altura_max_m=None, pavimentos_max=8, garagem_computavel=None)
    e2 = gerar_estudo(lote2, zona2, {"garagem_computavel": True, "preco_venda_m2_privativo": 9000})
    confere(e2)
    assert e2["opcoes"], "lote em L ficou sem opção"
    assert all(o["metricas"]["vgv_estimado"] for o in e2["opcoes"]), "VGV sumiu com preço informado"
    assert "garagem_computavel" not in e2["premissas"]["padrao"]

    # 3) gabarito de área especial (centro histórico, 9 m) e zona sem regra por altura
    zona3 = copy.deepcopy(zona)
    for k in ("recuo_lateral_por_altura", "recuo_fundos_por_altura"):
        zona3["parametros"].pop(k, None)
    e3 = gerar_estudo(dict(lote, areas_especiais=[{"tipo": "gabarito", "altura_max_m": 9, "fonte": "teste"}]), zona3)
    confere(e3)
    assert e3["opcoes"] and all(v["z0_m"] + v["altura_m"] <= 9 for o in e3["opcoes"] for v in o["volumes"])

    # 4) TO alta: o embasamento com parede cega (encostado na divisa até 12 m) ocupa mais e ganha
    zona4 = copy.deepcopy(zona)
    zona4["parametros"].update(taxa_ocupacao=0.9, taxa_permeabilidade=0.05)
    e4 = gerar_estudo(lote, zona4)
    confere(e4)
    d4 = next(o for o in e4["opcoes"] if o["id"] == "D")
    assert d4["volumes"][0].get("parede_cega"), "com TO 90% a base com parede cega devia ganhar"

    # 5) lote real pequeno (~300 m²): o que não cabe some, sem quebrar
    pequeno = dict(lote, poligono_utm=[[0, 0], [12, 0], [12, 25], [0, 25]], frente=[[0, 0], [12, 0]])
    confere(gerar_estudo(pequeno, zona))
    print("ok")


if __name__ == "__main__":
    main()

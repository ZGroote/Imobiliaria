"""Teste curto do motor. Falha se volume sair do lote/caixa, se CA/TO/altura passarem do máximo
ou se a mesma entrada der arquivo diferente.

    python -I viabilidade/motor/test_motor.py
"""
import copy
import json
import math
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from shapely import affinity  # noqa: E402
from shapely.geometry import LineString, Polygon  # noqa: E402

from motor import PREMISSAS_PADRAO, _avaliar, caixa_recuada, gerar_estudo, recuo_divisa  # noqa: E402


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
        if zp.get("ca_maximo") is not None:  # null = a lei não limita (SC-Z6E)
            assert m["ca_usado"] <= zp["ca_maximo"] + 1e-3, f"{o['id']}: CA {m['ca_usado']} > {zp['ca_maximo']}"
            assert m["area_computavel_m2"] <= zp["ca_maximo"] * A + 0.05, f"{o['id']}: computável passou"
        # permeabilidade: o que sobra sem prédio e sem subsolo não pode ser menos que a lei pede
        assert m["area_permeavel_m2"] >= (zp.get("taxa_permeabilidade") or 0) * A - 0.1, f"{o['id']}: permeável {m['area_permeavel_m2']} abaixo do exigido"
        # apartamento não atravessa andar: unidades = soma por pavimento de (privativa do andar // área da unidade)
        un = 0
        for v in o["volumes"]:
            if v["uso"] == "residencial":
                laje = Polygon(v["base_utm"]).area
                por_andar = max(0.0, min(laje * pr["eficiencia"], laje - pr["area_comum_por_pavimento_m2"]))
                un += v["pavimentos"] * int(por_andar // pr["area_privativa_por_unidade_m2"] + 1e-9)
        assert un == m["unidades_estimadas"], f"{o['id']}: unidades {m['unidades_estimadas']} != {un} contadas por andar"
        # vaga que falta nunca some calada
        if pr["garagem"] == "subsolo" and m["vagas"] < math.ceil(m["unidades_estimadas"] * pr["vagas_por_unidade"] - 1e-9):
            assert any(a.startswith("Faltam vagas") for a in o["alertas"]), f"{o['id']}: vagas caíram sem alerta"
        assert m["to_usada"] <= (zp.get("taxa_ocupacao") or 1) + 1e-3, f"{o['id']}: TO passou"
        if zp.get("pavimentos_max"):
            assert m["pavimentos"] <= zp["pavimentos_max"], f"{o['id']}: pavimentos passou"
        assert not any(a.startswith("PASSOU") for a in o["alertas"]), o["alertas"]


def _afrouxa_recuo(z, f):
    p = z["parametros"]
    for k in ("recuo_lateral_m", "recuo_fundos_m"):
        if p.get(k):
            p[k] *= f
    for k in ("recuo_lateral_por_altura", "recuo_fundos_por_altura"):
        r = p.get(k)
        if r:
            r["recuo_m"] *= f
            r["acima"]["minimo_m"] *= f
            r["acima"]["fracao_h"] *= f


def _recuo_baixo(z, m):  # o caso da tarefa: recuo dos 2 primeiros pavimentos
    for k in ("recuo_lateral_por_altura", "recuo_fundos_por_altura"):
        if z["parametros"].get(k):
            z["parametros"][k]["recuo_m"] = m


def _fixo(z, r):  # recuo fixo r nas laterais e nos fundos, sem regra por altura nem parede cega (casos mono-recuo-fixo da auditoria)
    p = z["parametros"]
    for k in ("recuo_lateral_por_altura", "recuo_fundos_por_altura"):
        p.pop(k, None)
    p.update(recuo_lateral_m=r, recuo_fundos_m=r, parede_cega_encosta_ate_m=None, pavimentos_max=20)


def monotonia(nome, lote, zona, auditoria=False):
    """Afrouxar uma regra (recuo, CA, TO, altura) NUNCA pode dar menos área privativa em nenhuma opção."""
    def priv(mexe):
        z = copy.deepcopy(zona)
        mexe(z)
        return {o["id"]: o["metricas"]["area_privativa_m2"] for o in gerar_estudo(lote, z)["opcoes"]}

    def altura(h):
        return lambda z: z["parametros"].update(altura_max_m=h)

    def to_mais(z):
        z["parametros"]["taxa_ocupacao"] = min(1.0, z["parametros"]["taxa_ocupacao"] + 0.1)

    def ca_mais(z):
        z["parametros"]["ca_maximo"] *= 1.25

    base = priv(lambda z: None)
    casos = {"recuo -30%": lambda z: _afrouxa_recuo(z, 0.7), "TO +0,1": to_mais, "CA +25%": ca_mais}
    pares = [(base, priv(f), c) for c, f in casos.items()]
    pares.append((priv(altura(45.0)), priv(altura(63.0)), "altura 45 -> 63 m"))
    pares.append((priv(lambda z: _recuo_baixo(z, 2.0)), priv(lambda z: _recuo_baixo(z, 1.5)), "recuo dos 2 primeiros pav. 2,00 -> 1,50"))
    if auditoria:  # as quebras que a auditoria achou: recuo fixo (A, B, D), TO 25 -> 35% (B, D), CA 2,614 -> 2,620 com TO 95% (D)
        pares.append((priv(lambda z: _fixo(z, 2.5)), priv(lambda z: _fixo(z, 2.0)), "recuo fixo 2,50 -> 2,00"))
        pares.append((priv(lambda z: z["parametros"].update(taxa_ocupacao=0.25)), priv(lambda z: z["parametros"].update(taxa_ocupacao=0.35)), "TO 25 -> 35%"))
        pares.append((priv(lambda z: z["parametros"].update(taxa_ocupacao=0.95, ca_maximo=2.614, pavimentos_max=10)),
                      priv(lambda z: z["parametros"].update(taxa_ocupacao=0.95, ca_maximo=2.620, pavimentos_max=10)), "CA 2,614 -> 2,620 (TO 95%)"))
    for antes, depois, caso in pares:
        for id_, a in antes.items():
            assert depois.get(id_, 0) >= a - 0.01, f"{nome}, opção {id_}, {caso}: área privativa {a} -> {depois.get(id_)} (afrouxar piorou)"


def defeitos_da_auditoria(lote, zona):
    # ALTA 1: zona sem CA máximo (null, como a SC-Z6E real) quebrava com TypeError
    z = copy.deepcopy(zona)
    z["parametros"].update(ca_maximo=None, ca_basico=None, altura_max_m=None, pavimentos_max=None)
    e = gerar_estudo(lote, z)
    confere(e)
    assert [o["id"] for o in e["opcoes"]] == ["A", "B", "C", "D"] and e["caixa_maxima"]["area_computavel_max_m2"] is None
    assert any("CA" in i and "pavimentos" in i for i in e["incertezas"]), e["incertezas"]

    # ALTA 6: a permeabilidade mínima vale pra toda opção (perm 35% aperta a caixa; TO 100% + perm 25% aperta a parede cega)
    for mexe in (dict(taxa_permeabilidade=0.35), dict(taxa_ocupacao=1.0, taxa_permeabilidade=0.25)):
        z = copy.deepcopy(zona)
        z["parametros"].update(mexe)
        confere(gerar_estudo(lote, z))

    # ALTA 2: lote em L, subsolo dentro do lote, com permeabilidade apertada (escalar pelo centroide tirava o subsolo do lote)
    em_l = dict(lote, poligono_utm=[[0, 0], [50, 0], [50, 20], [20, 20], [20, 50], [0, 50]], frente=[[0, 0], [50, 0]])
    z = copy.deepcopy(zona)
    z["parametros"].update(taxa_permeabilidade=0.35, parede_cega_encosta_ate_m=None)
    e = gerar_estudo(em_l, z)
    confere(e)
    subs = [v for o in e["opcoes"] for v in o["volumes"] if v["uso"] == "garagem"]
    assert subs, "L sem subsolo desenhado"
    assert all(Polygon(em_l["poligono_utm"]).buffer(0.02).contains(Polygon(v["base_utm"])) for v in subs), "subsolo saiu do lote"

    # ALTA 5: lote em L com a frente no trecho recuado: nada chega a menos do recuo frontal da linha da frente
    rec = dict(lote, poligono_utm=[[0, 0], [50, 0], [50, 50], [35, 50], [35, 20], [0, 20]], frente=[[35, 20], [0, 20]])
    z = copy.deepcopy(zona)
    z["parametros"].update(taxa_ocupacao=0.9, taxa_permeabilidade=0.05)
    e = gerar_estudo(rec, z, {"embasamento_ocupacao": 0.9})
    confere(e)
    rf = e["caixa_maxima"]["recuo_frontal_m"]
    for o in e["opcoes"]:
        for v in o["volumes"]:
            if v["z0_m"] >= 0:
                d = Polygon(v["base_utm"]).distance(LineString(rec["frente"]))
                assert d >= rf - 0.02, f"{o['id']}: {v['uso']} a {d:.2f} m da frente (recuo {rf})"
    # divisa interna do L (paralela à rua, 30 m pra dentro) é lateral, não frente
    c = caixa_recuada(Polygon(em_l["poligono_utm"]), em_l["frente"], 4.0, 1.5, 1.5)
    assert abs(c.bounds[3] - 48.5) < 0.01 and abs(c.bounds[2] - 48.5) < 0.01, c.bounds

    # MÉDIA 8: laje de 80,9 m² dá 55,9 m² privativos por andar, nenhum apartamento de 60 m² (somando os 4 andares dava 3)
    vol = {"uso": "residencial", "pavimentos": 4, "_geom": Polygon([(0, 0), (80.9, 0), (80.9, 1), (0, 1)]), "z0_m": 0, "_pav_abaixo": 0}
    ctx = {"pr": dict(PREMISSAS_PADRAO), "A": 1000.0, "zp": {}, "subsolo": Polygon([(0, 0), (30, 0), (30, 30), (0, 30)])}
    assert _avaliar([vol], ctx)[0]["unidades_estimadas"] == 0

    # MÉDIA 9: subsolo sem área e com vaga a fazer dividia por zero; agora vira alerta de falta de vaga
    sala = {"uso": "residencial", "pavimentos": 3, "_geom": Polygon([(0, 0), (20, 0), (20, 20), (0, 20)]), "z0_m": 0, "_pav_abaixo": 0}
    ctx["subsolo"] = Polygon()
    m, _, av = _avaliar([sala], ctx)
    assert m["vagas"] == 0 and any(a.startswith("Faltam vagas") for a in av), (m["vagas"], av)

    # BAIXA 15: lote menor que o mínimo da zona vira incerteza (o exemplo tem lote_min_m2 200 e testada_min_m 10)
    peq = dict(lote, poligono_utm=[[0, 0], [8, 0], [8, 20], [0, 20]], frente=[[0, 0], [8, 0]])
    inc = gerar_estudo(peq, zona)["incertezas"]
    assert any("abaixo do mínimo da zona" in i and "Lote" in i for i in inc) and any("Testada" in i for i in inc), inc

    # MÉDIA 12: frente sem comprimento e polígono que se cruza não quebram; viram incerteza
    e = gerar_estudo(dict(lote, frente=[lote["frente"][0], lote["frente"][0]]), zona)
    assert e["opcoes"] and any("pontos iguais" in i for i in e["incertezas"]), e["incertezas"]
    laco = dict(lote, poligono_utm=[[0, 0], [50, 30], [50, 0], [0, 25]], frente=[[0, 0], [50, 0]])
    assert gerar_estudo(laco, zona)["incertezas"]


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

    # contagem v4: térreo = pavimento 1. "1,50 m no térreo e no 1º pavimento" = ate_pavimento 2
    regra = {"ate_pavimento": 2, "recuo_m": 1.5, "acima": {"fracao_h": 0.125, "minimo_m": 2.0}}
    zp6 = {"recuo_lateral_por_altura": regra, "recuo_fundos_por_altura": regra}
    assert recuo_divisa(zp6, 1.5, 1, 4.5) == 1.5     # térreo
    assert recuo_divisa(zp6, 1.5, 2, 7.5) == 1.5     # 1º pavimento acima do térreo
    assert recuo_divisa(zp6, 1.5, 3, 10.5) == 2.0    # 2º acima: max(10,5/8, 2,0)
    assert recuo_divisa(zp6, 1.5, 17, 52.5) == 52.5 / 8
    zona6 = copy.deepcopy(zona)
    zona6["parametros"].update(zp6, parede_cega_encosta_ate_m=None)
    e6 = gerar_estudo(lote, zona6)
    confere(e6)
    base6 = next(o for o in e6["opcoes"] if o["id"] == "D")["volumes"][0]
    assert base6["pavimentos"] == 2 and base6["recuo_lateral_m"] == 1.5, base6  # embasamento térreo + 1: 1,50 m

    # zona do terreno (v4): vai adiante no lote e vira incerteza; não se confunde com os números da zona
    assert e["lote"]["zona_origem"] == "teste" and e["lote"]["zona_conferida"] is False
    assert any(i.startswith("Terreno na zona") and "NÃO conferido" in i and "testar" in i for i in e["incertezas"])
    e5 = gerar_estudo(dict(lote, zona_origem="oficial", zona_conferida=True), zona)
    assert any(i.startswith("Terreno na zona") and ": conferido (pelo mapa" in i for i in e5["incertezas"])

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
    e4 = gerar_estudo(lote, zona4, {"embasamento_ocupacao": 0.9})  # base de 90% do lote só cabe encostando na divisa
    confere(e4)
    d4 = next(o for o in e4["opcoes"] if o["id"] == "D")
    assert d4["volumes"][0].get("parede_cega"), "com TO 90% a base com parede cega devia ganhar"

    # 5) lote real pequeno (~300 m²): o que não cabe some, sem quebrar
    pequeno = dict(lote, poligono_utm=[[0, 0], [12, 0], [12, 25], [0, 25]], frente=[[0, 0], [12, 0]])
    confere(gerar_estudo(pequeno, zona))

    # 6) monotonia, no exemplo e em 2 lotes-piloto (SC-Z2 remembrado e SC-Z1 com gabarito aeronáutico sem altura)
    viab = os.path.join(AQUI, "..")
    with open(os.path.join(viab, "terreno", "lotes-piloto.json"), encoding="utf-8") as f:
        pilotos = {l["id"]: l for l in json.load(f)}
    with open(os.path.join(viab, "lei", "zonas.json"), encoding="utf-8") as f:
        zonas = {z["id"]: z for z in json.load(f)}
    monotonia("exemplo SC-Z2", lote, zona, auditoria=True)
    for id_ in ("SC-completo-remembramento-75352-75354", "SC-completo-22426"):
        monotonia(id_, pilotos[id_], zonas[pilotos[id_]["zona_id"]])
    defeitos_da_auditoria(lote, zona)
    print("ok")


if __name__ == "__main__":
    main()

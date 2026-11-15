"""Teste curto do motor. Falha se volume sair do lote/caixa, se CA/TO/altura passarem do máximo
ou se a mesma entrada der arquivo diferente.

    python -I viabilidade/motor/test_motor.py
"""
import copy
import json
import math
import os
import sys
import re
import hashlib
import threading
from concurrent.futures import Future, ProcessPoolExecutor, ThreadPoolExecutor
from functools import lru_cache
from pathlib import Path
from unittest.mock import patch

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from shapely import affinity  # noqa: E402
from shapely.geometry import LineString, Point, Polygon  # noqa: E402
from shapely.ops import unary_union  # noqa: E402

from utm import para_utm23s  # noqa: E402
from motor import AVISO_GARAGEM, PREMISSAS_PADRAO, _avaliar, _chave, _maior_lamina, caixa_recuada, dois_quadrados, gerar_estudo, maior_retangulo, recuo_divisa  # noqa: E402
from dominio import AVISO_FORA, carregar, classificar, construir, corpus, medir  # noqa: E402


# Velocidade: o tempo todo está em gerar_estudo (cada chamada é independente). Dentro de main() as chamadas vão para
# um conjunto de processos e o mesmo (lote, zona, premissas) é calculado uma vez só; as conferências continuam aqui,
# uma a uma, sobre o mesmo resultado. Fora de main() (sem processos) _ge chama o motor direto.
_PROC = _FIOS = None
_ESTUDOS, _TRAVA = {}, threading.Lock()


def _ge(lote, zona, premissas=None):
    """gerar_estudo sem repetir. NÃO usar onde o teste precisa de uma geração nova (determinismo) nem com patch."""
    if _PROC is None:
        return gerar_estudo(lote, zona, premissas)
    chave = json.dumps([lote, zona, premissas], ensure_ascii=False)
    with _TRAVA:
        f = _ESTUDOS.get(chave)
        if f is None:  # cópia profunda: quem chamou pode mexer no dict logo depois, e o envio aos processos é assíncrono
            f = _ESTUDOS[chave] = _PROC.submit(gerar_estudo, *copy.deepcopy((lote, zona, premissas)))
    return f.result()


def _fio(fn, *args):
    """Roda fn em outra thread (só espera resultado dos processos) e devolve um Future."""
    if _FIOS is not None:
        return _FIOS.submit(fn, *args)
    f = Future()
    try:
        f.set_result(fn(*args))
    except BaseException as erro:  # noqa: BLE001  (o erro volta no .result(), como na thread)
        f.set_exception(erro)
    return f


def _pre(fn, itens):
    """Dispara fn para todos os itens ao mesmo tempo e espera; o que fn guarda em cache fica pronto para o teste."""
    for f in [_fio(fn, i) for i in itens]:
        f.result()


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
            if v["z0_m"] < 0:
                assert caixa.buffer(0.02).contains(base), f"{o['id']}: subsolo saiu da caixa do térreo"
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
                un += v["pavimentos"] * math.floor((por_andar + 1e-9) / pr["area_privativa_por_unidade_m2"])
        assert un == m["unidades_estimadas"], f"{o['id']}: unidades {m['unidades_estimadas']} != {un} contadas por andar"
        assert un >= 1, f"{o['id']}: opção sem nenhum apartamento"
        assert m["pavimentos"] <= pr["pavimentos_max_projeto"], f"{o['id']}: {m['pavimentos']} pavimentos passou do teto de projeto"
        # vaga que falta nunca some calada
        if pr["garagem"] == "subsolo" and m["vagas"] < math.ceil(m["unidades_estimadas"] * pr["vagas_por_unidade"] - 1e-9):
            assert any(a.startswith("Faltam vagas") for a in o["alertas"]), f"{o['id']}: vagas caíram sem alerta"
        assert m["to_usada"] <= (zp.get("taxa_ocupacao") or 1) + 1e-3, f"{o['id']}: TO passou"
        assert m["area_garagem_m2"] >= m["vagas"] * pr["area_por_vaga_m2"] - 0.01 or any(a.startswith("Faltam vagas") for a in o["alertas"]), f"{o['id']}: vagas não cabem na geometria do subsolo"
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


def _sumico(z, r):  # caso sumico-d da auditoria: CA 1,5, recuo fixo r, sem parede cega
    z.update(ca_maximo=1.5, recuo_lateral_m=r, recuo_fundos_m=r, recuo_lateral_por_altura=None, recuo_fundos_por_altura=None, parede_cega_encosta_ate_m=None)


def monotonia(nome, lote, zona, auditoria=False, assimetrico=False):
    """Afrouxar uma regra (recuo, CA, TO, altura) NUNCA pode dar menos apartamentos em nenhuma opção; com as mesmas
    unidades, nunca menos área privativa. (O "melhor" do motor é essa ordem: mais unidades, depois mais privativa.)"""
    def res(mexe, l=lote):  # devolve um Future: os estudos do par são calculados juntos, a comparação vem depois
        z = copy.deepcopy(zona)
        mexe(z["parametros"])
        return _fio(lambda: {o["id"]: (o["metricas"]["unidades_estimadas"], o["metricas"]["area_privativa_m2"]) for o in _ge(l, z)["opcoes"]})

    def altura(h):
        return lambda p: p.update(altura_max_m=h)

    def to_mais(p):
        p["taxa_ocupacao"] = min(1.0, p["taxa_ocupacao"] + 0.1)

    def ca_mais(p):
        p["ca_maximo"] *= 1.25

    def recuo(f):
        return lambda p: _afrouxa_recuo({"parametros": p}, f)

    base = res(lambda p: None)
    casos = {"recuo -30%": recuo(0.7), "TO +0,1": to_mais, "CA +25%": ca_mais}
    pares = [(base, res(f), c) for c, f in casos.items()]
    pares.append((res(altura(45.0)), res(altura(63.0)), "altura 45 -> 63 m"))
    pares.append((res(lambda p: _recuo_baixo({"parametros": p}, 2.0)), res(lambda p: _recuo_baixo({"parametros": p}, 1.5)), "recuo dos 2 primeiros pav. 2,00 -> 1,50"))
    if assimetrico:
        pares.append((res(lambda p: p.update(recuo_fundos_m=10)), res(lambda p: p.update(recuo_fundos_m=3)), "fundos 10 -> 3 m, lateral 1,5 m, permeabilidade apertada"))
    if auditoria:  # as quebras que a auditoria achou
        fixo = lambda r: (lambda p: _fixo({"parametros": p}, r))  # noqa: E731
        pares.append((res(fixo(2.5)), res(fixo(2.0)), "recuo fixo 2,50 -> 2,00"))
        pares.append((res(lambda p: p.update(taxa_ocupacao=0.25)), res(lambda p: p.update(taxa_ocupacao=0.35)), "TO 25 -> 35% (B caía de 64 pra 60 unidades)"))
        pares.append((res(lambda p: p.update(taxa_ocupacao=0.95, ca_maximo=2.614, pavimentos_max=10)),
                      res(lambda p: p.update(taxa_ocupacao=0.95, ca_maximo=2.620, pavimentos_max=10)), "CA 2,614 -> 2,620 (TO 95%)"))
        l22 = dict(lote, poligono_utm=[[0, 0], [22, 0], [22, 41], [0, 41]], frente=[[0, 0], [22, 0]])
        pares.append((res(lambda p: _sumico(p, 2.0), l22), res(lambda p: _sumico(p, 1.5), l22), "lote 22x41: recuo 2,0 -> 1,5 (a D sumia)"))
        pares.append((res(lambda p: p.update(ca_maximo=2.0), l22), res(lambda p: p.update(ca_maximo=2.5), l22), "lote 22x41: CA 2,0 -> 2,5 (A e D perdiam apartamento)"))
        # Garagem computável: os pares também verificam monotonia em test_d2.
    for antes, depois, caso in pares:
        antes, depois = antes.result(), depois.result()
        for id_, (ua, pa) in antes.items():
            ud, pd = depois.get(id_, (0, 0))
            assert ud >= ua, f"{nome}, opção {id_}, {caso}: unidades {ua} -> {ud} (afrouxar piorou)"
            assert ud > ua or pd >= pa - 0.1, f"{nome}, opção {id_}, {caso}: mesmas {ua} unidades, privativa {pa} -> {pd} (afrouxar piorou)"


def defeitos_da_auditoria(lote, zona):
    # ALTA 1: zona sem CA máximo (null, como a SC-Z6E real) quebrava com TypeError
    z = copy.deepcopy(zona)
    z["parametros"].update(ca_maximo=None, ca_basico=None, altura_max_m=None, pavimentos_max=None)
    e = _ge(lote, z)
    confere(e)
    assert [o["id"] for o in e["opcoes"]] == ["A", "B", "C", "D"] and e["caixa_maxima"]["area_computavel_max_m2"] is None
    assert any("CA" in i and "pavimentos" in i for i in e["incertezas"]), e["incertezas"]

    # ALTA 6: a permeabilidade mínima vale pra toda opção (perm 35% aperta a caixa; TO 100% + perm 25% aperta a parede cega)
    for mexe in (dict(taxa_permeabilidade=0.35), dict(taxa_ocupacao=1.0, taxa_permeabilidade=0.25)):
        z = copy.deepcopy(zona)
        z["parametros"].update(mexe)
        confere(_ge(lote, z))

    # ALTA 2: lote em L, subsolo dentro do lote, com permeabilidade apertada (escalar pelo centroide tirava o subsolo do lote)
    em_l = dict(lote, poligono_utm=[[0, 0], [50, 0], [50, 20], [20, 20], [20, 50], [0, 50]], frente=[[0, 0], [50, 0]])
    z = copy.deepcopy(zona)
    z["parametros"].update(taxa_permeabilidade=0.35, parede_cega_encosta_ate_m=None)
    e = _ge(em_l, z)
    confere(e)
    subs = [v for o in e["opcoes"] for v in o["volumes"] if v["uso"] == "garagem"]
    assert subs, "L sem subsolo desenhado"
    assert all(Polygon(em_l["poligono_utm"]).buffer(0.02).contains(Polygon(v["base_utm"])) for v in subs), "subsolo saiu do lote"

    # ALTA 5: lote em L com a frente no trecho recuado: nada chega a menos do recuo frontal da linha da frente
    rec = dict(lote, poligono_utm=[[0, 0], [50, 0], [50, 50], [35, 50], [35, 20], [0, 20]], frente=[[35, 20], [0, 20]])
    z = copy.deepcopy(zona)
    z["parametros"].update(taxa_ocupacao=0.9, taxa_permeabilidade=0.05)
    e = _ge(rec, z, {"embasamento_ocupacao": 0.9})
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
    inc = _ge(peq, zona)["incertezas"]
    assert any("abaixo do mínimo da zona" in i and "Lote" in i for i in inc) and any("Testada" in i for i in inc), inc

    # MÉDIA 12: frente sem comprimento e polígono que se cruza não quebram; viram incerteza
    e = _ge(dict(lote, frente=[lote["frente"][0], lote["frente"][0]]), zona)
    assert e["opcoes"] and any("pontos iguais" in i for i in e["incertezas"]), e["incertezas"]
    confere(e)  # a frente degenerada fica corrigida no lote do estudo: confere() dividia por zero nela
    laco = dict(lote, poligono_utm=[[0, 0], [50, 30], [50, 0], [0, 25]], frente=[[0, 0], [50, 0]])
    e = _ge(laco, zona)
    assert e["incertezas"]
    confere(e)  # idem: o polígono em "8" corrigido vai no estudo (confere dava GEOSException)

    # tarefa 4, item 1: opção sem apartamento não é opção (triângulos davam A/C/D, ou B, com 0 unidades)
    tri_e = dict(lote, poligono_utm=[[0, 0], [30, 0], [50, 40]], frente=[[0, 0], [30, 0]])
    tri_s = dict(lote, poligono_utm=[[0, 0], [40, 0], [20, 50]], frente=[[0, 0], [40, 0]])
    for tri in (tri_e, tri_s):
        confere(_ge(tri, zona))  # confere exige unidades >= 1 em toda opção

    # item 4: teto de pavimentos de projeto vale pra toda opção, inclusive embasamento + torre da D
    grande = dict(lote, poligono_utm=[[0, 0], [100, 0], [100, 200], [0, 200]], frente=[[0, 0], [100, 0]])
    for prem, teto in (({}, 30), ({"pavimentos_max_projeto": 8}, 8)):
        e = _ge(grande, zona, prem)
        confere(e)
        assert e["opcoes"] and all(o["metricas"]["pavimentos"] <= teto for o in e["opcoes"]), [o["metricas"]["pavimentos"] for o in e["opcoes"]]
        assert any(a.startswith("Parou no teto de projeto") for o in e["opcoes"] for a in o["alertas"])
    zsem = copy.deepcopy(zona)
    zsem["parametros"].update(ca_maximo=None, ca_basico=None, altura_max_m=None, pavimentos_max=None)
    e = _ge(grande, zsem)  # sem CA: pavimentos_sem_ca (10) também vale pra D, embasamento + torre
    assert all(o["metricas"]["pavimentos"] <= PREMISSAS_PADRAO["pavimentos_sem_ca"] for o in e["opcoes"]), [o["metricas"]["pavimentos"] for o in e["opcoes"]]
    assert "pavimentos_max_projeto" in e["premissas"]["padrao"]

    # item 5: recuo_fundos no triângulo (sem aresta de fundos), degrau interno do L e quina côncava
    tri = Polygon(tri_s["poligono_utm"])
    assert caixa_recuada(tri, tri_s["frente"], 4.0, 1.5, 10.0).distance(Point(20, 50)) >= 10 - 0.02, "triângulo: caixa a menos de 10 m do vértice de fundos"
    aba = Polygon([[0, 0], [40, 0], [40, 15], [20, 15], [20, 60], [0, 60]])
    c = caixa_recuada(aba, [[0, 0], [40, 0]], 4.0, 1.5, 10.0)
    assert c.contains(Point(30, 12.5)), "L: o degrau interno virado pro fundo levou o recuo de fundos (10 m) no meio do lote"
    assert abs(c.bounds[3] - 50.0) < 0.01, c.bounds  # o fundo de verdade (y = 60) leva os 10 m
    recuada = Polygon(rec["poligono_utm"])
    c = caixa_recuada(recuada, rec["frente"], 4.0, 1.5, 1.5)
    assert c.contains(Point(37.5, 17)) and c.contains(Point(37.5, 22)), "L: a faixa da frente (4 m) mordeu a lateral da perna do L"
    assert not c.contains(Point(35.5, 17)) and not c.contains(Point(35.5, 22)), "L: a quina côncava ficou sem recuo"


def auditoria3():
    """Tarefa 5 (auditoria 3): crash no escaleno, recuo de fundos em lote torto, pavimentos_sem_ca com altura, alerta falso, cache mutável."""
    lote, zona = _carrega("lote-exemplo.json"), _carrega("zona-exemplo.json")
    # 3.5.1: triângulo escaleno em UTM: a interseção da torre com a base virava Point e quebrava com AttributeError
    esc = dict(lote, poligono_utm=[[205000, 7564000], [205030, 7564000], [205050, 7564040]], frente=[[205000, 7564000], [205030, 7564000]])
    z = copy.deepcopy(zona)
    z["parametros"].update(recuo_lateral_por_altura=None, recuo_fundos_por_altura=None)
    for zz in (zona, z):
        confere(_ge(esc, zz))
    assert not maior_retangulo(Point(1, 1), 1.0, 100).area and not _maior_lamina(Point(1, 1), 100).area and not dois_quadrados(Point(1, 1), 6.0)

    # 3.5.2-3: recuo de fundos (10 m) em fundo inclinado, triângulo raso e pentágono: nenhuma divisa de fundos a menos de 10 m
    def fundos_ok(pts, frente, nome, rb=10.0):
        poly = Polygon(pts)
        c = caixa_recuada(poly, frente, 4.0, 1.5, rb)
        assert not c.is_empty, nome
        for a, b in zip(pts, pts[1:] + pts[:1]):
            if a == b or {tuple(a), tuple(b)} == {tuple(frente[0]), tuple(frente[1])}:
                continue
            nx, ny = b[1] - a[1], a[0] - b[0]
            if ny > 0.7 * math.hypot(nx, ny):  # normal pra fora apontando pro fundo (+y): é divisa de fundos
                assert c.distance(LineString([a, b])) >= rb - 0.02, f"{nome}: caixa a {c.distance(LineString([a, b])):.2f} m da divisa de fundos {a}->{b}"
    fundos_ok([[0, 0], [40, 0], [40, 50], [0, 30]], [[0, 0], [40, 0]], "trapézio de fundo inclinado")
    fundos_ok([[0, 0], [40, 0], [20, 15]], [[0, 0], [40, 0]], "triângulo raso", rb=3.0)
    assert caixa_recuada(Polygon([[0, 0], [40, 0], [20, 15]]), [[0, 0], [40, 0]], 4.0, 1.5, 10.0).is_empty, "triângulo raso com fundos de 10 m não tem caixa"
    fundos_ok([[0, 0], [40, 0], [40, 45], [20, 50], [0, 30]], [[0, 0], [40, 0]], "pentágono")

    # 3.4.1: sem CA máximo, com altura de cone (90 m): pavimentos_sem_ca (10) ainda vale
    grande = dict(lote, poligono_utm=[[0, 0], [100, 0], [100, 200], [0, 200]], frente=[[0, 0], [100, 0]])
    zsem = copy.deepcopy(zona)
    zsem["parametros"].update(ca_maximo=None, ca_basico=None, altura_max_m=None, pavimentos_max=None)
    e = _ge(dict(grande, areas_especiais=[{"tipo": "cone", "altura_max_m": 90, "fonte": "teste"}]), zsem)
    assert e["opcoes"] and all(o["metricas"]["pavimentos"] <= PREMISSAS_PADRAO["pavimentos_sem_ca"] for o in e["opcoes"]), [o["metricas"]["pavimentos"] for o in e["opcoes"]]
    assert any("pavimentos_sem_ca" in i for i in e["incertezas"]), e["incertezas"]

    # 3.4.2: parar no pavimento 30 porque a ALTURA da lei acaba ali não é "teto de projeto"
    zalt = copy.deepcopy(zona)
    zalt["parametros"].update(ca_maximo=50.0, altura_max_m=4.5 + 29 * 3.0, pavimentos_max=None, recuo_lateral_por_altura=None, recuo_fundos_por_altura=None)
    e = _ge(grande, zalt)
    assert any(o["metricas"]["pavimentos"] == 30 for o in e["opcoes"]), [o["metricas"]["pavimentos"] for o in e["opcoes"]]
    assert not any(a.startswith("Parou no teto de projeto") for o in e["opcoes"] for a in o["alertas"]), "alerta falso: foi a altura da lei que parou"

    # 3.6: a lista do cache não pode ser alterada por quem chama
    r = dois_quadrados(Polygon([[0, 0], [30, 0], [30, 30], [0, 30]]), 6.0, 200)
    assert len(r) == 2 and not hasattr(r, "clear"), type(r)

    # 3.2: garagem que conta no CA (premissa) vira incerteza no estudo
    zg = copy.deepcopy(zona)
    zg["parametros"]["garagem_computavel"] = None  # a zona manda sobre a premissa
    e = _ge(lote, zg, {"garagem_computavel": True})
    assert any("garagem_computavel" in i and "meta de vagas" in i for i in e["incertezas"]), e["incertezas"]
    e = _ge(lote, zona)
    assert not any("monot" in i for i in e["incertezas"])


def tarefa6():
    """Tarefa 6: afrouxar não tira opção com permeabilidade, TO desconta o núcleo, utm recusa ponto fora do fuso."""
    # 3.1: lote 20x35, permeabilidade 50%: a opção B existia com recuo 3,0 m e sumia com 1,5 m
    lote = {"id": "t6", "poligono_utm": [[205000.0, 7564000.0], [205020.0, 7564000.0], [205020.0, 7564035.0], [205000.0, 7564035.0]],
            "frente": [[205000.0, 7564000.0], [205020.0, 7564000.0]], "area_m2": 700.0, "zona_id": "T", "zona_origem": "teste", "zona_conferida": False}
    base = _carrega("zona-exemplo.json")["parametros"]
    base.update(ca_maximo=3.5, ca_basico=2.0, taxa_ocupacao=0.7, taxa_permeabilidade=0.5, recuo_frontal_m=None, altura_max_m=None, pavimentos_max=None,
                recuo_lateral_por_altura=None, recuo_fundos_por_altura=None, parede_cega_encosta_ate_m=None, garagem_computavel=False)
    res = {}
    for r in (3.0, 2.0, 1.5):
        z = {"id": "T", "parametros": dict(base, recuo_lateral_m=r, recuo_fundos_m=r), "conferido": False}
        e = _ge(lote, z)
        confere(e)
        res[r] = {o["id"]: o["metricas"]["unidades_estimadas"] for o in e["opcoes"]}
    assert set(res[3.0]) == set(res[1.5]) == {"A", "B", "C", "D"}, res
    for id_ in res[3.0]:
        assert res[1.5][id_] >= res[2.0][id_] >= res[3.0][id_], (id_, res)

    # MÉDIA 13: TO 20% de 1000 m² = 200 m²; a laje bruta pode ter 200 m² + o núcleo (20 m²), e a TO medida não passa de 20%
    grande = dict(lote, poligono_utm=[[0, 0], [25, 0], [25, 40], [0, 40]], frente=[[0, 0], [25, 0]])
    zt = _carrega("zona-exemplo.json")
    zt["parametros"].update(taxa_ocupacao=0.2, taxa_permeabilidade=0.0, ca_maximo=6.0, recuo_lateral_por_altura=None, recuo_fundos_por_altura=None, parede_cega_encosta_ate_m=None)
    e = _ge(grande, zt)
    confere(e)
    a = next(o for o in e["opcoes"] if o["id"] == "C")
    laje = Polygon(a["volumes"][0]["base_utm"]).area
    assert laje > 200.5 and a["metricas"]["to_usada"] <= 0.2 + 1e-3, (laje, a["metricas"]["to_usada"])

    # BAIXA 16: (lat, lon) invertido e fora do fuso dão erro claro; São Carlos continua convertendo
    assert 190000 < para_utm23s(-47.89, -22.01)[0] < 210000
    for pt in ((-22.01, -47.89), (-60.0, -22.0), (-47.0, 10.0)):
        try:
            para_utm23s(*pt)
        except ValueError as err:
            assert "fuso" in str(err)
        else:
            raise AssertionError(f"utm aceitou {pt}")
    try:
        para_utm23s(-22.01, -47.89)
    except ValueError as err:
        assert "trocado" in str(err)


def tarefa7():
    """Tarefa 7 (auditoria 4): área medida = a do base_utm, rótulo da parede cega, caixa sem altura, subsolo do tamanho das vagas."""
    lote, zona = _carrega("lote-exemplo.json"), _carrega("zona-exemplo.json")

    def retangulo(w, d):
        return dict(lote, poligono_utm=[[0, 0], [w, 0], [w, d], [0, d]], frente=[[0, 0], [w, 0]])

    # ALTA 1: lote 20x40, TO 0,35: a opção B contava 68 unidades na métrica e 34 na geometria exportada (área sem arredondar x base_utm a 1 cm)
    z = copy.deepcopy(zona)
    z["parametros"].update(taxa_ocupacao=0.35, taxa_permeabilidade=0.0, ca_maximo=6.0, recuo_lateral_por_altura=None, recuo_fundos_por_altura=None)
    confere(_ge(retangulo(20, 40), z))  # confere recalcula as unidades pela área do base_utm


def test_alerta_unico_nao_verificada():
    """Tarefa 21: os registros nao_verificada viram UM alerta por opção (as incertezas seguem uma por registro);
    área encontrada sem altura mantém o alerta próprio. 3 nao_verificada + 1 encontrada = exatamente 2 alertas de área especial."""
    lote, zona = _carrega("lote-exemplo.json"), _carrega("zona-exemplo.json")
    nv = lambda anexo: {"tipo": "nao_verificada", "nome": f"nada no {anexo}", "incidencia": "nao_verificada", "conferido": False, "fonte": "teste", "anexo": anexo}
    achada = {"tipo": "gabarito_aeronautico", "nome": "Cone de teste", "incidencia": "dentro", "conferido": False, "fonte": "teste", "anexo": "07"}
    e = _ge(dict(lote, areas_especiais=[nv("05"), nv("06"), achada, nv("06/09-A")]), zona)
    assert e["opcoes"]
    for o in e["opcoes"]:
        esp = [a for a in o["alertas"] if a.startswith("ÁREA ESPECIAL")]
        assert len(esp) == 2, esp
        assert any("gabarito_aeronautico (Cone de teste)" in a for a in esp), esp
        (agrupado,) = [a for a in esp if "nao_verificada" in a]
        assert "Anexo 05, Anexo 06, Anexo 06/09-A" in agrupado and "pode passar do que o terreno permite" in agrupado, agrupado
    assert sum("nao_verificada" in i for i in e["incertezas"]) == 3, e["incertezas"]  # o detalhe fica nas incertezas, um por registro
    # um só registro: continua havendo o alerta; nenhum: nenhum alerta de área especial
    um = _ge(dict(lote, areas_especiais=[nv("05")]), zona)
    assert all(sum(a.startswith("ÁREA ESPECIAL") for a in o["alertas"]) == 1 for o in um["opcoes"])
    zero = _ge(dict(lote, areas_especiais=[]), zona)
    assert not any(a.startswith("ÁREA ESPECIAL") for o in zero["opcoes"] for a in o["alertas"])


def test_d3_rotulo_parede_cega():
    lote, zona = _carrega("lote-exemplo.json"), _carrega("zona-exemplo.json")
    # MÉDIA 4: parede cega só com o recuo que a base de fato tem. Encostada: 0,0. Solta (0,19 m da divisa): 0,19, não "0,0"
    for eo, encosta in ((0.9, True), (0.8, False)):
        z = copy.deepcopy(zona)
        z["parametros"].update(taxa_ocupacao=0.9, taxa_permeabilidade=0.05)
        e = _ge(lote, z, {"embasamento_ocupacao": eo})
        confere(e)
        base = next(o for o in e["opcoes"] if o["id"] == "D")["volumes"][0]
        assert base.get("parede_cega"), base
        dist = Polygon(base["base_utm"]).distance(Polygon(e["lote"]["poligono_utm"]).exterior)
        assert abs(base["recuo_lateral_m"] - dist) < 0.011 and base["recuo_fundos_m"] == base["recuo_lateral_m"], (base["recuo_lateral_m"], dist)
        assert (base["recuo_lateral_m"] == 0) == encosta, base["recuo_lateral_m"]
    d_normal = next(o for o in _ge(lote, zona)["opcoes"] if o["id"] == "D")["volumes"][0]  # zona do exemplo: a base sem parede cega ganha
    assert not d_normal.get("parede_cega") and d_normal["recuo_lateral_m"] == 1.5, d_normal


def test_d4_caixa_sem_altura():
    lote, zona = _carrega("lote-exemplo.json"), _carrega("zona-exemplo.json")
    # BAIXA 5: lote sem nenhuma opção tem caixa de altura 0, e a parede cega não pode subir a 12 m
    e = _ge(dict(lote, poligono_utm=[[0, 0], [10, 0], [10, 15], [0, 15]], frente=[[0, 0], [10, 0]]), zona)
    assert e["opcoes"] == [] and e["caixa_maxima"]["altura_m"] == 0 and e["caixa_maxima"]["parede_cega_ate_m"] == 0, e["caixa_maxima"]


def test_d5_subsolo_dimensionado_pelas_vagas():
    lote, zona = _carrega("lote-exemplo.json"), _carrega("zona-exemplo.json")
    # BAIXA 6: lote enorme (100x200): cada nível de subsolo tem o tamanho das vagas (27 m² por vaga), não a projeção toda
    e = _ge(dict(lote, poligono_utm=[[0, 0], [100, 0], [100, 200], [0, 200]], frente=[[0, 0], [100, 0]]), zona)
    confere(e)
    for o in e["opcoes"]:
        m, subs = o["metricas"], [v for v in o["volumes"] if v["uso"] == "garagem"]
        assert m["vagas"] and subs
        area_subs = sum(Polygon(v["base_utm"]).area for v in subs)
        por_vaga = e["premissas"]["area_por_vaga_m2"]
        assert -0.01 <= area_subs - m["vagas"] * por_vaga < por_vaga + 0.01 and abs(m["area_garagem_m2"] - area_subs) < 0.01, (o["id"], area_subs, m["area_garagem_m2"])
        assert all(Polygon(v["base_utm"]).area < 0.7 * Polygon(e["caixa_maxima"]["projecao_utm"]).area for v in subs)  # antes: 100% da projeção em cada nível


def test_d1_recuo_assimetrico_permeabilidade():
    # 10 m exportados podem medir 9,999999999999996: a tolerância tem que vir antes do piso.
    vol = {"uso": "residencial", "pavimentos": 21, "_geom": Polygon([(7, 23.73), (17, 23.73), (17, 33.73), (7, 33.73)]), "z0_m": 0, "_pav_abaixo": 0}
    ctx = {"pr": dict(PREMISSAS_PADRAO, vagas_por_unidade=0), "A": 960, "zp": {}, "subsolo": Polygon()}
    assert _avaliar([vol], ctx)[0]["unidades_estimadas"] == 21
    for w, h, perm in ((22, 35, 0.5), (24, 40, 0.55)):
        lote = dict(_carrega("lote-exemplo.json"), poligono_utm=[[0, 0], [w, 0], [w, h], [0, h]], frente=[[0, 0], [w, 0]])
        zona = _carrega("zona-exemplo.json")
        zona["parametros"].update(ca_maximo=3.5, taxa_permeabilidade=perm, recuo_lateral_m=1.5, recuo_fundos_m=10,
                                  recuo_lateral_por_altura=None, recuo_fundos_por_altura=None)
        monotonia(f"D1 {w}x{h}", lote, zona, assimetrico=True)
        for fundos in (10, 3):
            zona["parametros"]["recuo_fundos_m"] = fundos
            confere(_ge(lote, zona))


@lru_cache(maxsize=64)  # os testes só leem estes estudos; D2 e as matrizes reutilizam os mesmos casos
def _regera_caso(nome):
    casos = Path(AQUI).parent / "auditoria" / "casos"
    e = json.loads((casos / nome).read_text(encoding="utf-8"))
    if e.get("erro"):  # dois registros antigos guardam só a exceção; reproduzir com as entradas originais
        lote, zona = {"saida-frente-repetida.json": ("lote-frente-repetida.json", "zona-base.json"),
                      "saida-zona-sem-ca-maximo.json": ("lote-base.json", "zona-sem-ca-maximo.json")}[nome]
        return _ge(json.loads((casos / lote).read_text(encoding="utf-8")), json.loads((casos / zona).read_text(encoding="utf-8")))
    premissas = {k: v for k, v in e["premissas"].items() if k != "padrao" and k not in e["premissas"]["padrao"]}
    return _ge(e["lote"], e["zona"], premissas)


def test_d2_metricas_subsolo_final():
    estudos = [_regera_caso(f"saida-gc-ca50-recuo-{recuo}.json") for recuo in ("3m0", "1m5")]
    for recuo in (2.5, 2.0, 1.5):
        z = _carrega("zona-exemplo.json")
        _fixo(z, recuo)
        z["parametros"]["garagem_computavel"] = True
        estudos.append(_ge(_carrega("lote-exemplo.json"), z))
    for e in estudos:
        confere(e)
        assert AVISO_GARAGEM in e["incertezas"]
        for o in e["opcoes"]:
            subs = [v for v in o["volumes"] if v["uso"] == "garagem"]
            garagem = sum(Polygon(v["base_utm"]).area for v in subs)
            m = o["metricas"]
            ocupado = unary_union([Polygon(v["base_utm"]) for v in o["volumes"]]).area
            assert abs(m["area_garagem_m2"] - garagem) < 0.01
            acima = sum(Polygon(v["base_utm"]).area * v["pavimentos"] for v in o["volumes"] if v["uso"] != "garagem")
            assert abs(m["area_construida_m2"] - acima - garagem) < 0.01
            assert abs(m["area_permeavel_m2"] - (Polygon(e["lote"]["poligono_utm"]).area - ocupado)) < 0.01
            assert 0 < len(subs) <= e["premissas"]["subsolos_max"]
            assert [v["z0_m"] for v in subs] == [-e["premissas"]["pe_direito_m"] * (i + 1) for i in range(len(subs))]
    for a, b in ((0, 1), (2, 3), (3, 4)):
        _par_monotono(estudos[a], estudos[b], f"garagem computável D2 {a}->{b}")
    for a, b in (("saida-garagem-comp-2m5.json", "saida-garagem-comp-2m0.json"), ("audit5-saida-gc-r3m0.json", "audit5-saida-gc-r1m5.json")):
        _par_monotono(_regera_caso(a), _regera_caso(b), f"garagem computável {a}->{b}")


def test_d6_opcoes_ausentes_classificadas():
    lote, zona = _carrega("lote-exemplo.json"), _carrega("zona-exemplo.json")
    for prem, motivo, trecho in (({"laje_minima_m2": 10000}, "impossivel", "10000"),
                                 ({"area_privativa_por_unidade_m2": 10000}, "busca_inconclusiva", "CA disponível")):
        e = _ge(lote, zona, prem)
        assert len(e["opcoes_ausentes"]) == 4 and not e["opcoes"]
        for o in e["opcoes_ausentes"]:
            assert o["motivo"] == motivo and trecho in o["detalhe"], o
            assert any(o["detalhe"] in i for i in e["incertezas"])
    z = copy.deepcopy(zona)
    z["parametros"]["altura_max_m"] = 3
    e = _ge(lote, z)
    c = next(o for o in e["opcoes_ausentes"] if o["id"] == "C")
    assert c["motivo"] == "impossivel" and "altura 3.00 m" in c["detalhe"]
    for erro, motivo in ((KeyError("parametro_teste"), "dados_insuficientes"), (RuntimeError("falha de teste"), "erro")):
        with patch("motor._maior_lamina", side_effect=erro):
            e = gerar_estudo(lote, zona)
        c = next(o for o in e["opcoes_ausentes"] if o["id"] == "C")
        assert c["motivo"] == motivo and str(erro).strip("'") in c["detalhe"], c


def test_d7_criterio_reflete_chave():
    e = _ge(_carrega("lote-exemplo.json"), _carrega("zona-exemplo.json"))
    ordem = e["criterio_escolha"]["ordem"]
    assert ordem == ["unidades_estimadas desc", "area_privativa_m2 desc"]
    for o in e["opcoes"]:
        assert _chave((None, o["metricas"])) == tuple(o["metricas"][campo.split()[0]] for campo in ordem)
    assert e["versao_motor"] == "0.8.3"


def test_d8_aviso_apenas_garagem_computavel_com_vagas():
    lote, zona = _carrega("lote-exemplo.json"), _carrega("zona-exemplo.json")
    for gc, vagas in ((True, 1), (False, 1), (True, 0)):
        zona["parametros"]["garagem_computavel"] = gc
        e = _ge(lote, zona, {"vagas_por_unidade": vagas})
        assert (AVISO_GARAGEM in e["incertezas"]) == (gc and vagas > 0)
        assert any("garagem_computavel" in i and "meta de vagas" in i for i in e["incertezas"]) == (gc and vagas > 0)


def test_42_casos_auditoria():
    casos = sorted((Path(AQUI).parent / "auditoria" / "casos").glob("saida-*.json"))
    assert len(casos) == 42, len(casos)
    _pre(_regera_caso, [c.name for c in casos])
    for caso in casos:
        e = _regera_caso(caso.name)
        assert not any(o["motivo"] in ("erro", "dados_insuficientes") for o in e["opcoes_ausentes"]), (caso.name, e["opcoes_ausentes"])
        try:
            confere(e)
        except AssertionError as erro:
            raise AssertionError(f"{caso.name}: {erro}") from erro


def _par_monotono(antes, depois, nome):
    a = {o["id"]: (o["metricas"]["unidades_estimadas"], o["metricas"]["area_privativa_m2"]) for o in antes["opcoes"]}
    b = {o["id"]: (o["metricas"]["unidades_estimadas"], o["metricas"]["area_privativa_m2"]) for o in depois["opcoes"]}
    for id_, (un, area) in a.items():
        un2, area2 = b.get(id_, (0, 0))
        assert un2 >= un and (un2 > un or area2 >= area - 0.1), (nome, id_, a[id_], b.get(id_))


def _impossivel_com_prova(e):
    pr, zp = e["premissas"], e["zona"]["parametros"]
    poly = Polygon(e["lote"]["poligono_utm"])
    legal = caixa_recuada(poly, e["lote"]["frente"], e["caixa_maxima"]["recuo_frontal_m"], zp.get("recuo_lateral_m") or 0, zp.get("recuo_fundos_m") or 0).area
    for o in e["opcoes_ausentes"]:
        if o["motivo"] != "impossivel":
            continue
        m = re.search(r"no máximo ([\d.]+) m²", o["detalhe"])
        if m:
            k = 2 if o["id"] == "B" else 1
            limite = min(legal, (zp.get("taxa_ocupacao") or 1) * poly.area + k * pr["nucleo_nao_computavel_m2"], (1 - (zp.get("taxa_permeabilidade") or 0)) * poly.area) / k
            if o["id"] != "C":
                limite = min(limite, pr["laje_torre_max_m2"])
            assert abs(float(m[1]) - limite) < 0.011 and limite < pr["laje_minima_m2"], o
        else:
            minimo = pr["pe_direito_terreo_m"] + (pr["pavimentos_embasamento"] * pr["pe_direito_m"] if o["id"] == "D" else 0)
            alturas = [zp.get("altura_max_m")] + [a.get("altura_max_m") for a in e["lote"].get("areas_especiais") or []]
            cap = min(pr["pavimentos_max_projeto"], zp.get("pavimentos_max") or math.inf)
            assert any(h and h < minimo for h in alturas) or cap <= (pr["pavimentos_embasamento"] if o["id"] == "D" else 0), o


def test_tarefa10():
    _pre(_regera_caso, [p.name for p in sorted((Path(AQUI).parent / "auditoria" / "casos").glob("audit5-saida-*.json"))])
    estudos = {p.stem.removeprefix("audit5-saida-"): _regera_caso(p.name) for p in sorted((Path(AQUI).parent / "auditoria" / "casos").glob("audit5-saida-*.json"))}
    for e in estudos.values():
        confere(e)
        _impossivel_com_prova(e)
    for a, b in (("perm55", "perm25"), ("trap-rb10", "trap-rb02"), ("trap-to20", "trap-to50"), ("trap-perm55", "trap-perm15")):
        _par_monotono(estudos[a], estudos[b], f"audit5 {a} -> {b}")
    assert {"A", "C"} <= {o["id"] for o in estudos["impossivel-falso-13x40"]["opcoes"]}
    assert "D" in {o["id"] for o in estudos["impossivel-falso-d-cega"]["opcoes"]}
    for nome in ("haltere-subsolo", "em-l-ca32"):
        for o in estudos[nome]["opcoes"]:
            assert o["metricas"]["area_garagem_m2"] >= o["metricas"]["vagas"] * estudos[nome]["premissas"]["area_por_vaga_m2"] - 0.01


def test_8b_linha_de_base(estudos):
    """Contagens extraídas dos oito estudos versionados em 06ba272a (motor 0.7.1)."""
    base = _carrega("linha-de-base-0.7.1.json")
    conteudo_081 = _carrega("linha-de-base-0.8.1.json")["sha256"]
    quedas_justificadas = []  # entradas {arquivo, opcao, motivo}: só para regra corrigida e comprovada
    assert len(base) == 8 and set(base) == set(estudos)
    ausente_a = next(o for o in estudos["pilotos/SC-completo-22426.json"]["opcoes_ausentes"] if o["id"] == "A")
    assert "Melhor pavimento tentado: 1 pavimento(s), 0 unidade(s)" in ausente_a["detalhe"], ausente_a
    for arquivo, opcoes in base.items():
        assert estudos[arquivo] == _carrega(arquivo), f"{arquivo} desatualizado: rode gerar_pilotos.py"
        aditivo = copy.deepcopy(estudos[arquivo])
        assert aditivo.pop("dominio")["status"] == "dentro", arquivo
        del aditivo["versao_motor"]
        aditivo["incertezas"] = [i for i in aditivo["incertezas"] if i != AVISO_FORA]
        resumo = hashlib.sha256(json.dumps(aditivo, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")).hexdigest()
        assert resumo == conteudo_081[arquivo], f"{arquivo}: tarefa 11 alterou conteúdo anterior à classificação"
        _impossivel_com_prova(estudos[arquivo])
        for ausente in estudos[arquivo]["opcoes_ausentes"]:
            assert not re.search(r"\d+\.\d{3,}", ausente["detalhe"]), ausente
        atuais = {o["id"]: o["metricas"]["unidades_estimadas"] for o in estudos[arquivo]["opcoes"]}
        for opcao, unidades in opcoes.items():
            if atuais.get(opcao, 0) < unidades:
                assert any(q["arquivo"] == arquivo and q["opcao"] == opcao and q["motivo"].strip()
                           for q in quedas_justificadas), (arquivo, opcao, unidades, atuais.get(opcao, 0))


def test_dominio():
    dominio = carregar()
    assert construir() == dominio, "domínio desatualizado: rode dominio.py e revise as faixas"
    for nome, e in corpus():
        d = classificar(e["lote"], e.get("zona"), e.get("premissas"))
        assert d["status"] in ("dentro", "dados_insuficientes"), (nome, d)
        assert d["status"] == "dentro" or d["motivos"], (nome, d)
    lote, zona = _carrega("lote-exemplo.json"), _carrega("zona-exemplo.json")
    assert classificar(dict(lote, zona_conferida=False), zona)["status"] == "dentro"
    for pontos, frente, motivo in (
        ([[0, 0], [2000, 0], [2000, 2000], [0, 2000]], [[0, 0], [2000, 0]], "área do lote"),
        ([[0, 0], [50, 0], [50, 50], [47, 50], [47, 3], [3, 3], [3, 50], [0, 50]], [[0, 0], [50, 0]], "convexidade"),
        ([[0, 0], [40, 0], [0, 400]], [[0, 0], [0, 100]], "menor ângulo interno"),
    ):
        l = dict(lote, poligono_utm=pontos, frente=frente)
        e = _ge(l, zona)
        assert e["dominio"]["status"] == "fora" and any(motivo in m for m in e["dominio"]["motivos"]), e["dominio"]
        assert e["incertezas"].count(AVISO_FORA) == 1
        if motivo == "área do lote":
            assert e["opcoes"], "fora não deve apagar opções"
        reverso = medir(dict(l, poligono_utm=list(reversed(pontos))), zona)[0]
        original = medir(l, zona)[0]
        assert math.isclose(reverso["angulo_min_graus"], original["angulo_min_graus"], abs_tol=1e-9)
    for l, z, motivo in (({k: v for k, v in lote.items() if k != "frente"}, zona, "frente"),
                         ({k: v for k, v in lote.items() if k != "poligono_utm"}, zona, "polígono"),
                         (lote, None, "zona"), (lote, {k: v for k, v in zona.items() if k != "id"}, "zona"),
                         (lote, {k: v for k, v in zona.items() if k != "parametros"}, "parâmetros")):
        e = _ge(l, z)
        assert e["dominio"]["status"] == "dados_insuficientes" and any(motivo in m for m in e["dominio"]["motivos"])
        assert not e["opcoes"] and all(o["motivo"] == "dados_insuficientes" for o in e["opcoes_ausentes"])
    repetido = dict(lote, poligono_utm=lote["poligono_utm"] + [lote["poligono_utm"][0]])
    assert medir(repetido, zona)[0] == medir(lote, zona)[0]
    assert classificar(lote, dict(zona, id="ZONA-NAO-TESTADA"))["status"] == "fora"
    for area, status in ((20010, "dentro"), (20040, "fora")):
        l = dict(lote, poligono_utm=[[0, 0], [100, 0], [100, area / 100], [0, area / 100]], frente=[[0, 0], [100, 0]])
        assert classificar(l, zona)["status"] == status
    for chave in ("ca_basico", "ca_maximo", "taxa_ocupacao", "taxa_permeabilidade"):
        z = copy.deepcopy(zona)
        z["parametros"][chave] = dominio["faixas"][chave]["max"] * 2
        assert classificar(lote, z)["status"] == "fora", chave
        del z["parametros"][chave]
        assert classificar(lote, z)["status"] == "dados_insuficientes", chave


def test_revisao1():
    pasta = Path(AQUI).parent / "revisao" / "casos"
    pares = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(pasta.glob("*.json"))]
    pares = [p for p in pares if "antes" in p]
    assert len(pares) == 12
    _pre(lambda p: [_ge(p["lote"], p[k], p["premissas"]) for k in ("antes", "depois")], pares)
    for p in pares:
        estudos = [_ge(p["lote"], p[k], p["premissas"]) for k in ("antes", "depois")]
        for e in estudos:
            confere(e)
            assert (AVISO_GARAGEM in e["incertezas"]) == (e["premissas"]["garagem_computavel"] and e["premissas"]["vagas_por_unidade"] > 0)
        _par_monotono(*estudos, p["id"])
        anterior = json.loads((pasta / (p["id"] + "-antes-saida.json")).read_text(encoding="utf-8"))
        _par_monotono(anterior, estudos[0], p["id"] + " contra 0.8.1")
        anterior["zona"], anterior["caixa_maxima"] = p["depois"], estudos[1]["caixa_maxima"]
        confere(anterior)  # testemunha: a implantação/subsolo anterior ainda é legal na regra nova


def secoes_1_a_5():
    lote, zona = _carrega("lote-exemplo.json"), _carrega("zona-exemplo.json")

    # 1) exemplo: 4 opções, todas dentro dos limites, e o arquivo gravado bate com o que o motor gera agora
    e = _ge(lote, zona)
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
    e2 = _ge(lote2, zona2, {"garagem_computavel": True, "preco_venda_m2_privativo": 9000})
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
    e6 = _ge(lote, zona6)
    confere(e6)
    base6 = next(o for o in e6["opcoes"] if o["id"] == "D")["volumes"][0]
    assert base6["pavimentos"] == 2 and base6["recuo_lateral_m"] == 1.5, base6  # embasamento térreo + 1: 1,50 m

    # zona do terreno (v4): vai adiante no lote e vira incerteza; não se confunde com os números da zona
    assert e["lote"]["zona_origem"] == "teste" and e["lote"]["zona_conferida"] is False
    assert any(i.startswith("Terreno na zona") and "NÃO conferido" in i and "testar" in i for i in e["incertezas"])
    e5 = _ge(dict(lote, zona_origem="oficial", zona_conferida=True), zona)
    assert any(i.startswith("Terreno na zona") and ": conferido (pelo mapa" in i for i in e5["incertezas"])

    # 3) gabarito de área especial (centro histórico, 9 m) e zona sem regra por altura
    zona3 = copy.deepcopy(zona)
    for k in ("recuo_lateral_por_altura", "recuo_fundos_por_altura"):
        zona3["parametros"].pop(k, None)
    e3 = _ge(dict(lote, areas_especiais=[{"tipo": "gabarito", "altura_max_m": 9, "fonte": "teste"}]), zona3)
    confere(e3)
    assert e3["opcoes"] and all(v["z0_m"] + v["altura_m"] <= 9 for o in e3["opcoes"] for v in o["volumes"])

    # 4) TO alta: o embasamento com parede cega (encostado na divisa até 12 m) ocupa mais e ganha
    zona4 = copy.deepcopy(zona)
    zona4["parametros"].update(taxa_ocupacao=0.9, taxa_permeabilidade=0.05)
    e4 = _ge(lote, zona4, {"embasamento_ocupacao": 0.9})  # base de 90% do lote só cabe encostando na divisa
    confere(e4)
    d4 = next(o for o in e4["opcoes"] if o["id"] == "D")
    assert d4["volumes"][0].get("parede_cega"), "com TO 90% a base com parede cega devia ganhar"

    # 5) lote real pequeno (~300 m²): o que não cabe some, sem quebrar
    pequeno = dict(lote, poligono_utm=[[0, 0], [12, 0], [12, 25], [0, 25]], frente=[[0, 0], [12, 0]])
    confere(_ge(pequeno, zona))



def _pilotos_e_zonas():
    viab = os.path.join(AQUI, "..")
    with open(os.path.join(viab, "terreno", "lotes-piloto.json"), encoding="utf-8") as f:
        pilotos = {l["id"]: l for l in json.load(f)}
    with open(os.path.join(viab, "lei", "zonas.json"), encoding="utf-8") as f:
        zonas = {z["id"]: z for z in json.load(f)}
    return pilotos, zonas


def secao6_linha_de_base():
    # 6) todo piloto gera estudo e passa no confere (o 22421 quebrava com região de área zero), e a linha de base 0.7.1/0.8.1
    lote, zona = _carrega("lote-exemplo.json"), _carrega("zona-exemplo.json")
    pilotos, zonas = _pilotos_e_zonas()
    estudos = {"estudo-exemplo.json": _ge(lote, zona)}  # o mesmo estudo que a seção 1 já conferiu
    _pre(lambda l: _ge(l, zonas[l["zona_id"]]), pilotos.values())
    for l in pilotos.values():
        estudo = _ge(l, zonas[l["zona_id"]])
        confere(estudo)
        estudos[f"pilotos/{l['id']}.json"] = estudo
    test_8b_linha_de_base(estudos)  # reutiliza as oito gerações já conferidas, sem duplicar a busca


def main():
    """Os grupos são independentes: rodam juntos (cada um numa thread) e mandam as gerações para um conjunto de processos.
    Só test_d6 fica por último e sozinho, porque troca `motor._maior_lamina` por um patch e isso vale pro processo todo."""
    global _PROC, _FIOS
    lote, zona = _carrega("lote-exemplo.json"), _carrega("zona-exemplo.json")
    pilotos, zonas = _pilotos_e_zonas()
    grupos = [  # os mais caros primeiro
        test_d1_recuo_assimetrico_permeabilidade,
        # 6) monotonia, no exemplo e em 2 lotes-piloto (SC-Z2 remembrado e SC-Z1 com gabarito aeronáutico sem altura)
        lambda: monotonia("exemplo SC-Z2", lote, zona, auditoria=True),
        *[(lambda id_=id_: monotonia(id_, pilotos[id_], zonas[pilotos[id_]["zona_id"]]))
          for id_ in ("SC-completo-remembramento-75352-75354", "SC-completo-22426")],
        test_42_casos_auditoria,
        test_tarefa10,
        test_revisao1,
        secao6_linha_de_base,
        tarefa6,
        lambda: defeitos_da_auditoria(lote, zona),
        secoes_1_a_5,
        auditoria3,
        tarefa7,
        test_d2_metricas_subsolo_final,
        test_d3_rotulo_parede_cega,
        test_alerta_unico_nao_verificada,
        test_d4_caixa_sem_altura,
        test_d5_subsolo_dimensionado_pelas_vagas,
        test_d7_criterio_reflete_chave,
        test_d8_aviso_apenas_garagem_computavel_com_vagas,
        test_dominio,
    ]
    with ProcessPoolExecutor() as _PROC, ThreadPoolExecutor(128) as _FIOS, ThreadPoolExecutor(len(grupos)) as threads:
        for f in [threads.submit(g) for g in grupos]:
            f.result()
    _PROC = _FIOS = None
    test_d6_opcoes_ausentes_classificadas()
    print("ok")


if __name__ == "__main__":
    main()

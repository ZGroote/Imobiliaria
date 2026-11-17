"""Núcleo do editor manual (PA-G1), sem tela: operações sobre uma DesignRevision selada.

Cada operação recebe uma revisão selada e devolve `(revisao_nova, achados)`. A entrada nunca é alterada.
A nova revisão é selada, com `parent_revision_id` = id da anterior e `revision_id` = hash de
(selo do pai + operação + parâmetros): sem relógio nem `random`, a mesma sequência dá os mesmos bytes.

Toda saída passa por `validador.validar`. Violação, erro técnico ou premissa do gerador não atendida
(acesso, fachada, lado mínimo, área mínima) recusa a operação com `EdicaoRecusada` (nenhuma revisão sai).
`forcar=True` deixa sair, marcando `metrics_summary.edicao.forcada` e listando as violações.

Só mexe em unidades retangulares, no formato do gerador: contorno [[0,0],[w,0],[w,d],[0,d]], arestas
0=baixo, 1=direita, 2=cima, 3=esquerda no referencial da própria unidade.
"""
import copy
import math
import re

from shapely.geometry import LineString, Polygon
from shapely.ops import unary_union

from viabilidade.projetista.esquema import _canonico, selar, sha256, texto
from viabilidade.projetista.gerador import FOLGA, _recusas
from viabilidade.projetista.validador import _posicionar, medir_areas, validar

OPERACOES = ("mover_divisa", "juntar_unidades", "dividir_unidade", "renomear", "compor_torre")  # a última vem de torre.py
CONTATO_MIN_M = 0.1  # trecho mínimo de parede comum para duas unidades serem vizinhas


class EdicaoRecusada(ValueError):
    """Operação recusada. `motivos` diz por quê; `achados` traz os do validador (vazio se a entrada era inválida)."""

    def __init__(self, motivos, achados=()):
        self.motivos, self.achados = list(motivos), list(achados)
        super().__init__("; ".join(self.motivos))


def _id_revisao(pai, op, params):
    return "rev_" + sha256({"pai": pai["content_sha256"], "op": op, "params": params})[:12]


def _conferir(rev):
    try:
        ok = selar(rev)["content_sha256"] == rev.get("content_sha256")
    except (ValueError, KeyError, TypeError) as erro:
        raise EdicaoRecusada([f"revisão de entrada malformada: {erro}"]) from erro
    if not ok:
        raise EdicaoRecusada(["revisão de entrada não está selada (o selo não bate com o conteúdo)"])


# ---- geometria de uma unidade (retângulo no referencial próprio) ----

def _g(p, u, v):
    """Ponto próprio (u, v) -> referencial da laje; mesma conta do validador (espelho, giro, translação)."""
    u = -u if p["mirror"] else u
    c, s = math.cos(math.radians(p["rot_deg"])), math.sin(math.radians(p["rot_deg"]))
    return (u * c - v * s + p["x"], u * s + v * c + p["y"])


def _dir(p, du, dv):
    """Vetor próprio -> vetor na laje."""
    x, y = _g(p, du, dv)
    x0, y0 = _g(p, 0, 0)
    return (x - x0, y - y0)


def _achar(rev, id_):
    for f in rev["floor_plates"]:
        for i, p in enumerate(f["unit_placements"]):
            if p["id"] == id_:
                return f, i
    raise EdicaoRecusada([f"unidade inexistente: {id_!r}"])


def _tipo(rev, p):
    return next(t for t in rev["unit_types"] if t["id"] == p["unit_type_id"])


def _rect(rev, p):
    """(w, d) do tipo, ou recusa se não for o retângulo do gerador."""
    pts = [tuple(x) for x in _tipo(rev, p)["outline_m"]]
    if len(pts) == 5 and pts[0] == pts[-1]:
        pts.pop()
    if len(pts) == 4 and pts[0] == (0, 0) and pts[1][1] == 0 and pts[1][0] > 0 and pts[2] == (pts[1][0], pts[3][1]) \
            and pts[3] == (0, pts[3][1]) and pts[3][1] > 0:
        return pts[1][0], pts[3][1]
    raise EdicaoRecusada([f"{p['id']}: o editor só mexe em unidades retangulares do gerador"])


def _arestas(rev, p):
    """4 arestas (k, ponto a, ponto b, normal para fora) na laje."""
    w, d = _rect(rev, p)
    cantos = [(0, 0), (w, 0), (w, d), (0, d)]
    normais = [(0, -1), (1, 0), (0, 1), (-1, 0)]
    out = []
    for k in range(4):
        out.append((k, _g(p, *cantos[k]), _g(p, *cantos[(k + 1) % 4]), _dir(p, *normais[k])))
    return out


def _contato(rev, pa, pb, tol):
    """(kA, kB, comprimento) da parede comum entre duas unidades, ou None. Paralelas, frente a frente, folga <= tol."""
    melhor = None
    for ka, a0, a1, na in _arestas(rev, pa):
        for kb, b0, b1, nb in _arestas(rev, pb):
            if na[0] * nb[0] + na[1] * nb[1] > -0.999:
                continue
            folga = (b0[0] - a0[0]) * na[0] + (b0[1] - a0[1]) * na[1]
            if not -tol <= folga <= tol:
                continue
            tx, ty = na[1], -na[0]
            ta = sorted((a0[0] * tx + a0[1] * ty, a1[0] * tx + a1[1] * ty))
            tb = sorted((b0[0] * tx + b0[1] * ty, b1[0] * tx + b1[1] * ty))
            c = min(ta[1], tb[1]) - max(ta[0], tb[0])
            if c > CONTATO_MIN_M and (melhor is None or c > melhor[2]):
                melhor = (ka, kb, c)
    return melhor


def _vizinhas(rev, a, b):
    if a == b:
        raise EdicaoRecusada(["as duas unidades são a mesma"])
    fa, ia = _achar(rev, a)
    fb, ib = _achar(rev, b)
    if fa is not fb:
        raise EdicaoRecusada([f"{a} e {b} estão em pavimentos diferentes"])
    pa, pb = fa["unit_placements"][ia], fb["unit_placements"][ib]
    c = _contato(rev, pa, pb, 2 * rev["tolerances"]["tol_geom_m"])
    if c is None:
        raise EdicaoRecusada([f"{a} e {b} não são vizinhas (sem parede comum de pelo menos {CONTATO_MIN_M:g} m)"])
    return fa, ia, ib, c


# ---- tipos ----

def _num(rev):
    ids = {t["id"] for t in rev["unit_types"]}
    ns = [int(m.group(1)) for i in ids if (m := re.fullmatch(r"tipo_(\d+)", i))]
    return max(ns, default=0) + 1


def _tipo_para(rev, base, w, d, kinds):
    """Id de um tipo retangular w x d com essas arestas: reaproveita o igual, senão cria o próximo `tipo_NN`."""
    alvo = {"outline_m": [[0, 0], [w, 0], [w, d], [0, d]], "edge_kinds": list(kinds),
            "thickness_m": base["thickness_m"], "balcony_m2": base["balcony_m2"], "metrics": {}}
    alvo = _canonico(alvo)
    for t in rev["unit_types"]:
        if all(_canonico(t[k]) == alvo[k] for k in alvo):
            return t["id"]
    n = _num(rev)
    rev["unit_types"].append({"id": f"tipo_{n:02d}", "name": f"Unidade tipo {n}", "version": "1", **copy.deepcopy(alvo)})
    return f"tipo_{n:02d}"


def _colocar(rev, f, i, p_old, base, u0, u1, v0, v1, kinds, id_=None):
    """Nova colocação para o retângulo (u0,u1,v0,v1) do referencial de `p_old`."""
    x, y = _g(p_old, u0, v0)
    return {"id": id_ or p_old["id"], "unit_type_id": _tipo_para(rev, base, u1 - u0, v1 - v0, kinds),
            "x": x, "y": y, "rot_deg": p_old["rot_deg"], "mirror": p_old["mirror"]}


# ---- fechamento: resíduo, validação, métricas, selo ----

def _residuo(rev, f):
    tp = {t["id"]: Polygon(t["outline_m"]) for t in rev["unit_types"]}
    ocupado = [_posicionar(tp[p["unit_type_id"]], p) for p in f["unit_placements"]]
    ocupado += [Polygon(e["polygon_m"]) for e in f["shared_spaces"] + f["cores"]]
    return round(max(0.0, Polygon(f["outline_m"]).difference(unary_union(ocupado)).area), 4)


def _area_minima(rev, achados):
    """Premissa de área privativa mínima do gerador (se a revisão a registra). Não é norma."""
    prog = (rev["metrics_summary"].get("geracao") or {}).get("programa") or {}
    faixa = prog.get("area_privativa_m2")
    if not faixa:
        return []
    amin, extra = faixa[0], []
    unidades = {p["id"] for f in rev["floor_plates"] for p in f["unit_placements"]}
    for f in achados:
        if f["rule_id"] == "areas.privativa" and len(f["element_ids"]) == 1 and f["measured"] is not None \
                and f["measured"] + 1e-9 < amin and f["element_ids"][0] in unidades:
            extra.append({"rule_id": "arquitetura.area_minima_unidade", "status": "violacao", "severity": "erro",
                          "measured": f["measured"], "limit": amin, "unit": "m²", "diff": f["measured"] - amin,
                          "element_ids": f["element_ids"],
                          "source": {"reference": "premissa do gerador (metrics_summary.geracao.programa.area_privativa_m2)",
                                     "verified": False, "kind": "premissa"},
                          "suggestion": "Área privativa abaixo da mínima da premissa de geração"})
    return extra


def _metricas(rev, achados):
    areas = []
    for f in rev["floor_plates"]:
        tp = {t["id"]: t for t in rev["unit_types"]}
        areas += [medir_areas(tp[p["unit_type_id"]])["privativa_m2"] for p in f["unit_placements"]]
    nv = [f for f in achados if f["status"] == "nao_verificado"]
    fachadas = [f["measured"] for f in achados if f["rule_id"] == "fachada" and f["measured"] is not None]
    m = rev["metrics_summary"]
    m.update({"unidades": len(areas), "privativa_total_m2": sum(areas),
              "privativa_media_m2": sum(areas) / len(areas) if areas else 0, "privativa_min_m2": min(areas, default=0),
              "privativa_max_m2": max(areas, default=0), "residuo_m2": sum(f["residuals_m2"] for f in rev["floor_plates"]),
              "achados_nao_verificado": len(nv), "regras_nao_verificadas": sorted({f["rule_id"] for f in nv})})
    if fachadas:
        m["fachada_min_m"] = min(fachadas)


def _fechar(pai, rev, op, params, plates, forcar):
    """Resíduo, validação, recusa/forçar, métricas e selo. `rev` é a cópia editada (não selada)."""
    rev.update(parent_revision_id=pai["revision_id"], revision_id=_id_revisao(pai, op, params), content_sha256="")
    rev = _canonico(rev)
    for f in rev["floor_plates"]:
        if f["id"] in plates:
            f["residuals_m2"] = _residuo(rev, f)
    # remove tipos que ficaram sem uso
    usados = {p["unit_type_id"] for f in rev["floor_plates"] for p in f["unit_placements"]}
    rev["unit_types"] = [t for t in rev["unit_types"] if t["id"] in usados]
    rev["metrics_summary"]["edicao"] = {"operacao": op, "parametros": params, "forcada": False, "violacoes": []}
    selada = selar(rev)
    achados = validar(selada, selada["site"], selada["rules_ref"])
    achados = achados + _area_minima(selada, achados)
    motivos = _recusas([a for a in achados if a["rule_id"] != "arquitetura.area_minima_unidade"],
                       selada["tolerances"]["tol_geom_m"])
    motivos += ["arquitetura.area_minima_unidade" for a in achados if a["rule_id"] == "arquitetura.area_minima_unidade"]
    if motivos:
        if not forcar:
            raise EdicaoRecusada(_explicar(achados, motivos), achados)
        rev["metrics_summary"]["edicao"].update(forcada=True, violacoes=sorted(set(motivos)))
    _metricas(rev, achados)
    return selar(rev), achados


def _explicar(achados, motivos):
    out = []
    for a in achados:
        ruim = a["status"] in ("violacao", "erro_tecnico") or (a["rule_id"] in ("acesso", "fachada", "dimensao")
                and a["limit"] is not None and a["measured"] is not None and a["measured"] + 0.001 < a["limit"])
        if ruim:
            alvo = ", ".join(a["element_ids"])
            med = "" if a["measured"] is None else f": {a['measured']:.3f} contra {a['limit']:.3f}" if a["limit"] is not None else ""
            out.append(f"{a['rule_id']} em {alvo}{med}" + (f" ({a['suggestion']})" if a["suggestion"] and a["measured"] is None else ""))
    return out or sorted(set(motivos))


def _nova(rev):
    return copy.deepcopy(rev)


# ---- operações ----

def mover_divisa(rev, unidade_a, unidade_b, delta_m, forcar=False):
    """Desloca a parede comum: `delta_m` > 0 faz A crescer e B encolher (< 0, o contrário)."""
    _conferir(rev)
    if type(delta_m) not in (int, float) or not math.isfinite(delta_m) or round(delta_m, 4) == 0:
        raise EdicaoRecusada(["delta deve ser um número finito diferente de zero"])
    f0, ia, ib, (ka, kb, _) = _vizinhas(rev, unidade_a, unidade_b)
    novo = _nova(rev)
    f = next(x for x in novo["floor_plates"] if x["id"] == f0["id"])
    pa, pb = f["unit_placements"][ia], f["unit_placements"][ib]
    s, novos = round(delta_m, 4), []
    for p, k, sinal in ((pa, ka, 1), (pb, kb, -1)):
        w, d = _rect(novo, p)
        t = _tipo(novo, p)
        u0, u1, v0, v1 = 0, w, 0, d
        e = sinal * s
        u0, u1, v0, v1 = (u0, u1, v0 - e, v1) if k == 0 else (u0, u1 + e, v0, v1) if k == 1 else \
            (u0, u1, v0, v1 + e) if k == 2 else (u0 - e, u1, v0, v1)
        if u1 - u0 <= 0 or v1 - v0 <= 0:
            raise EdicaoRecusada([f"o delta de {delta_m:g} m zera ou inverte a unidade {p['id']}"])
        novos.append(_colocar(novo, f, 0, p, t, u0, u1, v0, v1, t["edge_kinds"]))
    f["unit_placements"][ia], f["unit_placements"][ib] = novos
    return _fechar(rev, novo, "mover_divisa", {"a": unidade_a, "b": unidade_b, "delta_m": s}, {f["id"]}, forcar)


def juntar_unidades(rev, unidade_a, unidade_b, forcar=False):
    """Duas unidades vizinhas viram uma (id `a+b`), cobrindo também o vão entre elas."""
    _conferir(rev)
    f0, ia, ib, (ka, kb, _) = _vizinhas(rev, unidade_a, unidade_b)
    novo = _nova(rev)
    f = next(x for x in novo["floor_plates"] if x["id"] == f0["id"])
    pa, pb = f["unit_placements"][ia], f["unit_placements"][ib]
    if pa["mirror"] != pb["mirror"] or abs((pa["rot_deg"] - pb["rot_deg"] + 180) % 360 - 180) > 1e-3 or kb != (ka + 2) % 4:
        raise EdicaoRecusada([f"{unidade_a} e {unidade_b} têm orientações diferentes; só junto unidades alinhadas"])
    ta, tb = _tipo(novo, pa), _tipo(novo, pb)
    (wa, da), (wb, db) = _rect(novo, pa), _rect(novo, pb)
    # B no referencial de A: deslocamento próprio (u, v) entre as origens
    dx, dy = pb["x"] - pa["x"], pb["y"] - pa["y"]
    c, s = math.cos(math.radians(pa["rot_deg"])), math.sin(math.radians(pa["rot_deg"]))
    ou, ov = dx * c + dy * s, -dx * s + dy * c
    ou = -ou if pa["mirror"] else ou
    tg = 2 * rev["tolerances"]["tol_geom_m"]
    if ka in (1, 3):
        if abs(ov) > tg or abs(db - da) > tg:
            raise EdicaoRecusada([f"{unidade_a} e {unidade_b} não têm a mesma profundidade e alinhamento"])
        u0, u1, v0, v1 = (0, ou + wb, 0, da) if ka == 1 else (ou, wa, 0, da)
    else:
        if abs(ou) > tg or abs(wb - wa) > tg:
            raise EdicaoRecusada([f"{unidade_a} e {unidade_b} não têm a mesma largura e alinhamento"])
        u0, u1, v0, v1 = (0, wa, 0, ov + db) if ka == 2 else (0, wa, ov, da)
    ka_, kb_ = ta["edge_kinds"], tb["edge_kinds"]
    kinds = list(ka_)
    kinds[ka] = kb_[ka]  # a ponta de B vira a ponta da nova unidade
    for k in range(4):
        if k not in (ka, kb) and ka_[k] != kb_[k]:
            raise EdicaoRecusada([f"{unidade_a} e {unidade_b} têm tipos de aresta diferentes (aresta {k}); não dá para juntar"])
    nova = _colocar(novo, f, 0, pa, ta, u0, u1, v0, v1, kinds, id_=f"{unidade_a}+{unidade_b}")
    f["unit_placements"][ia] = nova
    del f["unit_placements"][ib]
    return _fechar(rev, novo, "juntar_unidades", {"a": unidade_a, "b": unidade_b}, {f["id"]}, forcar)


def dividir_unidade(rev, unidade, frac, forcar=False):
    """Corta a unidade perpendicular ao corredor, a `frac` da largura (medida da aresta de menor coordenada própria).

    Cria `<id>.1` e `<id>.2`; o vão entre elas é o do gerador (2 x FOLGA).
    """
    _conferir(rev)
    if type(frac) not in (int, float) or not math.isfinite(frac) or not 0 < frac < 1:
        raise EdicaoRecusada(["frac deve ficar entre 0 e 1 (exclusive)"])
    f0, i = _achar(rev, unidade)
    novo = _nova(rev)
    f = next(x for x in novo["floor_plates"] if x["id"] == f0["id"])
    p = f["unit_placements"][i]
    t, (w, d) = _tipo(novo, p), _rect(novo, p)
    # lado do corredor: a aresta com mais contato com corredor/hall
    comuns = [Polygon(e["polygon_m"]).buffer(0.002) for e in f["shared_spaces"] if e["kind"] in ("corredor", "hall")]
    contato = [(sum(LineString([a, b]).intersection(g).length for g in comuns), -k, k) for k, a, b, _ in _arestas(novo, p)]
    maior, _, kc = max(contato)
    if maior < CONTATO_MIN_M:
        raise EdicaoRecusada([f"{unidade} não encosta num corredor: não sei de que lado cortar"])
    kinds = t["edge_kinds"]
    if kc in (0, 2):  # corredor em cima/embaixo: corte vertical, na largura
        c, partes = frac * w, None
        a = (0, c - FOLGA, 0, d, kinds[:1] + ["divisa"] + kinds[2:])
        b = (c + FOLGA, w, 0, d, kinds[:3] + ["divisa"])
        tam = (c - FOLGA, w - c - FOLGA)
    else:  # corredor dos lados: corte horizontal, na profundidade
        c = frac * d
        a = (0, w, 0, c - FOLGA, kinds[:2] + ["divisa"] + kinds[3:])
        b = (0, w, c + FOLGA, d, ["divisa"] + kinds[1:])
        tam = (c - FOLGA, d - c - FOLGA)
    if min(tam) <= 0:
        raise EdicaoRecusada([f"a fração {frac:g} deixa uma das metades sem tamanho"])
    f["unit_placements"][i:i + 1] = [_colocar(novo, f, 0, p, t, *x[:4], x[4], id_=f"{unidade}.{n}") for n, x in ((1, a), (2, b))]
    return _fechar(rev, novo, "dividir_unidade", {"unidade": unidade, "frac": round(frac, 4)}, {f["id"]}, forcar)


def renomear(rev, elemento, nome, forcar=False):
    """Só o rótulo (`name` do elemento: unidade, espaço comum, núcleo, pavimento ou tipo); a geometria não muda."""
    _conferir(rev)
    try:
        texto(nome, "nome")
    except ValueError as erro:
        raise EdicaoRecusada([str(erro)]) from erro
    novo = _nova(rev)
    alvos = novo["unit_types"] + novo["floor_plates"] + [e for f in novo["floor_plates"] for e in
            f["unit_placements"] + f["shared_spaces"] + f["cores"]]
    alvo = next((e for e in alvos if e["id"] == elemento), None)
    if alvo is None:
        raise EdicaoRecusada([f"elemento inexistente: {elemento!r}"])
    if alvo.get("name") == nome:
        raise EdicaoRecusada([f"{elemento} já se chama {nome!r}"])
    alvo["name"] = nome
    return _fechar(rev, novo, "renomear", {"elemento": elemento, "nome": nome}, set(), forcar)


# ---- histórico ----

def cadeia(revisoes):
    """Confere a lista em ordem: selos batendo, cada `parent_revision_id` apontando para a anterior e cada id
    derivado do selo do pai + operação + parâmetros (adulterar e re-selar uma do meio quebra a seguinte)."""
    if not revisoes:
        raise ValueError("cadeia vazia")
    for i, r in enumerate(revisoes):
        try:
            if selar(r)["content_sha256"] != r["content_sha256"]:
                raise ValueError("o selo não bate com o conteúdo")
            if i == 0:
                continue
            pai, e = revisoes[i - 1], r["metrics_summary"].get("edicao")
            if r["parent_revision_id"] != pai["revision_id"]:
                raise ValueError(f"parent_revision_id não aponta para {pai['revision_id']!r}")
            if not isinstance(e, dict) or e.get("operacao") not in OPERACOES:
                raise ValueError("sem registro da edição (metrics_summary.edicao)")
            if r["revision_id"] != _id_revisao(pai, e["operacao"], e["parametros"]):
                raise ValueError("o id não deriva do pai, da operação e dos parâmetros")
        except (ValueError, KeyError, TypeError) as erro:
            raise ValueError(f"cadeia inválida na revisão {i} ({r.get('revision_id') if isinstance(r, dict) else '?'}): {erro}") from erro
    return True

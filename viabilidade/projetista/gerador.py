"""Gerador esquemático de pavimento (fatia 2 do Projetista).

    python -I -X utf8 viabilidade/projetista/gerador.py <estudo.json> --unidades 6 --saida <pasta>

Faixas paralelas ao eixo dominante do envelope (lado longo do retângulo mínimo que o
cerca), corredor central (unidades dos dois lados) ou lateral (um lado), núcleo
(escada + elevador + shaft) no meio ou na ponta. Sem IA, sem `random`, sem relógio:
as mesmas entradas dão os mesmos bytes. O limite da busca é contagem de nós.

Toda proposta passa por `validador.validar`. Só sai como `gerado` a que não tem
`violacao` nem `erro_tecnico`. Achado `nao_verificado` não bloqueia, MAS as três
premissas que este gerador exige (acesso, fachada, lado mínimo) são conferidas aqui
também: o validador esconde a conta atrás de `nao_verificado` quando a fonte não
está verificada, e uma premissa não atendida não pode sair como gerada.

Tudo em PADROES é PREMISSA de projeto, nenhum número vem de norma conferida.
"""
import argparse
import copy
import math
import sys
from collections import Counter
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ))
from shapely import affinity
from shapely.geometry import Polygon, box
from shapely.prepared import prep
from shapely.validation import make_valid

from viabilidade.projetista.esquema import SCHEMA_VERSION, TOLERANCIAS, _canonico, gravar, selar
from viabilidade.projetista.validador import _posicionar, medir_areas, validar

PADROES = {
    "unidades": 6,                      # unidades por pavimento
    "area_privativa_m2": (45.0, 75.0),  # faixa por unidade (face física, a mesma do validador)
    "corredor_m": 1.5,                  # largura do corredor
    "nucleo": {"largura_m": 2.5, "escada_m": 5.0, "elevador_m": 2.4, "shaft_m": 1.5},
    # nucleo: largura comum (no sentido do corredor) e profundidade de cada peça, em fila
    "fachada_min_m": None,              # None = usa regras.params.facade_min_m
    "lado_min_m": 3.0,                  # menor lado da face útil da unidade
    "espessuras_m": {"interna": 0.15, "externa": 0.20, "divisa": 0.20},
    "z0_m": 0.0,                        # cota do pavimento típico (usa o envelope dessa altura)
    "pe_direito_m": 3.0,
    "passo_m": 0.25,                    # grade das larguras e profundidades da unidade
    "passo_posicao_m": 0.5,             # grade da posição da laje dentro do envelope
}
LIMITES = {"max_nos": 100000, "max_revisoes": 3}
FOLGA = 0.0003  # vão de 0,3 mm entre elementos: absorve o arredondamento a 4 casas (ver RELATORIO-4)
EPS = 1e-9
PREMISSAS_EXIGIDAS = ("acesso", "fachada", "dimensao")


def _programa(programa):
    P = copy.deepcopy(PADROES)
    for k, v in (programa or {}).items():
        if k not in P:
            raise ValueError(f"programa: parâmetro desconhecido {k!r}")
        if isinstance(P[k], dict):
            if not isinstance(v, dict) or set(v) - set(P[k]):
                raise ValueError(f"programa.{k}: chaves permitidas {sorted(P[k])}")
            P[k].update(v)
        else:
            P[k] = v
    amin, amax = P["area_privativa_m2"]
    positivos = [P["corredor_m"], P["lado_min_m"], P["pe_direito_m"], P["passo_m"], P["passo_posicao_m"], amin, *P["nucleo"].values(), *P["espessuras_m"].values()]
    if type(P["unidades"]) is not int or P["unidades"] < 1 or not 0 < amin <= amax:
        raise ValueError("programa: unidades inteiras >= 1 e 0 < área mínima <= máxima")
    if P["fachada_min_m"] is not None:
        positivos.append(P["fachada_min_m"])
    if any(type(x) not in (int, float) or not math.isfinite(x) or x <= 0 for x in positivos) or P["z0_m"] < 0:
        raise ValueError("programa: medidas devem ser números positivos")
    P["area_privativa_m2"] = (amin, amax)
    return P


def _reparar(site, tol_area):
    """Faixa auto-intersectada (espigões de largura zero) é refeita com make_valid.

    Só vale se a área não mudar além da tolerância; o validador da fatia 1 recusa a
    entrada inteira por uma faixa inválida, mesmo que o pavimento nem a toque.
    """
    site, reparos = _canonico(site), []
    for i, b in enumerate(site["envelope_by_height"]):
        if len(b["polygon_m"]) < 3:
            continue
        g = Polygon(b["polygon_m"])
        if g.is_valid:
            continue
        partes = [p for p in getattr(make_valid(g), "geoms", [make_valid(g)]) if p.geom_type == "Polygon"]
        if not partes:
            continue
        novo = max(partes, key=lambda p: p.area)
        if novo.interiors or abs(novo.area - g.area) > tol_area:
            continue
        b["polygon_m"] = [list(p) for p in novo.exterior.coords][:-1]
        reparos.append({"faixa": i, "area_antes_m2": round(g.area, 4), "area_depois_m2": round(novo.area, 4)})
    return _canonico(site), reparos


def _envelope(site, z0, z1):
    """Mesma regra do validador: interseção das faixas que tocam [z0, z1). None = faixa inválida."""
    faixas = site["envelope_by_height"]
    g = None
    for b in faixas:
        if b["z0_m"] < z1 and b["z1_m"] > z0:
            p = Polygon(b["polygon_m"]) if b["polygon_m"] else Polygon()
            if not p.is_valid:
                return None
            g = p if g is None else g.intersection(p)
    if g is None or not faixas or z1 > faixas[-1]["z1_m"]:
        return Polygon()
    if g.geom_type != "Polygon":
        partes = [x for x in getattr(g, "geoms", []) if x.geom_type == "Polygon"]
        g = max(partes, key=lambda x: x.area) if partes else Polygon()
    return g


def _angulo(e):
    c = list(e.minimum_rotated_rectangle.exterior.coords)
    lados = [(c[i + 1][0] - c[i][0], c[i + 1][1] - c[i][1]) for i in range(2)]
    dx, dy = max(lados, key=lambda v: math.hypot(*v))  # empate: o primeiro lado
    return round(math.degrees(math.atan2(dy, dx)) % 180, 4) % 180


def _largura_minima(g):
    h = list(g.convex_hull.exterior.coords)
    melhor = math.inf
    for (x0, y0), (x1, y1) in zip(h, h[1:]):
        n = math.hypot(x1 - x0, y1 - y0)
        if n:
            melhor = min(melhor, max(abs((x - x0) * (y1 - y0) - (y - y0) * (x1 - x0)) / n for x, y in h))
    return melhor


def _prova(e, P):
    """Prova simples de inviabilidade, ou None. Cada prova diz qual conta falhou."""
    N, (amin, _), n = P["unidades"], P["area_privativa_m2"], P["nucleo"]
    if e.is_empty:
        return "o envelope nesta altura é vazio"
    nucleo = n["largura_m"] * (n["escada_m"] + n["elevador_m"] + n["shaft_m"])
    if e.area < N * amin + nucleo:
        return (f"área do envelope ({e.area:.1f} m²) menor que {N} unidades × {amin:g} m² + núcleo "
                f"({nucleo:.1f} m²) = {N * amin + nucleo:.1f} m²: as faces privativas e o núcleo têm de caber nele")
    largura, preciso = _largura_minima(e), P["lado_min_m"] + P["corredor_m"]
    if largura < preciso:
        return (f"largura mínima do envelope ({largura:.2f} m) menor que o lado mínimo da unidade "
                f"({P['lado_min_m']:g} m) + corredor ({P['corredor_m']:g} m) = {preciso:g} m (modelo de faixas)")
    return None


def _celulas(layout, d, w, a, P):
    """Células retangulares (u0, u1, v0, v1) da laje, em metros no referencial da faixa. None = núcleo não cabe."""
    N, C, n = P["unidades"], P["corredor_m"], P["nucleo"]
    Wc, ds, de, dh = n["largura_m"], n["escada_m"], n["elevador_m"], n["shaft_m"]
    nb, nt = (N, 0) if layout == "lateral" else ((N + 1) // 2, N // 2)
    D = d + C if layout == "lateral" else 2 * d + C
    if layout == "central":
        if ds > d + EPS or de + dh > d + EPS:
            return None
        nuc = [("escada", 0, ds), ("hall", ds, D - de - dh), ("elevador", D - de - dh, D - dh), ("shaft", D - dh, D)]
    else:
        if ds + de + dh > d + EPS:
            return None
        nuc = [("escada", 0, ds), ("elevador", ds, ds + de), ("shaft", ds + de, ds + de + dh), ("hall", ds + de + dh, D)]
    uc, L = a * w, nb * w + Wc

    def inicio(i, esq):
        return i * w if i < esq else uc + Wc + (i - esq) * w

    at = min(a, nt)
    unidades = [(inicio(i, a), inicio(i, a) + w, 0, d) for i in range(nb)]
    unidades += [(inicio(i, at), inicio(i, at) + w, d + C, D) for i in range(nt)]
    corredores = ([(0, uc, d, d + C)] if a > 0 else []) + ([(uc + Wc, L, d, d + C)] if a < nb else [])
    bloco = [(k, uc, uc + Wc, v0, v1) for k, v0, v1 in nuc]
    return {"L": L, "D": D, "unidades": unidades, "corredores": corredores, "bloco": bloco, "uc": uc}


def _arestas(r, outros):
    """externa/divisa por aresta (baixo, direita, cima, esquerda): divisa só se há célula encostada."""
    u0, u1, v0, v1 = r

    def toca(lado):
        for a0, a1, b0, b1 in outros:
            sobre_u, sobre_v = min(u1, a1) - max(u0, a0) > EPS, min(v1, b1) - max(v0, b0) > EPS
            if (lado == 0 and abs(b1 - v0) < EPS and sobre_u) or (lado == 1 and abs(a0 - u1) < EPS and sobre_v) \
                    or (lado == 2 and abs(b0 - v1) < EPS and sobre_u) or (lado == 3 and abs(a1 - u0) < EPS and sobre_v):
                return True
        return False
    return tuple("divisa" if toca(i) else "externa" for i in range(4))


def _tipo(wn, dn, kinds, esp, n):
    return {"id": f"tipo_{n:02d}", "name": f"Unidade tipo {n}", "version": "1",
            "outline_m": [[0, 0], [wn, 0], [wn, dn], [0, dn]], "thickness_m": dict(esp),
            "edge_kinds": list(kinds), "balcony_m2": 0, "metrics": {}}


def _posicao(cobre, caixa, L, D, passo):
    """Primeira posição (v crescente, depois u) em que a laje L×D cabe. Devolve (posição|None, nós gastos)."""
    minx, miny, maxx, maxy = caixa
    if L > maxx - minx + EPS or D > maxy - miny + EPS:
        return None, 1
    nos = 0
    for j in range(int((maxy - miny - D) / passo + EPS) + 1):
        for i in range(int((maxx - minx - L) / passo + EPS) + 1):
            nos += 1
            u, v = round(minx + i * passo, 4), round(miny + j * passo, 4)
            if cobre.covers(box(u, v, u + L, v + D)):
                return (u, v), nos
    return None, nos


def _montar(ctx, folha, c, pos):
    """Revisão (ainda sem metrics_summary) e as áreas privativas, na ordem das unidades."""
    layout, d, w, a = folha
    P, th = ctx["P"], ctx["angulo"]
    cs, sn = math.cos(math.radians(th)), math.sin(math.radians(th))
    f = FOLGA

    def M(u, v):
        u, v = u + pos[0], v + pos[1]
        return [round(u * cs - v * sn, 4), round(u * sn + v * cs, 4)]

    def ret(u0, u1, v0, v1, g=f):
        return [M(u0 + g, v0 + g), M(u1 - g, v0 + g), M(u1 - g, v1 - g), M(u0 + g, v1 - g)]

    bloco_inteiro = (c["uc"], c["uc"] + P["nucleo"]["largura_m"], 0, c["D"])
    celulas = c["unidades"] + c["corredores"] + [bloco_inteiro]
    wn, dn = round(c["unidades"][0][1] - c["unidades"][0][0] - 2 * f, 4), round(d - 2 * f, 4)
    tipos, ids, colocacoes, areas = {}, [], [], []
    for i, r in enumerate(c["unidades"]):
        kinds = _arestas(r, [x for x in celulas if x is not r])
        if kinds not in tipos:
            tipos[kinds] = _tipo(wn, dn, kinds, P["espessuras_m"], len(tipos) + 1)
        t = tipos[kinds]
        x, y = M(r[0] + f, r[2] + f)
        colocacoes.append({"id": f"apto_{i + 1:02d}", "unit_type_id": t["id"], "x": x, "y": y, "rot_deg": th, "mirror": False})
        areas.append(medir_areas(t)["privativa_m2"])
    comuns = [{"id": f"corredor_{i + 1:02d}", "kind": "corredor", "polygon_m": ret(*r), "computable": True}
              for i, r in enumerate(c["corredores"])]
    nucleos = []
    for k, u0, u1, v0, v1 in c["bloco"]:
        e = {"id": "hall_nucleo" if k == "hall" else k, "kind": k, "polygon_m": ret(u0, u1, v0, v1), "computable": k == "hall"}
        (comuns if k == "hall" else nucleos).append(e)
    laje = ret(0, c["L"], 0, c["D"], g=0)
    rev = {"schema_version": SCHEMA_VERSION, "unit": "m", "revision_id": "rev", "parent_revision_id": None,
           "content_sha256": "", "study_ref": copy.deepcopy(ctx["estudo"]), "site": copy.deepcopy(ctx["site"]),
           "rules_ref": copy.deepcopy(ctx["regras"]), "status": "RASCUNHO", "tolerances": dict(TOLERANCIAS),
           "unit_types": list(tipos.values()),
           "floor_plates": [{"id": "andar_tipo", "name": "Pavimento tipo", "outline_m": laje, "z0_m": P["z0_m"],
                             "height_m": P["pe_direito_m"], "unit_placements": colocacoes, "shared_spaces": comuns,
                             "cores": nucleos, "residuals_m2": 0}],
           "metrics_summary": {}}
    # resíduo declarado = o que a geometria arredondada realmente deixa vazio (vãos + células sem unidade)
    tp = {t["id"]: Polygon(t["outline_m"]) for t in rev["unit_types"]}
    ocupado = [_posicionar(tp[p["unit_type_id"]], p) for p in colocacoes] + [Polygon(e["polygon_m"]) for e in comuns + nucleos]
    from shapely.ops import unary_union
    rev["floor_plates"][0]["residuals_m2"] = round(max(0.0, Polygon(laje).difference(unary_union(ocupado)).area), 4)
    return rev, areas


def _recusas(achados, tg):
    motivos = []
    for f in achados:
        if f["status"] in ("violacao", "erro_tecnico"):
            motivos.append(f["rule_id"] + (" (erro técnico)" if f["status"] == "erro_tecnico" else ""))
        elif f["status"] == "nao_verificado" and f["rule_id"] in PREMISSAS_EXIGIDAS and f["limit"] is not None \
                and f["measured"] + tg < f["limit"]:
            motivos.append("premissa não atendida: " + f["rule_id"])
    return motivos


def _folhas(P, caixa):
    """Todas as combinações (layout, d, w, a) em ordem fixa, com o limite superior da área total."""
    N, (amin, amax), t = P["unidades"], P["area_privativa_m2"], P["espessuras_m"]["externa"]
    passo, lado = P["passo_m"], P["lado_min_m"]
    maior = max(caixa[2] - caixa[0], caixa[3] - caixa[1])
    medidas = [round(lado + 2 * FOLGA + (t) + k * passo, 4) for k in range(int(maior / passo) + 1)]
    folhas = []
    for layout in (("central", "lateral") if N > 1 else ("lateral",)):
        nb = N if layout == "lateral" else (N + 1) // 2
        for d in medidas:
            for w in medidas:
                if (w - 2 * FOLGA) * (d - 2 * FOLGA) > amax or (w + t) * (d + t) < amin:
                    continue  # nem a menor face cabe em amax, nem a maior chega a amin
                for a in range(nb + 1):
                    folhas.append((layout, d, w, a))
    ordem = sorted(range(len(folhas)), key=lambda i: (-N * (folhas[i][2] + t) * (folhas[i][1] + t), i))
    return [(N * (folhas[i][2] + t) * (folhas[i][1] + t), i, folhas[i]) for i in ordem]


def gerar_pavimento(site, regras, programa=None, limites=None, estudo_ref=None):
    """Retorna dict com `outcome` gerado | inviavel | nao_encontrado (ver o módulo).

    `estudo_ref` é o primeiro item de `estudo_para_site`; sem ele a revisão sai com um
    estudo de origem sintético (SHA zerado), só para uso em teste.
    """
    P, lim = _programa(programa), {**LIMITES, **(limites or {})}
    regras = copy.deepcopy(regras)
    regras["params"]["facade_min_m"] = P["fachada_min_m"] or regras["params"].get("facade_min_m") or 3.0
    regras["params"]["unit_min_side_m"] = P["lado_min_m"]
    P["fachada_min_m"] = regras["params"]["facade_min_m"]
    site, reparos = _reparar(site, TOLERANCIAS["tol_area_m2"])
    estudo = estudo_ref or {"study_id": site["lote_id"], "study_sha256": "0" * 64, "motor_version": "sem-estudo",
                            "lote_id": site["lote_id"], "created_at": None}
    base = {"outcome": None, "revisoes": [], "objetivos": [], "prova": None, "motivo": None,
            "busca": {"nos": 0, "limite_nos": lim["max_nos"], "esgotada": False}, "recusas": {},
            "reparos_envelope": reparos, "programa": _canonico(P)}
    e = _envelope(site, P["z0_m"], P["z0_m"] + P["pe_direito_m"])
    if e is None:
        base.update(outcome="nao_encontrado", motivo="faixa do envelope inválida e sem reparo que preserve a área")
        return base
    prova = _prova(e, P)
    if prova:
        base.update(outcome="inviavel", prova=prova)
        return base
    th = _angulo(e)
    margem = P["espessuras_m"]["externa"] / 2  # a face física passa do eixo por meia espessura externa
    ei = affinity.rotate(e, -th, origin=(0, 0)).buffer(-margem, join_style="mitre")
    if ei.is_empty:
        base.update(outcome="nao_encontrado", motivo="envelope some depois de descontar a espessura externa")
        return base
    cobre, caixa = prep(ei.buffer(1e-6)), ei.bounds
    ctx = {"P": P, "angulo": th, "estudo": estudo, "site": site, "regras": regras}
    amin, amax = P["area_privativa_m2"]
    tol, tg = TOLERANCIAS["tol_area_m2"], TOLERANCIAS["tol_geom_m"]
    recusas, aceitas, sem_lugar, nos, esgotada = Counter(), [], [], 0, True
    chaves = []
    for ub, idx, folha in _folhas(P, caixa):
        if len(aceitas) >= lim["max_revisoes"] and ub < sorted(chaves)[lim["max_revisoes"] - 1][0] * -1 - tol:
            break  # poda: nada daqui para frente bate a K-ésima melhor
        if nos >= lim["max_nos"]:
            esgotada = False
            break
        nos += 1
        c = _celulas(*folha, P)
        if c is None:
            recusas["núcleo não cabe na profundidade da unidade"] += 1
            continue
        rev, areas = None, None
        if any(L <= c["L"] + EPS and D <= c["D"] + EPS for L, D in sem_lugar):
            recusas["laje não cabe no envelope"] += 1
            continue
        pos, usados = _posicao(cobre, caixa, c["L"], c["D"], P["passo_posicao_m"])
        nos += usados
        if pos is None:
            sem_lugar.append((c["L"], c["D"]))
            recusas["laje não cabe no envelope"] += 1
            continue
        rev, areas = _montar(ctx, folha, c, pos)
        if any(not amin - EPS <= x <= amax + EPS for x in areas):
            recusas["área privativa fora da faixa"] += 1
            continue
        selada = selar(rev)
        achados = validar(selada, selada["site"], selada["rules_ref"])
        motivos = _recusas(achados, tg)
        if motivos:
            recusas.update(sorted(set(motivos)))
            continue
        total = sum(areas)
        fachada = min(f["measured"] for f in achados if f["rule_id"] == "fachada")
        residuo = rev["floor_plates"][0]["residuals_m2"]
        nv = [f for f in achados if f["status"] == "nao_verificado"]
        rev["metrics_summary"] = {
            "unidades": len(areas), "privativa_total_m2": total, "privativa_media_m2": total / len(areas),
            "privativa_min_m2": min(areas), "privativa_max_m2": max(areas), "residuo_m2": residuo,
            "fachada_min_m": fachada, "achados_nao_verificado": len(nv),
            "regras_nao_verificadas": sorted({f["rule_id"] for f in nv}),
            "geracao": {"layout": folha[0], "profundidade_m": folha[1], "largura_m": folha[2], "posicao_nucleo": folha[3],
                        "angulo_deg": th, "origem_faixa_m": list(pos), "ordem": idx, "programa": _canonico(P),
                        "reparos_envelope": reparos}}
        chave = (-round(total, 2), round(residuo, 2), -round(fachada, 2), idx)
        aceitas.append((chave, rev))
        chaves = [k for k, _ in aceitas]
    aceitas.sort(key=lambda x: x[0])
    base["busca"].update(nos=nos, esgotada=esgotada)
    base["recusas"] = dict(recusas.most_common())
    base["motivo"] = recusas.most_common(1)[0][0] if recusas else None
    for i, (chave, rev) in enumerate(aceitas[:lim["max_revisoes"]], 1):
        rev["revision_id"] = f"rev_gerada_{i:02d}"
        base["revisoes"].append(selar(rev))
        base["objetivos"].append({k: rev["metrics_summary"][k] for k in ("privativa_total_m2", "residuo_m2", "fachada_min_m")})
    base["outcome"] = "gerado" if aceitas else "nao_encontrado"
    return base


def _virgula(x, casas=2):
    return f"{x:.{casas}f}".replace(".", ",")


def main(argv=None):
    ap = argparse.ArgumentParser(description="Gera revisões esquemáticas de pavimento a partir de um estudo do motor.")
    ap.add_argument("estudo", type=Path)
    ap.add_argument("--unidades", type=int, default=PADROES["unidades"])
    ap.add_argument("--saida", type=Path, required=True)
    ap.add_argument("--max-nos", type=int, default=LIMITES["max_nos"])
    ap.add_argument("--revisoes", type=int, default=LIMITES["max_revisoes"])
    from viabilidade.projetista.sintese import ESCOPO_PADRAO, avaliar, normalizar_escopo, selar_avaliacao
    ap.add_argument("--escopo", default=",".join(ESCOPO_PADRAO),
                    help="domínios da avaliação, separados por vírgula (padrão: %(default)s)")
    a = ap.parse_args(argv)
    try:
        escopo = normalizar_escopo([d.strip() for d in a.escopo.split(",")])
    except ValueError as erro:
        ap.error(str(erro))
    from viabilidade.projetista.adaptador import estudo_para_site
    estudo, site, regras = estudo_para_site(a.estudo)
    r = gerar_pavimento(site, regras, {"unidades": a.unidades}, {"max_nos": a.max_nos, "max_revisoes": a.revisoes}, estudo)
    b = r["busca"]
    busca = "" if r["outcome"] == "inviavel" else f" (nós: {b['nos']} de {b['limite_nos']}, busca {'completa' if b['esgotada'] else 'cortada pelo limite'})"
    print(f"resultado: {r['outcome']}{busca}")
    if r["reparos_envelope"]:
        print(f"faixas do envelope refeitas sem mudar a área: {len(r['reparos_envelope'])}")
    if r["outcome"] == "inviavel":
        print("inviável, prova: " + r["prova"])
        return 1
    if r["outcome"] == "nao_encontrado":
        print("não encontrado: " + (r["motivo"] or "sem candidatas"))
        return 1
    a.saida.mkdir(parents=True, exist_ok=True)
    for i, rev in enumerate(r["revisoes"], 1):
        gravar(a.saida / f"revisao-{i:02d}.json", rev)
        av = gravar(a.saida / f"avaliacao-{i:02d}.json", avaliar(rev, escopo, {}), selador=selar_avaliacao)
        if i == 1:
            s1 = av["sintese"]
    m = r["revisoes"][0]["metrics_summary"]
    g = m["geracao"]
    print(f"melhor: {m['unidades']} unidades por pavimento, corredor {g['layout']}, núcleo na posição {g['posicao_nucleo']}")
    print(f"área privativa por unidade: média {_virgula(m['privativa_media_m2'])} m² "
          f"({_virgula(m['privativa_min_m2'])} a {_virgula(m['privativa_max_m2'])}); total {_virgula(m['privativa_total_m2'])} m²")
    print(f"resíduo da laje: {_virgula(m['residuo_m2'])} m²; achados nao_verificado: {m['achados_nao_verificado']} "
          f"({', '.join(m['regras_nao_verificadas'])})")
    print(f"síntese da melhor ({', '.join(s1['escopo'])}; sem evidências): {s1['sintese']}, "
          f"regra {s1['regra_da_precedencia']} da precedência")
    print(f"{len(r['revisoes'])} revisão(ões) gravada(s) em {a.saida}, cada uma com a sua avaliacao-NN.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Torre do Projetista (PA-G3): a revisão de UM pavimento vira uma revisão filha com TODOS os pavimentos.

    from viabilidade.projetista.torre import compor
    torre = compor(revisao, terreo=True)

Cada andar tem `id`, `z0_m` e `height_m` próprios (`terreo`, `andar_01`, `andar_02`...). Os elementos de um andar
levam o sufixo dele (`apto_01_andar_02`), porque o esquema exige id único na revisão inteira.

Escalonamento: em cada andar vale a faixa do `envelope_by_height` daquela altura. O que sai da faixa é retirado
DAQUELE andar (e dos de cima); o andar que perdeu algo vira um pavimento próprio, com laje encolhida e outro id.
Circulação (corredor, hall, núcleo) é tudo-ou-nada: se o núcleo sai, a torre acaba; unidade sem acesso a corredor ou
hall que ficou também sai. Quando nenhuma unidade resta, a torre para.

O térreo (núcleo, hall, garagem) e as vagas são premissas geométricas (PADROES_TERREO), não norma.
"""
import copy
import math
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ))
from shapely.geometry import LineString, Polygon
from shapely.ops import split, unary_union
from shapely.validation import make_valid

from viabilidade.projetista.editor import EdicaoRecusada, _conferir, _explicar, _id_revisao, _metricas, _residuo
from viabilidade.projetista.esquema import TOLERANCIAS, _canonico, selar
from viabilidade.projetista.gerador import _recusas
from viabilidade.projetista.validador import _faces, _posicionar, _trecho, medir_areas, validar

OPERACAO = "compor_torre"
# Premissas do térreo e das vagas (não são norma conferida; ficam ditas nos alertas da prévia)
PADROES_TERREO = {
    "pe_direito_m": 3.0,    # altura do térreo; os andares tipo começam em cima dele
    "hall_largura_m": 3.0,  # faixa de hall ao redor do núcleo (cortada pela laje)
    "m2_por_vaga": 25.0,    # área bruta de garagem por vaga, já com circulação
}
ACESSO_MIN_M = 0.1  # trecho mínimo de contato com corredor/hall quando as regras não trazem a largura da porta


# ---- envelope e térreo (movidos de para_vista.py, tarefas 6 e 8) ----

def _envelope(faixas, z0, z1):
    """Mesma regra do validador: interseção das faixas que tocam [z0, z1); None se passa do topo."""
    g = None
    for b in faixas:
        if b["z0_m"] < z1 and b["z1_m"] > z0:
            p = Polygon(b["polygon_m"]) if len(b["polygon_m"]) >= 3 else Polygon()
            if not p.is_valid:
                raise ValueError(f"faixa do envelope em z={b['z0_m']:g}..{b['z1_m']:g} m é inválida")
            g = p if g is None else g.intersection(p)
    if g is None or not faixas or z1 > faixas[-1]["z1_m"] + 1e-9:
        return None
    return g


def _cabe(laje, faixas, z0, z1, tg):
    """(cabe, motivo). `laje` já vem engordada pela meia espessura externa (a face física)."""
    env = _envelope(faixas, z0, z1)
    if env is None:
        topo = faixas[-1]["z1_m"] if faixas else 0
        return False, f"o andar (z {z0:g} a {z1:g} m) passa da altura máxima da caixa ({topo:g} m)"
    fora = laje.difference(env.buffer(tg, join_style="mitre")).area
    if fora > TOLERANCIAS["tol_overlap_m2"]:
        return False, f"o andar (z {z0:g} a {z1:g} m) sai do envelope dessa altura: {fora:.2f} m² para fora"
    return True, None


def _partes(g, rotulo, laje):
    """Polígonos simples e sem buraco (o visualizador não aceita buraco). Anel (hall em volta do núcleo,
    garagem em volta do bloco) é cortado ao meio por uma reta que atravessa o buraco, perpendicular ao lado longo da laje."""
    (ax, ay), (bx, by), (cx, cy) = list(laje.minimum_rotated_rectangle.exterior.coords)[:3]
    lx, ly = (bx - ax, by - ay) if math.hypot(bx - ax, by - ay) >= math.hypot(cx - bx, cy - by) else (cx - bx, cy - by)
    n = math.hypot(lx, ly) or 1.0
    ux, uy = lx / n, ly / n  # lado longo
    saida = []
    for p in getattr(g, "geoms", [g]):
        if p.geom_type != "Polygon" or p.area <= 1e-6:
            continue
        if p.interiors:  # um corte só: serve para anel com um buraco
            hx, hy = Polygon(p.interiors[0]).centroid.coords[0]
            r = 4 * math.hypot(*laje.bounds[2:]) + 1000
            p = [q for q in split(p, LineString([(hx - r * uy, hy + r * ux), (hx + r * uy, hy - r * ux)])).geoms if q.area > 1e-6]
        for q in (p if isinstance(p, list) else [p]):
            if q.interiors:
                raise ValueError(f"{rotulo} com buraco: o visualizador não desenha buraco")
            saida += _sem_cruzar(q)
    return saida


def _sem_cruzar(q):
    """O selo arredonda a 4 casas. Se o contorno se cruza depois disso (vértice quase encostado na própria borda,
    como a garagem do piloto q1382), refaz o polígono já arredondado e separa nos pontos de encosto.
    Contorno que continua válido passa intacto: os bytes de quem já funcionava não mudam."""
    r = Polygon([(round(x, 4), round(y, 4)) for x, y in q.exterior.coords])
    if r.is_valid:
        return [q]
    v = make_valid(r)
    return [p for p in getattr(v, "geoms", [v]) if p.geom_type == "Polygon" and p.area > 1e-3]  # descarta a lasca de ~0,2 cm² do encosto


def nucleo_fundido(laje, cores):
    """Núcleo do térreo: as peças do núcleo fundidas num polígono só (fecha o vão de décimos de mm), cortado pela laje."""
    tol = 0.0006
    return unary_union([g.buffer(tol, join_style="mitre") for g in cores]).buffer(-tol, join_style="mitre").intersection(laje)


def _terreo(placa, cores, P):
    """(núcleo, hall, garagem) do térreo: listas de polígonos locais, sem buraco, sem sobrepor e cobrindo a laje.
    `cores` é a lista de (id, polígono) do núcleo dos andares de cima."""
    if not cores:
        raise ValueError("a revisão não tem núcleo: o térreo precisa dele para o hall")
    laje = Polygon(placa["outline_m"])
    nuc = nucleo_fundido(laje, [g for _, g in cores])
    zona = nuc.buffer(P["hall_largura_m"], join_style="mitre").intersection(laje)
    return (_partes(nuc, "núcleo do térreo", laje), _partes(zona.difference(nuc), "hall", laje),
            _partes(laje.difference(zona), "garagem", laje))


# ---- montagem dos pavimentos ----

def _anel(g):
    return [[x, y] for x, y in g.exterior.coords][:-1]


def _placa_terreo(revisao, base, P, z0):
    _, hall, gar = _terreo(base, [(e["id"], Polygon(e["polygon_m"])) for e in base["cores"]], P)
    comuns = [{"id": f"hall_terreo_{i:02d}", "kind": "hall", "polygon_m": _anel(g), "computable": True} for i, g in enumerate(hall, 1)]
    comuns += [{"id": f"garagem_terreo_{i:02d}", "kind": "garagem", "polygon_m": _anel(g), "computable": False} for i, g in enumerate(gar, 1)]
    placa = {"id": "terreo", "name": "Térreo", "outline_m": copy.deepcopy(base["outline_m"]), "z0_m": z0, "height_m": P["pe_direito_m"],
             "unit_placements": [], "shared_spaces": comuns,
             "cores": [{**copy.deepcopy(e), "id": e["id"] + "_terreo"} for e in base["cores"]], "residuals_m2": 0}
    placa["residuals_m2"] = _residuo(revisao, placa)
    return placa


def _sobrevivem(revisao, vivos, env, tg, limite_porta):
    """O que do andar de baixo continua neste andar (faixa `env`): núcleo tudo-ou-nada, corredor/hall que cabem,
    unidades que cabem E ainda têm acesso a um corredor/hall que ficou. Sem núcleo, não sobra nada."""
    tol = TOLERANCIAS["tol_overlap_m2"]
    if env is None:
        return {"unidades": [], "comuns": [], "nucleos": []}
    zona = env.buffer(tg, join_style="mitre")

    def cabe(g):
        return g.difference(zona).area <= tol

    nucleos = [e for e in vivos["nucleos"] if cabe(Polygon(e["polygon_m"]))]
    if len(nucleos) != len(vivos["nucleos"]):
        return {"unidades": [], "comuns": [], "nucleos": []}
    comuns = [e for e in vivos["comuns"] if cabe(Polygon(e["polygon_m"]))]
    pontes = [Polygon(e["polygon_m"]).boundary for e in comuns if e["kind"] in ("corredor", "hall")]
    acesso = unary_union(pontes) if pontes else None
    tipos = {t["id"]: t for t in revisao["unit_types"]}
    unidades = []
    for p in vivos["unidades"]:
        t = tipos[p["unit_type_id"]]
        face, nominal = _posicionar(_faces(t)[0], p), _posicionar(Polygon(t["outline_m"]), p)
        if cabe(face) and acesso is not None and _trecho(nominal.boundary, acesso, tg) + tg >= max(limite_porta, ACESSO_MIN_M):
            unidades.append(p)
    return {"unidades": unidades, "comuns": comuns, "nucleos": nucleos}


def _placa_tipo(revisao, base, vivos, n, z0, h):
    sfx = f"_andar_{n:02d}"

    def ren(e):
        return {**copy.deepcopy(e), "id": e["id"] + sfx}

    placa = {"id": f"andar_{n:02d}", "name": f"{base['name']} {n}", "outline_m": copy.deepcopy(base["outline_m"]),
             "z0_m": z0, "height_m": h, "unit_placements": [ren(p) for p in vivos["unidades"]],
             "shared_spaces": [ren(e) for e in vivos["comuns"]], "cores": [ren(e) for e in vivos["nucleos"]],
             "residuals_m2": base["residuals_m2"]}
    if sum(map(len, vivos.values())) < len(base["unit_placements"]) + len(base["shared_spaces"]) + len(base["cores"]):
        # andar que perdeu elementos: laje encolhida até o que sobrou, outro resíduo
        tipos = {t["id"]: Polygon(t["outline_m"]) for t in revisao["unit_types"]}
        pecas = [_posicionar(tipos[p["unit_type_id"]], p) for p in vivos["unidades"]]
        pecas += [Polygon(e["polygon_m"]) for e in vivos["comuns"] + vivos["nucleos"]]
        # fecha o vão de décimos de mm entre as peças e deixa a borda ~0,2 mm para fora delas, como o gerador faz:
        # borda colada só toca em pontos, e o validador só aplica a tolerância quando a interseção é vazia
        laje = unary_union([g.buffer(0.0006, join_style="mitre") for g in pecas]).buffer(-0.0004, join_style="mitre").simplify(0.0001)
        if laje.geom_type != "Polygon" or laje.interiors:
            raise ValueError(f"andar {n}: o que sobrou não forma uma laje inteira (peças soltas ou com buraco)")
        placa["outline_m"] = _anel(laje)
        placa["residuals_m2"] = _residuo(revisao, placa)
    return placa


def _montar(revisao, terreo=False, pavimentos=None, premissas_terreo=None, escalonar=True):
    """(pavimentos, resumo) da torre, sem validar nem selar. `escalonar=False` é a regra da prévia (tarefas 6 e 8):
    o andar só existe se a laje inteira cabe na faixa dele."""
    if len(revisao["floor_plates"]) != 1:
        raise ValueError("a torre parte de uma revisão com um só pavimento tipo")
    if pavimentos is not None and (type(pavimentos) is not int or pavimentos < 1):
        raise ValueError("pavimentos deve ser inteiro >= 1")
    base, site, tg = revisao["floor_plates"][0], revisao["site"], TOLERANCIAS["tol_geom_m"]
    tipos = {t["id"]: t for t in revisao["unit_types"]}
    h, z0 = base["height_m"], base["z0_m"]
    meia = max(t["thickness_m"]["externa"] for t in tipos.values()) / 2
    laje = Polygon(base["outline_m"]).buffer(meia, join_style="mitre")
    faixas = site["envelope_by_height"]
    PT = {**PADROES_TERREO, **(premissas_terreo or {})}
    placas, parou = [], None
    if terreo:
        if not (PT["pe_direito_m"] > 0 and PT["hall_largura_m"] > 0 and PT["m2_por_vaga"] > 0):
            raise ValueError("premissas do térreo devem ser positivas")
        cabe, motivo = _cabe(laje, faixas, z0, z0 + PT["pe_direito_m"], tg)
        if not cabe:
            raise ValueError(f"o térreo não cabe: {motivo}")
        placas.append(_placa_terreo(revisao, base, PT, z0))
        z0 += PT["pe_direito_m"]  # os andares tipo começam em cima do térreo
    vivos = {"unidades": base["unit_placements"], "comuns": base["shared_spaces"], "nucleos": base["cores"]}
    limite, n = (pavimentos if pavimentos is not None else 1000), 0
    params = revisao["rules_ref"].get("params", {})
    while n < limite:
        zi = z0 + n * h
        cabe, motivo = _cabe(laje, faixas, zi, zi + h, tg)
        if not cabe:
            if not escalonar:
                parou = motivo
                break
            vivos = _sobrevivem(revisao, vivos, _envelope(faixas, zi, zi + h), tg, params.get("door_width_m") or 0.0)
            if not vivos["unidades"]:
                parou = motivo
                break
        placas.append(_placa_tipo(revisao, base, vivos, n + 1, zi, h))
        n += 1
    if pavimentos is not None and n < pavimentos:
        raise ValueError(f"não cabem {pavimentos} pavimentos: andar {n + 1}: {parou}")
    if n == 0:
        raise ValueError(f"nem o primeiro andar cabe: {parou}")
    return placas, _resumo(revisao, placas, PT if terreo else None, parou)


def _resumo(revisao, placas, PT, parou):
    """`metrics_summary.torre`: cada medida com a sua unidade. A área computável entra depois, vinda do validador."""
    tp = {t["id"]: t for t in revisao["unit_types"]}
    por_andar = {pl["id"]: len(pl["unit_placements"]) for pl in placas}
    privativa = sum(sum(medir_areas(tp[p["unit_type_id"]])["privativa_m2"] for p in pl["unit_placements"]) for pl in placas)
    garagem = [Polygon(e["polygon_m"]).area for pl in placas for e in pl["shared_spaces"] if e["kind"] == "garagem"]
    a_gar = round(sum(garagem), 4)
    return {
        "altura_total": {"valor": round(placas[-1]["z0_m"] + placas[-1]["height_m"] - placas[0]["z0_m"], 4), "unidade": "m"},
        "pavimentos": {"valor": len(placas), "unidade": "pavimentos"},
        "andares_tipo": {"valor": sum(1 for pl in placas if pl["id"] != "terreo"), "unidade": "pavimentos"},
        "unidades": {"valor": sum(por_andar.values()), "unidade": "unidades"},
        "privativa_total": {"valor": round(privativa, 4), "unidade": "m²"},
        "computavel_total": {"valor": None, "unidade": "m²", "nota": "o validador ainda não calculou"},
        "vagas": {"valor": int(a_gar // PT["m2_por_vaga"]) if PT else None, "unidade": "vagas",
                  "nota": "área bruta da garagem dividida pela premissa m2_por_vaga; não é desenho de vaga" if PT else "sem térreo"},
        "area_garagem": {"valor": a_gar if PT else None, "unidade": "m²"},
        "unidades_por_andar": por_andar, "parou": parou, "premissas_terreo": PT}


def compor(revisao, terreo=False, pavimentos=None, premissas_terreo=None):
    """Revisão filha com todos os pavimentos em `floor_plates`. A entrada não muda.

    `pavimentos` conta só os andares tipo (None = até onde couber). Recusa (EdicaoRecusada) se o validador achar
    violação em qualquer pavimento. O id da filha deriva do pai, como no editor, e `metrics_summary.edicao` guarda a
    operação para `editor.cadeia([pai, torre])` valer.
    """
    _conferir(revisao)
    if "torre" in revisao["metrics_summary"]:
        raise EdicaoRecusada(["a revisão já é uma torre; componha a partir da revisão de um pavimento"])
    try:
        placas, resumo = _montar(revisao, terreo, pavimentos, premissas_terreo)
    except ValueError as erro:
        raise EdicaoRecusada([str(erro)]) from erro
    params = {"terreo": bool(terreo), "pavimentos": pavimentos, "premissas_terreo": resumo["premissas_terreo"]}
    rev = copy.deepcopy(revisao)
    rev.update(parent_revision_id=revisao["revision_id"], revision_id=_id_revisao(revisao, OPERACAO, params), content_sha256="")
    rev["floor_plates"] = placas
    rev["metrics_summary"]["edicao"] = {"operacao": OPERACAO, "parametros": params, "forcada": False, "violacoes": []}
    rev["metrics_summary"]["torre"] = resumo
    rev = _canonico(rev)
    selada = selar(rev)
    achados = validar(selada, selada["site"], selada["rules_ref"])
    motivos = _recusas(achados, selada["tolerances"]["tol_geom_m"])
    if motivos:
        raise EdicaoRecusada(_explicar(achados, motivos), achados)
    _metricas(rev, achados)
    ids = {f["id"] for f in rev["floor_plates"]}
    comp = [a["measured"] for a in achados if a["rule_id"] == "areas.computavel" and a["element_ids"][0] in ids]
    if comp and None not in comp:
        rev["metrics_summary"]["torre"]["computavel_total"] = {"valor": round(sum(comp), 4), "unidade": "m²"}
    return selar(rev)

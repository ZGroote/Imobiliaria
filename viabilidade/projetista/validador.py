"""Verificação independente da geração; não modifica revisão, terreno ou regras.

Balanço usa polígonos nominais pelos eixos. Áreas de faces são medidas à parte.
Sem compartimentação interna, a útil é a área livre do invólucro, não área útil final.
PA-G3: limites do prédio inteiro (`torre.*`) contra `rules_ref.params.motor`; limite nulo nunca vira conforme.
"""
import copy
import math
from itertools import combinations

from shapely import affinity
from shapely.errors import GEOSException
from shapely.geometry import LineString, Polygon
from shapely.ops import linemerge, unary_union
from shapely.validation import explain_validity

from .esquema import SCHEMA_VERSION, conferir_estrutura, numero, pontos, selar


def _faces(tipo):
    """Encontro das retas deslocadas: face externa inteira, divisa até o eixo.

    Conserva os cantos por interseção (mitra), sem grade raster ou buffer corretivo.
    Contornos degenerados após descontar espessuras são recusados.
    """
    pts = [tuple(p) for p in tipo["outline_m"]]
    if pts[0] == pts[-1]:
        pts.pop()
    base = Polygon(pts)
    sinal = 1 if base.exterior.is_ccw else -1

    def deslocar(util):
        retas = []
        for a, b, kind in zip(pts, pts[1:] + pts[:1], tipo["edge_kinds"]):
            dx, dy = b[0] - a[0], b[1] - a[1]
            tamanho = math.hypot(dx, dy)
            if tamanho == 0:
                raise ValueError("Aresta de comprimento zero")
            t = tipo["thickness_m"][kind]
            d = -t / 2 if util else t / 2 if kind == "externa" else 0
            retas.append(((a[0] + sinal * dy / tamanho * d, a[1] - sinal * dx / tamanho * d), (dx, dy)))
        contorno = []
        for i, (b, v) in enumerate(retas):
            a, u = retas[i - 1]
            det = u[0] * v[1] - u[1] * v[0]
            if abs(det) <= 1e-12 * math.hypot(*u) * math.hypot(*v):
                if abs((b[0] - a[0]) * u[1] - (b[1] - a[1]) * u[0]) > 1e-9:
                    raise ValueError("Arestas colineares com espessuras/classificações incompatíveis")
                contorno.append(b)
            else:
                k = ((b[0] - a[0]) * v[1] - (b[1] - a[1]) * v[0]) / det
                contorno.append((a[0] + k * u[0], a[1] + k * u[1]))
        face = Polygon(contorno)
        if not face.is_valid or face.area <= 0 or face.exterior.is_ccw != base.exterior.is_ccw:
            raise ValueError("Espessuras consomem ou invalidam a face da unidade")
        if util:
            if not base.buffer(1e-9).covers(face):
                raise ValueError("Face útil saiu do contorno nominal")
            # Uma erosão vazia impede que linhas cruzadas recriem um retângulo fictício.
            minimo = min(tipo["thickness_m"][k] for k in tipo["edge_kinds"]) / 2
            if base.buffer(-minimo, join_style="mitre").is_empty:
                raise ValueError("Não resta piso após descontar espessuras")
        return face

    return deslocar(False), deslocar(True)


def medir_areas(tipo):
    """Três medições distintas; computável adota a inclusão integral conservadora.

    A varanda já faz parte do contorno. A espessura interna fica registrada para a
    próxima fatia; sem paredes internas não há como deduzir sua ocupação do piso.
    """
    privativa, util = _faces(tipo)
    return {"privativa_m2": privativa.area, "util_m2": util.area,
            "computavel_m2": privativa.area}


def _posicionar(poly, p):
    if p["mirror"]:
        poly = affinity.scale(poly, xfact=-1, yfact=1, origin=(0, 0))
    poly = affinity.rotate(poly, p["rot_deg"], origin=(0, 0))
    return affinity.translate(poly, p["x"], p["y"])


def _trecho(a, b, tol):
    """Maior trecho reto contínuo; nunca soma portas/fachadas separadas ou cantos."""
    contato = a.intersection(b)
    if contato.is_empty:
        contato = a.intersection(b.buffer(tol, cap_style="flat", join_style="mitre"))
    linhas = []

    def juntar(g):
        if g.geom_type in ("LineString", "LinearRing"):
            linhas.append(g)
        elif hasattr(g, "geoms"):
            for parte in g.geoms:
                juntar(parte)
    juntar(contato)
    if not linhas:
        return 0.0
    merged = unary_union(linhas)
    if merged.geom_type == "MultiLineString":
        merged = linemerge(merged)
    linhas = []
    juntar(merged)
    return max((math.dist(a, b) for l in linhas for a, b in
                zip(list(l.simplify(tol).coords), list(l.simplify(tol).coords)[1:])), default=0.0)


LIMITES = {"torre.altura": "altura_max_m", "torre.ca": "ca_maximo", "torre.to": "taxa_ocupacao",
           "torre.permeabilidade": "taxa_permeabilidade", "torre.vagas": "vagas_min_por_unidade"}
PILHA_AUSENTE = "pilha de pavimentos ausente"
SEM_LIMITE = "limite não informado"
SEM_PERMEAVEL = "a revisão não modela área permeável"


def _fonte(regras, rule):
    """Fonte própria da regra; para os limites da torre sem fonte própria, a da zona (documentos e `verified` de
    `norma.envelope`, de onde vêm os `params.motor`). Nada inventado: sem nenhuma das duas, fonte vazia."""
    fontes = regras.get("sources", {})
    if rule in fontes or rule not in LIMITES or "norma.envelope" not in fontes:
        return fontes.get(rule, {})
    zona = fontes["norma.envelope"]
    return {"reference": f"rules_ref.params.motor.{LIMITES[rule]} (zona {regras.get('zone_id')})",
            "verified": zona.get("verified") is True, "kind": "norma", "documents": copy.deepcopy(zona.get("documents", []))}


def _limites_da_torre(revisao, site, motor, computaveis, add):
    """Altura, CA, TO, permeabilidade, vagas (só se houver mínimo) e continuidade vertical do prédio inteiro."""
    placas = sorted(revisao["floor_plates"], key=lambda f: f["z0_m"])
    ids = [f["id"] for f in placas]
    regras = ["torre.altura", "torre.ca", "torre.to", "torre.permeabilidade", "torre.continuidade"]
    if motor.get("vagas_min_por_unidade") is not None:
        regras.append("torre.vagas")
    unidade = {"torre.altura": "m", "torre.vagas": "vagas", "torre.continuidade": "un"}
    if not (revisao.get("metrics_summary") or {}).get("torre") and len(placas) < 2:
        for r in regras:
            add(r, False, None, motor.get(LIMITES.get(r)), unidade.get(r, "razao"), ids, PILHA_AUSENTE, pendente=True)
        return
    tol = revisao["tolerances"]
    tg = tol["tol_geom_m"]
    lote = site.get("area_m2") or Polygon(site["polygon_utm"]).area
    eps = tol["tol_area_m2"] / lote

    def contra(r, medido, limite, unid, sugestao):
        add(r, limite is not None and medido <= limite + eps, medido, limite, unid, ids,
            SEM_LIMITE if limite is None else sugestao, pendente=limite is None)

    altura = max(f["z0_m"] + f["height_m"] for f in placas) - placas[0]["z0_m"]
    contra("torre.altura", altura, motor.get("altura_max_m"), "m", "Do piso do pavimento mais baixo ao topo do mais alto")

    basico, maximo = motor.get("ca_basico"), motor.get("ca_maximo")
    if None in computaveis:
        add("torre.ca", False, None, maximo, "razao", ids, "Computável incompleto: há pavimento com elemento inválido", pendente=True)
    else:
        ca = sum(computaveis) / lote
        if maximo is not None and ca > maximo + eps:
            add("torre.ca", False, ca, maximo, "razao", ids, "Computável total ÷ área do lote acima do CA máximo")
        elif basico is not None and ca <= basico + eps:
            add("torre.ca", True, ca, basico, "razao", ids, "Computável total ÷ área do lote até o CA básico")
        elif basico is None or maximo is None:
            add("torre.ca", False, ca, None, "razao", ids, SEM_LIMITE, pendente=True)
        else:  # o validador não tem "condicionado": o mais próximo é pendência, com o motivo dito
            add("torre.ca", False, ca, basico, "razao", ids,
                f"condicionado: acima do CA básico ({basico}) e até o máximo ({maximo}), depende de outorga onerosa", pendente=True)

    garagem_conta = motor.get("garagem_conta_na_taxa_ocupacao") is not False  # ausente: conta (conservador)
    projecao = unary_union([Polygon(f["outline_m"]).difference(unary_union(
        [Polygon(e["polygon_m"]) for e in f["shared_spaces"] if e["kind"] == "garagem" and not garagem_conta]))
        for f in placas])
    contra("torre.to", projecao.area / lote, motor.get("taxa_ocupacao"), "razao",
           "Projeção das lajes ÷ área do lote" + ("" if garagem_conta else ", sem a garagem"))

    add("torre.permeabilidade", False, None, motor.get("taxa_permeabilidade"), "razao", ids, SEM_PERMEAVEL, pendente=True)

    if "torre.vagas" in regras:
        T = (revisao.get("metrics_summary") or {}).get("torre") or {}
        vagas, unidades = (T.get("vagas") or {}).get("valor"), (T.get("unidades") or {}).get("valor")
        if vagas is None or unidades is None:
            add("torre.vagas", False, None, None, "vagas", ids, "A revisão não informa vagas ou unidades da torre", pendente=True)
        else:
            minimo = motor["vagas_min_por_unidade"] * unidades
            add("torre.vagas", vagas >= minimo, vagas, minimo, "vagas", ids, "Vagas declaradas na torre (premissa m²/vaga)")

    def nucleo(f):
        k = {}
        for e in f["cores"]:
            k.setdefault(e["kind"], []).append(Polygon(e["polygon_m"]))
        return {kind: unary_union(v) for kind, v in k.items()}

    falhas, base = [], nucleo(placas[0])
    for baixo, f in zip(placas, placas[1:]):
        topo = baixo["z0_m"] + baixo["height_m"]
        if abs(f["z0_m"] - topo) > tg:
            falhas.append(f"{f['id']} começa em {f['z0_m']} m; o topo de {baixo['id']} é {topo} m")
        aqui = nucleo(f)
        for k in sorted(set(base) | set(aqui)):
            if k not in base or k not in aqui or aqui[k].hausdorff_distance(base[k]) > tg:
                falhas.append(f"núcleo {k} de {f['id']} fora da projeção de {placas[0]['id']}")
    add("torre.continuidade", not falhas, len(falhas), 0, "un", ids,
        "; ".join(falhas) or "Andares encostados e núcleo na mesma projeção")


def validar(revisao, site, regras):
    """Retorna achados determinísticos, inclusive erros de dados, sem reparar entrada."""
    achados = []
    fonte_geo = {"reference": SCHEMA_VERSION + " / PA-G0 4.1", "verified": True, "kind": "geometria"}

    def add(rule, ok, medido, limite, unidade, ids, sugestao="", tecnico=False, pendente=False):
        source = fonte_geo if rule.startswith(("geometria.", "balanco", "contrato", "areas.faces", "areas.declaradas", "areas.varanda_limite", "torre.continuidade")) else _fonte(regras, rule)
        source = dict(source)
        verificado = source.get("verified") is True and bool(source.get("reference"))
        if rule in ("norma.envelope", "areas.computavel") or rule in LIMITES:
            verificado = verificado and regras.get("zone_verified") is True and regras.get("lot_zone_verified") is True and regras.get("params", {}).get("zone_matches_lot") is True
        status = "erro_tecnico" if tecnico else "nao_verificado" if pendente or not verificado else "conforme" if ok else "violacao"
        achados.append({"rule_id": rule, "status": status,
                        "severity": "erro" if status in ("violacao", "erro_tecnico") else "aviso" if status == "nao_verificado" else "info",
                        "measured": medido, "limit": limite, "unit": unidade,
                        "diff": medido - limite if medido is not None and limite is not None else None,
                        "element_ids": list(ids), "source": source, "suggestion": sugestao})

    def poligono(coords, id_, contexto=False, vazio=False):
        try:
            if vazio and coords == []:
                return Polygon()
            pontos(coords, id_)
            g = Polygon(coords)
            valido = g.is_valid and g.area > 0
            add("geometria.poligono", valido, None, None, "", [id_],
                "" if valido else explain_validity(g), tecnico=contexto and not valido)
            return g if valido else None
        except (ValueError, TypeError, GEOSException) as erro:
            add("geometria.poligono", False, None, None, "", [id_], str(erro), tecnico=True)
            return None

    try:
        conferir_estrutura(revisao)
        if revisao.get("content_sha256") and selar(revisao)["content_sha256"] != revisao["content_sha256"]:
            raise ValueError("SHA da revisão não corresponde ao conteúdo")
        if site != revisao["site"] or regras != revisao["rules_ref"] or site["lote_id"] != revisao["study_ref"]["lote_id"]:
            raise ValueError("Site/regras divergem do contexto fixado na revisão; crie nova revisão")
        tol = revisao["tolerances"]
        tg, ta, to = tol["tol_geom_m"], tol["tol_area_m2"], tol["tol_overlap_m2"]
        params = regras["params"]
        for k in ("door_width_m", "facade_min_m", "unit_min_side_m"):
            if params.get(k) is not None:
                if numero(params[k], k, 0) == 0:
                    raise ValueError(f"{k} deve ser positivo")
        tipos = {t["id"]: t for t in revisao["unit_types"]}
        geos, faces = {}, {}
        for t in tipos.values():
            geos[t["id"]] = poligono(t["outline_m"], t["id"])
            if geos[t["id"]] is not None:
                try:
                    faces[t["id"]] = _faces(t)
                    add("areas.faces", True, None, None, "m²", [t["id"]])
                except ValueError as erro:
                    add("areas.faces", False, None, None, "m²", [t["id"]], str(erro))
        computaveis = []
        faixas, fim = [], 0
        for i, b in enumerate(site["envelope_by_height"]):
            z0, z1 = numero(b["z0_m"], "z0_m", 0), numero(b["z1_m"], "z1_m", 0)
            if z0 != fim or z1 <= z0:
                raise ValueError("Faixas de envelope fora de ordem, com lacuna ou sobreposição")
            faixas.append((z0, z1, poligono(b["polygon_m"], f"{site['lote_id']}:envelope:{i}", contexto=True, vazio=True)))
            fim = z1
        if not revisao["floor_plates"]:
            add("geometria.pavimento", False, 0, 1, "pavimento", [revisao["revision_id"]], "Inclua um pavimento")
        for f in revisao["floor_plates"]:
            laje = poligono(f["outline_m"], f["id"])
            if laje is None:
                continue
            elementos, acessos, total = [], [], {"privativa_m2": 0.0, "util_m2": 0.0, "computavel_m2": 0.0}
            completo = True
            for p in f["unit_placements"]:
                g = geos[p["unit_type_id"]]
                if g is None or p["unit_type_id"] not in faces:
                    add("geometria.instancia", False, None, None, "", [p["id"], p["unit_type_id"]], "Tipo possui geometria/faces inválidas")
                    completo = False
                    continue
                t = tipos[p["unit_type_id"]]
                priv, util = faces[t["id"]]
                nominal, fisico = _posicionar(g, p), _posicionar(priv, p)
                elementos.append((p["id"], nominal, fisico))
                limites = (("acesso", "door_width_m"), ("fachada", "facade_min_m"), ("dimensao", "unit_min_side_m"))
                acessos.append((p, nominal, _posicionar(util, p), limites))
                areas = {"privativa_m2": priv.area, "util_m2": util.area, "computavel_m2": priv.area}
                for k, area in areas.items():
                    total[k] += area
                    rule = "areas." + k.removesuffix("_m2")
                    add(rule, True, area, None, "m²", [p["id"]],
                        "Área livre do invólucro; divisórias internas ainda não modeladas" if k == "util_m2" else
                        "Faces externas inteiras/divisas até o eixo; varanda incluída" if k == "privativa_m2" else
                        "Inclusão integral conservadora; enquadramento normativo depende de fonte",
                        pendente=k == "util_m2")
                    if k in t["metrics"]:
                        declarado = numero(t["metrics"][k], k, 0)
                        add("areas.declaradas", abs(area - declarado) <= ta, area, declarado, "m²", [p["id"], t["id"]], k)
                add("areas.varanda_limite", t["balcony_m2"] <= priv.area + ta, t["balcony_m2"], priv.area, "m²", [p["id"]])
                if t["balcony_m2"] > 0:
                    add("areas.varanda_computavel", True, t["balcony_m2"], None, "m²", [p["id"]],
                        "Varanda já incluída no computável; aguarda confirmação jurídica", pendente=True)
            comuns = []
            for e in f["shared_spaces"] + f["cores"]:
                g = poligono(e["polygon_m"], e["id"])
                if g is None:
                    completo = False
                    continue
                elementos.append((e["id"], g, g))
                if e["kind"] in ("corredor", "hall"):
                    comuns.append(g.boundary)
                if e["computable"]:
                    total["computavel_m2"] += g.area
            corredor = unary_union(comuns)
            for p, g, util, limites in acessos:
                coords = list(util.simplify(tg).exterior.coords)
                medidas = {"acesso": _trecho(g.boundary, corredor, tg),
                           "fachada": _trecho(g.boundary, laje.exterior, tg),
                           "dimensao": min(math.dist(a, b) for a, b in zip(coords, coords[1:]))}
                for rule, parametro in limites:
                    limite = params.get(parametro)
                    add(rule, limite is not None and medidas[rule] + tg >= limite, medidas[rule], limite, "m", [p["id"]],
                        "Declare e confira o parâmetro" if limite is None else "Maior contato reto" if rule != "dimensao" else "Menor lado da face útil, sem vértices colineares", pendente=limite is None)
            for id_, g, _ in elementos:
                fora = g.difference(laje.buffer(tg, join_style="mitre")).area
                add("geometria.laje", fora <= to, fora, to, "m²", [id_, f["id"]])
            for a, b in combinations(elementos, 2):
                overlap = max(a[1].intersection(b[1]).area, a[2].intersection(b[2]).area)
                add("geometria.sobreposicao", overlap <= to, overlap, to, "m²", [a[0], b[0]])
            z0, z1 = f["z0_m"], f["z0_m"] + f["height_m"]
            bandas = [g for a, b, g in faixas if a < z1 and b > z0]
            if any(g is None for g in bandas):
                add("geometria.envelope", False, None, None, "m²", [f["id"]], "Envelope de origem inválido", tecnico=True)
            else:
                envelope = bandas[0] if bandas and z1 <= fim else Polygon()
                for g in bandas[1:]:
                    envelope = envelope.intersection(g)
                max_fora = 0.0
                for id_, _, fisico in [(f["id"], laje, laje)] + elementos:
                    fora = fisico.difference(envelope.buffer(tg, join_style="mitre")).area
                    max_fora = max(max_fora, fora)
                    add("geometria.envelope", fora <= to, fora, to, "m²", [id_], "Interseção dos envelopes em toda a altura do pavimento")
                add("norma.envelope", max_fora <= to, max_fora, to, "m²", [f["id"]], "Encaixe geométrico não confirma a legislação")
            if completo:
                soma = sum(g.area for _, g, _ in elementos) + f["residuals_m2"]
                add("balanco", abs(soma - laje.area) <= ta, soma, laje.area, "m²", [f["id"]], "Soma nominal pelos eixos, incluindo resíduo declarado")
                vazio = laje.difference(unary_union([g for _, g, _ in elementos])).area
                add("balanco.residuo", abs(vazio - f["residuals_m2"]) <= ta, vazio, f["residuals_m2"], "m²", [f["id"]])
                total["computavel_m2"] += f["residuals_m2"]  # inclusão conservadora, sem isenção inventada
                computaveis.append(total["computavel_m2"])
                for k, area in total.items():
                    add("areas." + k.removesuffix("_m2"), True, area, None, "m²", [f["id"]],
                        "Soma das instâncias deste pavimento; resíduo computável por premissa" if k == "computavel_m2" else "Soma das instâncias deste pavimento", pendente=k == "util_m2")
            else:
                computaveis.append(None)
                add("balanco", False, None, None, "m²", [f["id"]], "Não é possível fechar áreas com elementos inválidos", tecnico=True)
        _limites_da_torre(revisao, site, params.get("motor") or {}, computaveis, add)
    except (ValueError, KeyError, TypeError, IndexError, GEOSException) as erro:
        add("contrato", False, None, None, "", [revisao.get("revision_id", "revisao") if isinstance(revisao, dict) else "revisao"], str(erro), tecnico=True)
    return achados

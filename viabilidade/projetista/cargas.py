"""PVF-G2: estimativa preliminar de cargas por pavimento, em faixa (mínimo, central, máximo).

Concreto armado convencional (decisão 3). Toda premissa nasce `verified: false`, `revisado_por: null`: ainda
não há calculista. Permanente (g) é peso próprio espalhado por m² de laje; variável (q) é sobrecarga por
ambiente, com valores ESCRITOS a partir da NBR 6120:2019 como premissa, sem afirmar que conferem com ela.

Fora daqui, de propósito: carga em pilar, dimensionamento, combinação de ações (NBR 8681), capacidade de
fundação e comparação com sondagem. O total da torre não é carga na fundação (ver AVISO).
Vínculo (decisão 4): `revision_id` + `content_sha256` + `element_ids`; geometria mudou, cargas caducam.
"""
import copy

from shapely.geometry import Polygon

from viabilidade.projetista.esquema import _canonico, selar, sha256
from viabilidade.projetista.sintese import _revisao_valida
from viabilidade.projetista.validador import _posicionar

METHOD_VERSION = "cargas/0.1.0"
KN, KN_M2, M2 = "kN", "kN/m²", "m²"
SELO = "cargas_sha256"
AVISO = ("Estimativa preliminar em faixa, com premissas não conferidas por engenheiro calculista. "
         "O total da torre não é carga na fundação: aqui não há carga por apoio, combinação de ações (NBR 8681), "
         "dimensionamento, capacidade de fundação nem comparação com sondagem.")
PILHA_AUSENTE = "pilha de pavimentos ausente: a estimativa cobre só o pavimento que está na revisão"


def _p(id_, tipo, faixa, ref, ambiente=None):
    return {"id": id_, "tipo": tipo, "ambiente": ambiente, "valor": dict(zip(("min", "central", "max"), faixa), unidade=KN_M2),
            "referencia": ref, "verified": False, "revisado_por": None}


_NBR = "Valor escrito a partir da ABNT NBR 6120:2019 como premissa; não conferido com o texto da norma"
PREMISSAS_PADRAO = (
    _p("g.laje", "g", (2.5, 3.0, 3.5), "Laje maciça de concreto armado, 25 kN/m³ × 10 a 14 cm de espessura"),
    _p("g.vigas", "g", (0.8, 1.2, 1.8), "Vigas de concreto armado convencional espalhadas por m² de laje (faixa usual de pré-dimensionamento)"),
    _p("g.pilares", "g", (0.4, 0.7, 1.0), "Peso próprio de pilares de um pé-direito espalhado por m² de laje (faixa usual de pré-dimensionamento)"),
    _p("g.paredes", "g", (1.0, 2.0, 3.0), "Alvenaria de vedação espalhada por m² de laje (bloco cerâmico ou de concreto, com revestimento)"),
    _p("g.revestimento", "g", (0.8, 1.0, 1.5), "Contrapiso e piso, 4 a 7 cm"),
    _p("q.unidade", "q", (1.5, 1.5, 2.0), f"{_NBR}: dormitório, sala e cozinha 1,5; área de serviço 2,0", "unidade"),
    _p("q.circulacao", "q", (2.0, 3.0, 3.0), f"{_NBR}: corredor e escada de uso comum", "circulacao"),
    _p("q.hall", "q", (2.0, 3.0, 3.0), f"{_NBR}: hall de uso comum", "hall"),
    _p("q.lazer", "q", (3.0, 3.0, 5.0), f"{_NBR}: salão e áreas de lazer (5,0 se academia ou aglomeração)", "lazer"),
    _p("q.garagem", "q", (3.0, 3.0, 3.0), f"{_NBR}: garagem de veículos leves", "garagem"),
)
# Ambiente de cada elemento. None = vão (elevador, shaft): sem sobrecarga de piso.
AMBIENTE = {"corredor": "circulacao", "escada": "circulacao", "hall": "hall", "lazer": "lazer", "garagem": "garagem",
            "elevador": None, "shaft": None}


def conferir_premissas(premissas):
    """Lista de erros (texto). `verified: true` sem revisado_por completo é erro (decisão 6)."""
    erros, ids = [], set()
    for p in premissas:
        i = p.get("id") if isinstance(p, dict) else None
        if not isinstance(i, str) or i in ids:
            erros.append(f"{i}: id ausente ou repetido")
            continue
        ids.add(i)
        v = p.get("valor") if isinstance(p.get("valor"), dict) else {}
        n = [v.get(k) for k in ("min", "central", "max")]
        if not all(type(x) in (int, float) for x in n) or not 0 < n[0] <= n[1] <= n[2]:
            erros.append(f"{i}: valor precisa de 0 < min ≤ central ≤ max")
        if v.get("unidade") != KN_M2 or p.get("tipo") not in ("g", "q") or not p.get("referencia"):
            erros.append(f"{i}: unidade kN/m², tipo g/q e referência obrigatórios")
        if p.get("verified") is True and not _revisao_valida(p.get("revisado_por")):
            erros.append(f"{i}: verified true sem revisado_por com nome, conselho e registro")
        elif type(p.get("verified")) is not bool:
            erros.append(f"{i}: verified deve ser true/false")
    if not erros and not any(p["tipo"] == "g" for p in premissas):
        erros.append("nenhuma premissa de carga permanente (g)")
    return erros


def _faixa(v, fator, unidade):
    return {"min": v["min"] * fator, "central": v["central"] * fator, "max": v["max"] * fator, "unidade": unidade}


def _soma(faixas, unidade):
    return {k: sum(f[k] for f in faixas) for k in ("min", "central", "max")} | {"unidade": unidade}


def _pavimento(rev, f, premissas):
    tipos = {t["id"]: t for t in rev["unit_types"]}
    area = Polygon(f["outline_m"]).area
    parcelas = [{"tipo": "g", "premissa": p["id"], "element_ids": [f["id"]], "area": {"valor": area, "unidade": M2},
                 "taxa": _faixa(p["valor"], 1, KN_M2), "carga": _faixa(p["valor"], area, KN)}
                for p in premissas if p["tipo"] == "g"]
    q = {p["ambiente"]: p for p in premissas if p["tipo"] == "q"}
    elementos = [(u["id"], "unidade", _posicionar(Polygon(tipos[u["unit_type_id"]]["outline_m"]), u).area)
                 for u in f["unit_placements"]]
    elementos += [(e["id"], AMBIENTE[e["kind"]], Polygon(e["polygon_m"]).area) for e in f["shared_spaces"] + f["cores"]]
    vaos = []
    for id_, amb, a in elementos:
        if amb is None or amb not in q:
            vaos.append({"element_id": id_, "motivo": "vão (elevador/shaft)" if amb is None else f"sem premissa q.{amb}"})
            continue
        parcelas.append({"tipo": "q", "premissa": q[amb]["id"], "element_ids": [id_], "area": {"valor": a, "unidade": M2},
                         "taxa": _faixa(q[amb]["valor"], 1, KN_M2), "carga": _faixa(q[amb]["valor"], a, KN)})
    g = _soma([x["carga"] for x in parcelas if x["tipo"] == "g"], KN)
    qq = _soma([x["carga"] for x in parcelas if x["tipo"] == "q"], KN)
    total = _soma([g, qq], KN)
    return {"id": f["id"], "z0": {"valor": f["z0_m"], "unidade": "m"}, "area_laje": {"valor": area, "unidade": M2},
            "parcelas": parcelas, "sem_sobrecarga": vaos,
            "g": g, "q": qq, "total": total, "total_por_m2": _faixa(total, 1 / area, KN_M2)}


def estimar(revisao, premissas=PREMISSAS_PADRAO):
    """Estimativa selada, ligada à revisão. Pavimentos do topo para a base, com o acumulado."""
    erros = conferir_premissas(premissas)
    if erros:
        raise ValueError("Premissas inválidas: " + "; ".join(erros))
    rev = selar(revisao)
    premissas = copy.deepcopy(list(premissas))
    pavs = [_pavimento(rev, f, premissas) for f in sorted(rev["floor_plates"], key=lambda f: (-f["z0_m"], f["id"]))]
    acumulado = []
    for p in pavs:
        acumulado.append(p["total"])
        p["acumulado_do_topo"] = _soma(acumulado, KN)
    return selar_cargas({
        "method_version": METHOD_VERSION, "revision_id": rev["revision_id"], "revision_sha256": rev["content_sha256"],
        "estrutura": "concreto armado convencional (decisão 3)", "premissas": premissas, "pavimentos": pavs,
        "total_torre": _soma([p["total"] for p in pavs], KN), "aviso": AVISO,
        "avisos": [PILHA_AUSENTE] if len(pavs) == 1 else []})


def selar_cargas(resultado):
    r = _canonico(resultado)
    r.pop(SELO, None)
    r[SELO] = sha256(r)
    return r


def cargas_validas(resultado, revisao):
    """(True, "") ou (False, motivo), como `avaliacao_valida`: a revisão é conferida pelo conteúdo."""
    try:
        if selar_cargas(resultado)[SELO] != resultado.get(SELO):
            return False, "selo"
    except (ValueError, AttributeError):
        return False, "selo"
    if resultado.get("method_version") != METHOD_VERSION:
        return False, "versão do método mudou"
    if conferir_premissas(resultado.get("premissas") or []):
        return False, "premissas inválidas"
    try:
        conteudo = selar(revisao)["content_sha256"]
    except (ValueError, KeyError, TypeError, AttributeError):
        return False, "revisão malformada"
    if revisao.get("parent_revision_id") == resultado.get("revision_id"):
        return False, "geometria mudou: a revisão foi editada depois da estimativa"
    if resultado.get("revision_id") != revisao.get("revision_id"):
        return False, "outra revisão"
    if conteudo != resultado.get("revision_sha256") or revisao.get("content_sha256") != conteudo:
        return False, "geometria mudou"
    return True, ""

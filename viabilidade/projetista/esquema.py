"""Contrato local do Projetista. Geometria em metros pelos eixos das paredes.

Tipos são dicionários JSON; não há gerador de IDs, relógio ou geometria implícita.
O SHA cobre o documento canônico inteiro, exceto o próprio content_sha256.
"""
import hashlib
import json
import math
import os
from pathlib import Path
import re
import tempfile
from typing import TypedDict

SCHEMA_VERSION = "projetista/0.1.0"
TOLERANCIAS = {"tol_area_m2": 0.01, "tol_geom_m": 0.001, "tol_overlap_m2": 0.0001}


class StudyReference(TypedDict):
    study_id: str
    study_sha256: str
    motor_version: str
    lote_id: str
    created_at: str | None


class Site(TypedDict):
    lote_id: str
    crs: str
    polygon_utm: list
    front_utm: list
    local_frame: dict
    area_m2: float
    envelope_by_height: list  # {z0_m, z1_m, polygon_m}; intervalos [z0, z1)


class RuleSetReference(TypedDict):
    zone_id: str
    zone_verified: bool
    lot_zone_verified: bool
    rules_version: str
    params: dict
    sources: dict  # rule_id -> {reference, verified, kind}; não confundir premissa e lei


class UnitType(TypedDict):
    id: str
    name: str
    version: str
    outline_m: list
    thickness_m: dict  # interna, externa e divisa; cada valor é explícito
    edge_kinds: list  # externa/divisa, uma por aresta; não são paredes detalhadas
    balcony_m2: float  # parte já incluída no contorno, nunca somada outra vez
    metrics: dict


class SharedSpace(TypedDict):
    id: str
    kind: str
    polygon_m: list
    computable: bool


class Core(TypedDict):
    id: str
    kind: str
    polygon_m: list
    computable: bool


class FloorPlate(TypedDict):
    id: str
    name: str
    outline_m: list
    z0_m: float
    height_m: float
    unit_placements: list  # {id, unit_type_id, x, y, rot_deg, mirror}; giro em (0,0)
    shared_spaces: list[SharedSpace]
    cores: list[Core]
    residuals_m2: float


class ValidationFinding(TypedDict):
    rule_id: str
    status: str
    severity: str
    measured: float | None
    limit: float | None
    unit: str
    diff: float | None
    element_ids: list[str]
    source: dict
    suggestion: str


class DesignRevision(TypedDict):
    schema_version: str
    unit: str
    revision_id: str
    parent_revision_id: str | None
    content_sha256: str
    study_ref: StudyReference
    site: Site
    rules_ref: RuleSetReference
    status: str
    tolerances: dict
    unit_types: list[UnitType]
    floor_plates: list[FloorPlate]
    metrics_summary: dict


def numero(v, nome, minimo=None):
    if type(v) not in (int, float) or not math.isfinite(v) or (minimo is not None and v < minimo):
        raise ValueError(f"{nome}: número finito" + (f" >= {minimo}" if minimo is not None else "") + " obrigatório")
    return v


def texto(v, nome):
    if not isinstance(v, str) or not v.strip():
        raise ValueError(f"{nome}: texto não vazio obrigatório")
    return v


def pontos(v, nome, minimo=3):
    if not isinstance(v, list) or len(v) < minimo:
        raise ValueError(f"{nome}: lista com pelo menos {minimo} pontos obrigatória")
    for p in v:
        if not isinstance(p, (list, tuple)) or len(p) != 2:
            raise ValueError(f"{nome}: ponto deve ser [x, y]")
        for n in p:
            numero(n, nome)
    return v


def _canonico(v):
    if isinstance(v, dict):
        if any(not isinstance(k, str) for k in v):
            raise ValueError("Chave JSON deve ser texto")
        return {k: _canonico(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_canonico(x) for x in v]
    if type(v) is float:
        numero(v, "JSON")
        n = round(v, 4)
        return int(n) if n.is_integer() else n
    if v is None or type(v) in (str, int, bool):
        return v
    raise ValueError(f"Tipo não JSON: {type(v).__name__}")


def serializar(dado):
    """UTF-8, LF, chaves ordenadas; números arredondados a quatro casas decimais."""
    return (json.dumps(_canonico(dado), ensure_ascii=False, sort_keys=True,
                       separators=(",", ":"), allow_nan=False) + "\n").encode("utf-8")


def sha256(dado):
    return hashlib.sha256(serializar(dado)).hexdigest()


def _objeto(pares):
    out = {}
    for k, v in pares:
        if k in out:
            raise ValueError(f"Chave JSON duplicada: {k}")
        out[k] = v
    return out


def carregar_json(conteudo):
    def invalido(v):
        raise ValueError(f"Constante JSON inválida: {v}")
    return json.loads(conteudo, object_pairs_hook=_objeto, parse_constant=invalido)


def conferir_estrutura(r):
    """Valida o contrato, não repara polígonos: isso é responsabilidade do validador."""
    serializar(r)  # recusa tipos estranhos, NaN e infinito também em metadados
    if not isinstance(r, dict) or r.get("schema_version") != SCHEMA_VERSION or r.get("unit") != "m":
        raise ValueError("Esquema/unidade não suportados")
    for k in ("revision_id", "status"):
        texto(r[k], k)
    if r["status"] not in ("RASCUNHO", "REQUER_REVALIDACAO"):
        raise ValueError("Status de revisão não suportado")
    if r["parent_revision_id"] is not None:
        texto(r["parent_revision_id"], "parent_revision_id")
    for k in ("study_ref", "site", "rules_ref", "metrics_summary", "tolerances"):
        if not isinstance(r[k], dict):
            raise ValueError(f"{k}: objeto obrigatório")
    study, site, rules = r["study_ref"], r["site"], r["rules_ref"]
    for k in ("study_id", "motor_version", "lote_id"):
        texto(study[k], k)
    if not isinstance(study["study_sha256"], str) or not re.fullmatch(r"[a-f0-9]{64}", study["study_sha256"]):
        raise ValueError("study_sha256 inválido")
    if study["created_at"] is not None:
        texto(study["created_at"], "created_at")
    if site["crs"] != "EPSG:31983" or site["lote_id"] != study["lote_id"]:
        raise ValueError("CRS ou vínculo do terreno inválido")
    pontos(site["polygon_utm"], "polygon_utm")
    if len(pontos(site["front_utm"], "front_utm", 2)) != 2:
        raise ValueError("front_utm deve ter dois pontos")
    frame = site["local_frame"]
    pontos([frame[k] for k in ("origem", "u", "v")], "local_frame")
    u, v = frame["u"], frame["v"]
    if abs(math.hypot(*u) - 1) > 0.0002 or abs(math.hypot(*v) - 1) > 0.0002 or abs(sum(a*b for a, b in zip(u, v))) > 0.0002:
        raise ValueError("Referencial local deve ter eixos ortonormais")
    numero(site["area_m2"], "area_m2", 0)
    if not isinstance(site["envelope_by_height"], list):
        raise ValueError("envelope_by_height deve ser lista")
    for b in site["envelope_by_height"]:
        numero(b["z0_m"], "z0_m", 0)
        numero(b["z1_m"], "z1_m", 0)
        if b["polygon_m"] != []:
            pontos(b["polygon_m"], "envelope")
    texto(rules["zone_id"], "zone_id")
    texto(rules["rules_version"], "rules_version")
    for k in ("zone_verified", "lot_zone_verified"):
        if type(rules[k]) is not bool:
            raise ValueError(f"{k} deve ser booleano")
    if not isinstance(rules["params"], dict) or not isinstance(rules["sources"], dict):
        raise ValueError("params/sources devem ser objetos")
    for source in rules["sources"].values():
        if not isinstance(source, dict) or type(source.get("verified")) is not bool:
            raise ValueError("Fonte deve declarar verified booleano")
        texto(source["reference"], "source.reference")
        if source["kind"] not in ("geometria", "premissa", "norma"):
            raise ValueError("source.kind inválido")
    for k in TOLERANCIAS:
        numero(r["tolerances"][k], k, 0)
    for k in ("unit_types", "floor_plates"):
        if not isinstance(r[k], list):
            raise ValueError(f"{k}: lista obrigatória")
    ids, tipos = set(), set()

    def identidade(e):
        i = texto(e["id"], "id")
        if i in ids:
            raise ValueError(f"ID duplicado: {i}")
        ids.add(i)

    for t in r["unit_types"]:
        identidade(t)
        tipos.add(t["id"])
        texto(t["name"], "name")
        texto(t["version"], "version")
        pontos(t["outline_m"], t["id"])
        for k in ("interna", "externa", "divisa"):
            if numero(t["thickness_m"][k], k, 0) == 0:
                raise ValueError("Espessura deve ser positiva")
        n = len(t["outline_m"]) - (t["outline_m"][0] == t["outline_m"][-1])
        if not isinstance(t["edge_kinds"], list) or len(t["edge_kinds"]) != n or any(k not in ("externa", "divisa") for k in t["edge_kinds"]):
            raise ValueError(f"{t['id']}: classifique cada aresta como externa/divisa")
        numero(t["balcony_m2"], "balcony_m2", 0)
        if not isinstance(t["metrics"], dict):
            raise ValueError("metrics deve ser objeto")
    for f in r["floor_plates"]:
        identidade(f)
        pontos(f["outline_m"], f["id"])
        numero(f["z0_m"], "z0_m", 0)
        if numero(f["height_m"], "height_m", 0) == 0:
            raise ValueError("height_m deve ser positiva")
        numero(f["residuals_m2"], "residuals_m2", 0)
        for k in ("unit_placements", "shared_spaces", "cores"):
            if not isinstance(f[k], list):
                raise ValueError(f"{k}: lista obrigatória")
        for p in f["unit_placements"]:
            identidade(p)
            if p["unit_type_id"] not in tipos:
                raise ValueError(f"{p['id']}: unit_type_id inexistente")
            for k in ("x", "y", "rot_deg"):
                numero(p[k], k)
            if type(p["mirror"]) is not bool:
                raise ValueError("mirror deve ser booleano")
        for e in f["shared_spaces"] + f["cores"]:
            identidade(e)
            pontos(e["polygon_m"], e["id"])
            permitidos = ("corredor", "hall", "lazer", "garagem") if e in f["shared_spaces"] else ("escada", "elevador", "shaft")
            if e["kind"] not in permitidos or type(e["computable"]) is not bool:
                raise ValueError(f"{e['id']}: kind/computable inválidos")


def selar(revisao):
    """Cópia arredondada e selada; o argumento permanece intacto."""
    r = _canonico(revisao)
    conferir_estrutura(r)
    r.pop("content_sha256", None)
    r["content_sha256"] = sha256(r)
    return r


def ler(caminho):
    try:
        r = carregar_json(Path(caminho).read_bytes())
        esperado = selar(r)
        if r.get("content_sha256") != esperado["content_sha256"] or r != esperado:
            raise ValueError("content_sha256 divergente ou números fora da precisão canônica")
        return r
    except (KeyError, TypeError) as erro:
        raise ValueError(f"Revisão malformada: {erro}") from erro


def gravar(caminho, revisao, selador=selar):
    """Snapshot local: não substitui conteúdo diferente; temporário no mesmo diretório.

    `selador` troca o selo (a avaliação da síntese não é revisão e tem selo próprio).
    """
    r = selador(revisao)
    path = Path(caminho)
    dados = serializar(r)
    if path.exists():
        if path.read_bytes() == dados:
            return r
        raise FileExistsError("Snapshot já existe com outro conteúdo; use nova revisão/arquivo")
    temporario = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".projetista-", suffix=".tmp", delete=False) as f:
            temporario = Path(f.name)
            f.write(dados)
            f.flush()
            os.fsync(f.fileno())
        # shortcut: escritor local único; adicionar exclusão mútua antes de colaboração concorrente.
        os.replace(temporario, path)
    finally:
        if temporario is not None:
            temporario.unlink(missing_ok=True)
    return r

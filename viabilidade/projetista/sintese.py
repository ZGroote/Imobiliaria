"""PVF-G1: domínio, proveniência e síntese por cima dos achados do `validador.validar`.

Trabalha numa cópia; a lista do validador nunca muda. Sem relógio: mesma entrada, mesma saída.
Não existe campo `viavel`: o resultado é um estado por domínio e uma síntese conservadora.
"""
import copy

from viabilidade.projetista.esquema import SCHEMA_VERSION, _canonico, selar, sha256
from viabilidade.projetista.validador import validar

METHOD_VERSION = "sintese/0.2.0"
ENGINE_VERSION = f"{SCHEMA_VERSION}+{METHOD_VERSION}"
ESCOPO_PADRAO = ("geometrico", "urbanistico", "arquitetonico")
DOMINIOS = ("geometrico", "urbanistico", "arquitetonico", "estrutural", "geotecnico", "economico")
ESTADOS = ("conforme", "violacao", "nao_verificado", "erro_tecnico", "nao_aplicavel")
INCONSISTENTE = "INCONSISTENTE_NOS_DOMINIOS_VERIFICADOS"
HIPOTESE = "HIPOTESE_PRELIMINAR"
CONDICIONAL = "CONDICIONAL_COM_PENDENCIAS"
VERIFICADO = "VERIFICADO_NO_ESCOPO_DECLARADO"
AVISO = ("Resultado preliminar e automático, limitado ao escopo declarado. Não é aprovação legal, "
         "nem projeto executivo, nem certificação de segurança estrutural ou geotécnica.")

# Prefixo terminado em "." casa o grupo; os outros casam o nome exato ou "nome.sub".
PREFIXOS = (
    ("geometria.", "geometrico"), ("balanco", "geometrico"), ("contrato", "geometrico"),
    ("areas.faces", "geometrico"), ("areas.declaradas", "geometrico"), ("areas.varanda_limite", "geometrico"),
    ("norma.", "urbanistico"), ("areas.computavel", "urbanistico"), ("areas.varanda_computavel", "urbanistico"),
    ("arquitetura.", "arquitetonico"), ("estrutura.", "estrutural"), ("geotecnia.", "geotecnico"),
    ("economia.", "economico"),
    # O validador 0.1.0 emite estes sem prefixo de domínio; fora daqui todo piloto viraria erro_tecnico.
    ("acesso", "arquitetonico"), ("fachada", "arquitetonico"), ("dimensao", "arquitetonico"),
    ("areas.privativa", "geometrico"), ("areas.util", "geometrico"),
)
# Unidade do achado -> grandeza. Unidade vazia (ex.: polígono válido ou não) não é grandeza.
GRANDEZAS = {"m²": "area", "m2": "area", "m": "comprimento", "pavimento": "contagem", "un": "contagem",
             "%": "razao", "razao": "razao"}
ACOES = {"areas.util": ["Modelar as divisórias internas para medir a área útil final"],
         "areas.varanda_computavel": ["Confirmação jurídica do cômputo da varanda"]}


def dominio(rule_id):
    if not isinstance(rule_id, str):
        return None
    for prefixo, d in PREFIXOS:
        if rule_id.startswith(prefixo) if prefixo.endswith(".") else rule_id == prefixo or rule_id.startswith(prefixo + "."):
            return d
    return None


def _texto(v):
    return v.strip() if isinstance(v, str) else ""


def _acoes(f, status):
    rule = f.get("rule_id")
    if status == "erro_tecnico":
        return ["Corrigir a entrada ou a regra e validar de novo"]
    if status == "violacao":
        return [f"Ajustar o projeto até atender {rule}"]
    if status != "nao_verificado":
        return []
    fonte = f.get("source") if isinstance(f.get("source"), dict) else {}
    acoes = []
    if not (fonte.get("verified") is True and _texto(fonte.get("reference"))):
        acoes.append(f"Registrar e conferir a fonte de {rule}")
    if rule in ("norma.envelope", "areas.computavel"):
        acoes.append("Conferir a zona do lote e a correspondência com a zona das regras")
    if f.get("limit") is None and f.get("unit") == "m":
        acoes.append(f"Declarar o parâmetro de {rule}")
    return acoes + ACOES.get(rule, []) or [f"Executar a verificação de {rule}"]


def _grandeza(f, versao_regras):
    """Campos de grandeza (PRD seção 7). Faltou? null e o motivo em `null_reasons`; nada inventado."""
    fonte = f.get("source") if isinstance(f.get("source"), dict) else {}
    ref, kind, unit = _texto(fonte.get("reference")), fonte.get("kind"), f.get("unit")
    faltas = {}
    qk = GRANDEZAS.get(unit) if isinstance(unit, str) else None
    if qk is None:
        faltas["quantity_kind"] = f"Unidade {unit!r} não corresponde a uma grandeza"
    if _texto(fonte.get("version")):
        versao = fonte["version"]
    elif kind == "geometria":
        versao = SCHEMA_VERSION  # a fonte é o próprio contrato de geometria do validador
    elif versao_regras and fonte:
        versao = f"rules_version {versao_regras}"
    else:
        versao = None
        faltas["source_version"] = "Fonte sem versão e conjunto de regras sem rules_version" if fonte else "Achado sem fonte"
    if kind == "premissa" and ref:
        confianca = "premissa"
    elif fonte.get("verified") is True and ref:
        confianca = "fonte_conferida"
    else:
        confianca = "sem_fonte"
    return {"quantity_kind": qk, "assumptions": [ref] if kind == "premissa" and ref else [],
            "source_version": versao, "confidence": confianca, "engine_version": ENGINE_VERSION,
            "null_reasons": faltas}


def classificar(achados, escopo=DOMINIOS, versao_regras=None):
    """Cópia dos achados com domínio e proveniência; nada é descartado."""
    saida = []
    for f in copy.deepcopy(list(achados)):
        f = f if isinstance(f, dict) else {"rule_id": None, "status": None, "original": f}
        d, status = dominio(f.get("rule_id")), f.get("status")
        reason = _texto(f.get("reason")) or _texto(f.get("suggestion"))
        if d is None:
            status, reason = "erro_tecnico", f"Regra sem domínio: {f.get('rule_id')!r}"
        elif status not in ESTADOS:
            status, reason = "erro_tecnico", f"Estado desconhecido: {status!r}"
        elif status == "nao_aplicavel" and not _texto(f.get("reason")):
            status, reason = "erro_tecnico", "nao_aplicavel sem justificativa"
        if status != f.get("status"):
            f["status_original"], f["status"], f["severity"] = f.get("status"), status, "erro"
        f.update({"domain": d, "method_version": METHOD_VERSION,
                  "scope": "no_escopo" if d in escopo else "fora_do_escopo",
                  "reason": reason, "required_actions": _acoes(f, status), **_grandeza(f, versao_regras)})
        saida.append(f)
    return saida


def _revisao_valida(r):
    return isinstance(r, dict) and all(_texto(r.get(k)) for k in ("nome", "conselho", "registro"))


def normalizar_escopo(escopo):
    if not isinstance(escopo, (list, tuple)) or not escopo or len(set(escopo)) != len(escopo) \
            or any(d not in DOMINIOS for d in escopo):
        raise ValueError(f"Escopo inválido: use domínios distintos de {DOMINIOS}")
    return [d for d in DOMINIOS if d in escopo]


def sintetizar(achados, escopo, evidencias, versao_regras=None):
    """Assessment determinístico; a primeira regra da precedência que bater vale."""
    escopo = normalizar_escopo(escopo)
    evidencias = evidencias if isinstance(evidencias, dict) else {}
    ach = classificar(achados, escopo, versao_regras)

    dominios = {}
    for d in DOMINIOS:
        fs = [f for f in ach if f["domain"] == d]
        cont = {e: sum(f["status"] == e for f in fs) for e in ESTADOS}
        if d == "economico":  # decisão 7: custo só no PVF-G5
            estado = "erro_tecnico" if cont["erro_tecnico"] else "dados_insuficientes"
        else:
            estado = next(e for e, ok in (("violacao", cont["violacao"]), ("erro_tecnico", cont["erro_tecnico"]),
                                          ("nao_verificado", cont["nao_verificado"] or not fs),
                                          ("conforme", cont["conforme"]), ("nao_aplicavel", True)) if ok)
        dominios[d] = {"no_escopo": d in escopo, "estado": estado, "contagem": cont,
                       "pendentes": sorted({f["rule_id"] for f in fs if f["status"] == "nao_verificado"}),
                       "required_actions": [] if fs else [f"Nenhuma verificação {d} implementada nesta versão"]}

    no = [dominios[d] for d in escopo]
    if any(x["contagem"]["violacao"] for x in no):
        sintese, regra = INCONSISTENTE, 1
    elif any(f["status"] == "erro_tecnico" for f in ach) or any(not x["contagem"]["conforme"] for x in no):
        sintese, regra = HIPOTESE, 2
    elif any(x["estado"] == "nao_verificado" or x["contagem"]["nao_verificado"] for x in no):
        sintese, regra = CONDICIONAL, 3
    else:
        sintese, regra = VERIFICADO, 4

    motivos = []
    if {"estrutural", "geotecnico"} & set(escopo):  # decisão 5
        if evidencias.get("sondagem") is not True:
            motivos.append("Falta sondagem do terreno")
        if not _texto(evidencias.get("metodo_estrutural")):
            motivos.append("Falta método estrutural habilitado")
        revisoes = evidencias.get("revisao_profissional")
        revisoes = revisoes if isinstance(revisoes, dict) else {}
        for d in ("estrutural", "geotecnico"):
            if d in escopo and not _revisao_valida(revisoes.get(d)):
                motivos.append(f"Falta revisão profissional {d} com nome, conselho e registro")
    if motivos and sintese == VERIFICADO:
        sintese = CONDICIONAL

    return {"method_version": METHOD_VERSION, "escopo": escopo, "sintese": sintese,
            "regra_da_precedencia": regra, "motivos_trava": motivos, "dominios": dominios,
            "fora_do_escopo": [{"domain": d, "motivo": "Fora do escopo declarado: não entra na síntese",
                                "contagem": dominios[d]["contagem"]} for d in DOMINIOS if d not in escopo],
            "regras_sem_dominio": [f["rule_id"] for f in ach if f["domain"] is None],
            "achados": ach, "aviso": AVISO}


def selar_avaliacao(avaliacao):
    """Cópia canônica com `avaliacao_sha256` (o selo cobre todo o resto)."""
    a = _canonico(avaliacao)
    a.pop("avaliacao_sha256", None)
    a["avaliacao_sha256"] = sha256(a)
    return a


def avaliar(revisao, escopo=ESCOPO_PADRAO, evidencias=None):
    """Avaliação selada e ligada à revisão (decisão 4). Arquivo à parte: nunca entra na DesignRevision."""
    rules = revisao["rules_ref"]
    evidencias = copy.deepcopy(evidencias) if isinstance(evidencias, dict) else {}
    s = sintetizar(validar(revisao, revisao["site"], rules), escopo, evidencias, rules.get("rules_version"))
    # 0.2.0: a fonte sai do achado e entra uma vez em `fontes`; os campos de grandeza já foram calculados dela.
    fontes = {}
    for f in s["achados"]:
        fonte = f.pop("source", None)
        if fonte is not None:
            f["source_ref"] = sha256(fonte)[:16]
            fontes[f["source_ref"]] = fonte
    return selar_avaliacao({"revision_id": revisao["revision_id"], "revision_sha256": revisao["content_sha256"],
                            "escopo": s["escopo"], "evidencias": evidencias, "method_version": METHOD_VERSION,
                            "engine_version": ENGINE_VERSION, "fontes": fontes, "sintese": s})


def avaliacao_valida(avaliacao, revisao):
    """(True, "") ou (False, motivo). A revisão é conferida pelo conteúdo, não só pelo selo que ela carrega."""
    try:
        if selar_avaliacao(avaliacao)["avaliacao_sha256"] != avaliacao.get("avaliacao_sha256"):
            return False, "selo"
    except (ValueError, AttributeError):
        return False, "selo"
    if avaliacao.get("method_version") != METHOD_VERSION or avaliacao.get("engine_version") != ENGINE_VERSION:
        return False, "versão do método mudou"
    try:
        conteudo = selar(revisao)["content_sha256"]
    except (ValueError, KeyError, TypeError, AttributeError):
        return False, "revisão malformada"
    if avaliacao.get("revision_id") != revisao.get("revision_id"):
        return False, "outra revisão"
    if conteudo != avaliacao.get("revision_sha256") or revisao.get("content_sha256") != conteudo:
        return False, "geometria mudou"
    return True, ""

"""PVF-G1: domínio, proveniência e síntese por cima dos achados do `validador.validar`.

Trabalha numa cópia; a lista do validador nunca muda. Sem relógio: mesma entrada, mesma saída.
Não existe campo `viavel`: o resultado é um estado por domínio e uma síntese conservadora.
"""
import copy

METHOD_VERSION = "sintese/0.1.0"
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


def classificar(achados, escopo=DOMINIOS):
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
                  "reason": reason, "required_actions": _acoes(f, status)})
        saida.append(f)
    return saida


def _revisao_valida(r):
    return isinstance(r, dict) and all(_texto(r.get(k)) for k in ("nome", "conselho", "registro"))


def sintetizar(achados, escopo, evidencias):
    """Assessment determinístico; a primeira regra da precedência que bater vale."""
    if not isinstance(escopo, (list, tuple)) or not escopo or len(set(escopo)) != len(escopo) \
            or any(d not in DOMINIOS for d in escopo):
        raise ValueError(f"Escopo inválido: use domínios distintos de {DOMINIOS}")
    escopo = [d for d in DOMINIOS if d in escopo]
    evidencias = evidencias if isinstance(evidencias, dict) else {}
    ach = classificar(achados, escopo)

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

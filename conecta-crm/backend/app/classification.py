"""Pré-triagem local. Conteúdo recebido nunca vira comando, prompt ou autorização de envio."""
import json
import re
import unicodedata
from datetime import datetime, timezone
from email.utils import parseaddr

from sqlalchemy import bindparam, text
from .outbound_guards import block_recipient, pause_followups

VERSION = "rules-v1"
LABELS = {
    "pricing_request":("Pedido de orçamento","P1"),
    "demo_request":("Pedido de demonstração","P1"),
    "technical_question":("Dúvida técnica","P2"),
    "positive_interest":("Interesse","P2"),
    "not_interested":("Sem interesse","P3"),
    "unsubscribe":("Descadastro","P0"),
    "automatic_reply":("Mensagem automática","P3"),
    "other":("Revisar conversa","P3"),
}
CATEGORY_QUERY = """SELECT mc.category FROM effective_classifications mc JOIN messages m ON m.id=mc.message_id
    WHERE m.thread_id=t.id ORDER BY CASE WHEN mc.category='unsubscribe' THEN 0
    WHEN mc.category='automatic_reply' THEN 2 ELSE 1 END, m.received_at DESC,m.id DESC LIMIT 1"""


def normalize_address(value):
    if not isinstance(value,str) or len(value)>2000 or any(c in value for c in "\r\n\x00"):
        return None
    _, address = parseaddr(value)
    if not re.fullmatch(r"[^@\s<>]{1,64}@[^@\s<>]{1,253}",address):
        return None
    local, domain = address.rsplit("@",1)
    try:
        domain = domain.encode("idna").decode("ascii").lower()
    except UnicodeError:
        return None
    if "." not in domain or any(not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?",part) for part in domain.split(".")):
        return None
    result = local.casefold()+"@"+domain
    return result if len(result)<=254 else None


def fold(value):
    return "".join(c for c in unicodedata.normalize("NFKD",value.casefold()) if not unicodedata.combining(c))


def latest_reply(body):
    lines = []
    for line in body[:16000].splitlines():
        stripped = fold(line.strip())
        if (stripped.startswith(">") or stripped in ("--","-----original message-----","-----mensagem original-----")
                or re.match(r"^(on .{1,250}wrote:|em .{1,250}escreveu:|begin forwarded message:|[- ]*forwarded message[- ]*)$",stripped)):
            break
        if re.match(r"^(from|de):\s*.+@",stripped) and lines:
            break
        lines.append(line)
    return "\n".join(lines).strip()


def classify(subject, body, headers):
    recent = latest_reply(body)
    first = next((line.strip() for line in recent.splitlines() if line.strip()),"")
    # Assunto herdado não deve sobrepor a intenção da resposta mais recente.
    content = fold(recent if recent else subject if not body.strip() else "")
    headers = {str(k).lower():str(v).lower() for k,v in headers.items()}
    automatic = headers.get("auto-submitted","").strip()
    if (automatic and automatic != "no") or headers.get("precedence","") in ("bulk","list","junk"):
        return "automatic_reply",.95,"Cabeçalho indica geração automática; revise antes de agir.",recent[:180]
    optout = re.search(r"\b(?:please\s+)?(?:unsubscribe me|remove me from (?:your |the )?(?:mailing )?list|stop (?:emailing|contacting|sending emails to) me|do not (?:email|contact) me|don['’]?t (?:email|contact) me|nao (?:quero|desejo) receber (?:mais )?(?:emails|e-mails|mensagens)|(?:retire|remova|exclua) (?:meu (?:email|e-mail)|me) (?:da|de sua) lista|pare de (?:me )?enviar (?:emails|e-mails|mensagens))\b",content)
    standalone = re.fullmatch(r"(?:please )?(?:unsubscribe|descadastrar|remover da lista)[.! ]*",fold(first))
    subject_optout = not body.strip() and re.fullmatch(r"(?:re:\s*)?(?:unsubscribe|pedido de descadastro|descadastrar)[.! ]*",fold(subject.strip()))
    if optout or standalone or subject_optout:
        return "unsubscribe",.98,"Pedido explícito de retirada; contato bloqueado localmente.",(optout.group(0) if optout else first or subject)[:180]
    refusal = re.search(r"\b(?:not interested|no interest|sem interesse|nao (?:temos|tenho) interesse)\b",content)
    if refusal:
        return "not_interested",.9,"Recusa explícita; novas abordagens ficam bloqueadas.",refusal.group(0)
    requesting = re.search(r"\b(?:send|share|provide|could|can|quanto|qual|poderia|envie|enviar|preciso|gostaria|solicito|pedido|request|schedule|book|agendar|marcar)\b|\?",content)
    if requesting and re.search(r"\b(?:orcamento|pricing|prices?|quote|precos?|valores?|how much|cost estimate)\b",content):
        return "pricing_request",.82,"Há linguagem de solicitação e referência a valores; confirmar na mensagem.",recent[:180] or subject[:180]
    if requesting and re.search(r"\b(?:demo|demonstracao|meeting|reuniao|call)\b",content):
        return "demo_request",.82,"Possível pedido de demonstração ou reunião; confirmar disponibilidade.",recent[:180] or subject[:180]
    if requesting and re.search(r"\b(?:browser|navegador|mobile|celular|integration|integracao|planta|tour|3d)\b",content):
        return "technical_question",.72,"Possível pergunta sobre recursos da apresentação.",recent[:180] or subject[:180]
    if re.search(r"\b(?:sounds good|interested|gostei|temos interesse|tenho interesse|vamos conversar)\b",content):
        return "positive_interest",.72,"Sinal de interesse que precisa de revisão humana.",recent[:180] or subject[:180]
    return "other",.3,"As regras não identificaram uma intenção segura.",recent[:180]


def suppress(c, address, reason, message_id, account_id):
    normalized = normalize_address(address)
    if not normalized:
        return False
    own = c.execute(text("SELECT address FROM accounts")).scalars()
    if normalized in {normalize_address(a) for a in own}:
        return False
    now = datetime.now(timezone.utc).isoformat()
    inserted = c.execute(text("""INSERT INTO suppression_list VALUES(:a,:r,:m,:d)
        ON CONFLICT(address) DO NOTHING"""),dict(a=normalized,r=reason,m=message_id,d=now)).rowcount
    block_recipient(c,normalized)
    if inserted:
        c.execute(text("INSERT INTO audit_events(action,account_id,occurred_at,count) VALUES('suppress_contact',:a,:d,1)"),dict(a=account_id,d=now))
    return bool(inserted)


def classify_message(c, message_id):
    m = c.execute(text("SELECT * FROM messages WHERE id=:id"),dict(id=message_id)).mappings().one()
    if m["direction"] != "inbound":
        return False
    own = c.execute(text("SELECT address FROM accounts WHERE id=:id"),dict(id=m["account_id"])).scalar_one()
    if normalize_address(m["sender"]) == normalize_address(own):
        return False
    category,confidence,reason,evidence = classify(m["subject"],m["body_text"],json.loads(m["headers"]))
    c.execute(text("""INSERT INTO message_classifications VALUES(:id,:cat,:conf,:reason,:evidence,:version,:d)
        ON CONFLICT(message_id) DO UPDATE SET category=excluded.category,confidence=excluded.confidence,
        reason=excluded.reason,evidence=excluded.evidence,rule_version=excluded.rule_version,classified_at=excluded.classified_at"""),
        dict(id=message_id,cat=category,conf=confidence,reason=reason,evidence=evidence,version=VERSION,d=datetime.now(timezone.utc).isoformat()))
    if category in ("unsubscribe","not_interested"):
        suppress(c,m["sender"],category,message_id,m["account_id"])
    elif category!="automatic_reply":
        pause_followups(c,m["thread_id"],m["received_at"])
    return True


def classification_view(c, thread_id):
    result = c.execute(text("""SELECT mc.* FROM effective_classifications mc JOIN messages m ON m.id=mc.message_id
        WHERE m.thread_id=:id ORDER BY CASE WHEN mc.category='unsubscribe' THEN 0
        WHEN mc.category='automatic_reply' THEN 2 ELSE 1 END, m.received_at DESC,m.id DESC LIMIT 1"""),dict(id=thread_id)).mappings().first()
    senders = c.execute(text("SELECT sender FROM messages WHERE thread_id=:id AND direction='inbound'"),dict(id=thread_id)).scalars()
    addresses = {normalize_address(s) for s in senders} - {None}
    query = text("SELECT address,reason FROM suppression_list WHERE address IN :addresses").bindparams(bindparam("addresses",expanding=True))
    blocked = [dict(row) for row in c.execute(query,dict(addresses=list(addresses))).mappings()] if addresses else []
    if not result:
        return dict(category="unclassified",label="Sem classificação",priority="P3",confidence=0,review_required=True,blocked=blocked,evidence="",message_id=None,source='rules',review_version=0,response_kind=None)
    value = dict(result)
    label,priority = LABELS[value["category"]]
    return dict(value,label=label,priority=priority,review_required=value['source']!='operator',blocked=blocked)


def run_rules(engine, account_id, thread_id=None):
    with engine.begin() as c:
        ids = c.execute(text("SELECT id FROM messages WHERE account_id=:a"+(" AND thread_id=:t" if thread_id else "")),dict(a=account_id,t=thread_id)).scalars().all()
        count = sum(classify_message(c,mid) for mid in ids)
    return {"classified":count,"rule_version":VERSION,"auto_send_allowed":False}

"""Revisão e simulação local; este módulo não possui cliente de e-mail ou acesso a credenciais."""
import hashlib
import json
import re
import secrets
from datetime import datetime, timezone
from uuid import uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException
from sqlalchemy import text

from .classification import normalize_address
from .outbound_guards import invalidate

ZONES = {
    "America/New_York":"Leste dos EUA", "America/Chicago":"Centro dos EUA",
    "America/Denver":"Montanhas dos EUA", "America/Los_Angeles":"Pacífico dos EUA",
    "America/Phoenix":"Arizona", "America/Anchorage":"Alasca", "Pacific/Honolulu":"Havaí",
    "America/Sao_Paulo":"Brasília / São Paulo",
}
CONTENT_FIELDS = ("account_id","profile_id","recipient","subject","body_text","purpose","thread_id","context_hash","metadata")


def context_hash(c, thread_id, purpose="reply"):
    condition = " AND id NOT IN (SELECT message_id FROM effective_classifications WHERE category='automatic_reply')" if purpose=="followup" else ""
    ids = c.execute(text("SELECT id FROM messages WHERE thread_id=:id"+condition+" ORDER BY id"),dict(id=thread_id)).scalars().all() if thread_id else []
    return hashlib.sha256(json.dumps(ids).encode()).hexdigest()


def load(c, draft_id):
    row = c.execute(text("SELECT * FROM outbound_drafts WHERE id=:id"),dict(id=draft_id)).mappings().first()
    if not row:
        raise HTTPException(404,"Rascunho não encontrado.")
    return dict(row)


def snapshot(draft):
    return {key:draft[key] for key in CONTENT_FIELDS}


def content_hash(draft):
    return hashlib.sha256(json.dumps(snapshot(draft),sort_keys=True,ensure_ascii=False).encode()).hexdigest()


def event(c, draft, action, now):
    c.execute(text("INSERT INTO outbound_history(draft_id,version,action,actor,occurred_at) VALUES(:id,:v,:a,'operator',:d)"),
              dict(id=draft["id"],v=draft["version"],a=action,d=now.isoformat()))


def review_errors(c, draft):
    errors = []
    if not normalize_address(draft["recipient"]):
        errors.append("Informe um destinatário válido.")
    elif c.execute(text("SELECT address FROM suppression_list WHERE address=:a"),dict(a=draft["recipient"])).first():
        errors.append("O destinatário está na lista de bloqueio.")
    if not draft["subject"].strip() or not draft["body_text"].strip():
        errors.append("Preencha assunto e mensagem.")
    if re.search(r"\{\{.*?\}\}",draft["subject"]+draft["body_text"]):
        errors.append("Preencha todos os campos do modelo antes de aprovar.")
    profile = c.execute(text("SELECT website FROM brand_profiles WHERE id=:id"),dict(id=draft["profile_id"])).scalar_one()
    if profile not in draft["body_text"] or "Conecta Imóveis 3D" not in draft["body_text"]:
        errors.append("Inclua a assinatura Conecta Imóveis 3D e o site do perfil escolhido.")
    wrong = r"https?://(?:www\.)?conectaimoveis3d\.com\.br\b" if draft["profile_id"]=="US" else r"https?://(?:www\.)?conectaimoveis3d\.com(?=[/\s]|$)"
    if re.search(wrong,draft["body_text"],re.I):
        errors.append("A mensagem contém o site de outro mercado.")
    metadata = json.loads(draft["metadata"])
    if draft["purpose"] in ("outreach","followup"):
        postal = metadata.get("postal_address","").strip()
        if len(postal)<8 or postal not in draft["body_text"] or "{{" in postal:
            errors.append("Informe um endereço postal comercial e inclua-o na assinatura.")
        if not re.search(r"(?:retirada da lista|nao receber|não receber|removed from (?:our|the) list|unsubscribe|opt.out)",draft["body_text"],re.I):
            errors.append("Inclua instruções claras de descadastro.")
    if draft["purpose"] in ("reply","followup") and not draft["thread_id"]:
        errors.append("Vincule a resposta ou seguimento a uma conversa.")
    if draft["thread_id"] and context_hash(c,draft["thread_id"],draft["purpose"]) != draft["context_hash"]:
        errors.append("A conversa recebeu novas mensagens. Revise e salve o rascunho novamente.")
    if draft["purpose"]=="delivery" and not metadata.get("project_completed"):
        errors.append("Confirme que o projeto está concluído e o acesso foi conferido.")
    if draft["purpose"]=="after_sale" and not metadata.get("delivery_confirmed"):
        errors.append("Confirme que a entrega já ocorreu antes de preparar o pós-venda.")
    return errors


def view(c, draft):
    value = dict(draft)
    value["content_hash"] = content_hash(draft)
    value["metadata"] = json.loads(draft["metadata"])
    value["review_errors"] = review_errors(c,draft)
    value["send_enabled"] = False
    value["send_blockers"] = ["Este editor aprova somente o texto. Prepare e aprove uma prévia na aba Envios reais.","Envio exige permissão válida do destinatário e conferência atual do remetente."]
    value["history"] = [dict(r) for r in c.execute(text("SELECT version,action,actor,occurred_at FROM outbound_history WHERE draft_id=:id ORDER BY id DESC"),dict(id=draft["id"])).mappings()]
    return value


def save(c, data, now, draft_id=None, version=None):
    old = load(c,draft_id) if draft_id else None
    if old and old["version"] != version:
        raise HTTPException(409,"Este rascunho foi alterado. Reabra a versão atual antes de salvar.")
    if old and c.execute(text("SELECT id FROM real_deliveries WHERE draft_id=:id AND status IN ('sending','unknown')"),dict(id=draft_id)).first():
        raise HTTPException(409,"Há tentativa em andamento ou incerta desta mensagem. Confira a fila real antes de editar.")
    raw_recipient = data["recipient"].strip()
    recipient = normalize_address(raw_recipient) if raw_recipient else ""
    if raw_recipient and (not recipient or not re.fullmatch(r"[^@\s<>,;]{1,64}@[^@\s<>,;]{1,253}",raw_recipient)):
        raise HTTPException(422,"Use apenas um endereço de e-mail no destinatário.")
    if any(ord(char)<32 for char in data["subject"]):
        raise HTTPException(422,"O assunto não pode conter quebras de linha ou caracteres de controle.")
    account = c.execute(text("SELECT id FROM accounts WHERE id=:id"),dict(id=data["account_id"])).first()
    if not account or data["account_id"]=="noreply":
        raise HTTPException(422,"Escolha uma caixa de atendimento ou demonstração.")
    if data["thread_id"]:
        thread = c.execute(text("SELECT account_id FROM threads WHERE id=:id"),dict(id=data["thread_id"])).mappings().first()
        if not thread or thread["account_id"]!=data["account_id"]:
            raise HTTPException(422,"A conversa deve pertencer à caixa escolhida.")
        profile = c.execute(text("SELECT profile_id FROM thread_brand_profiles WHERE thread_id=:id"),dict(id=data["thread_id"])).scalar()
        if profile and profile!=data["profile_id"]:
            raise HTTPException(409,"Esta conversa já usa outro perfil comercial. Preserve o perfil original.")
        c.execute(text("INSERT INTO thread_brand_profiles VALUES(:t,:p) ON CONFLICT(thread_id) DO NOTHING"),dict(t=data["thread_id"],p=data["profile_id"]))
    value = dict(data,recipient=recipient,context_hash=context_hash(c,data["thread_id"],data["purpose"]),metadata=json.dumps(data["metadata"],sort_keys=True,ensure_ascii=False),
                 id=draft_id or uuid4().hex,version=old["version"]+1 if old else 1,status="draft",created_at=old["created_at"] if old else now.isoformat(),updated_at=now.isoformat())
    if old:
        invalidate(c,[old],"content_changed",status="pending_review",actor="operator")
        c.execute(text("""UPDATE outbound_drafts SET account_id=:account_id,profile_id=:profile_id,recipient=:recipient,
            subject=:subject,body_text=:body_text,purpose=:purpose,thread_id=:thread_id,context_hash=:context_hash,metadata=:metadata,
            version=:version,status='draft',approved_version=NULL,approved_hash=NULL,approved_at=NULL,updated_at=:updated_at WHERE id=:id"""),value)
    else:
        c.execute(text("""INSERT INTO outbound_drafts(id,account_id,profile_id,recipient,subject,body_text,purpose,thread_id,context_hash,metadata,
            version,status,created_at,updated_at) VALUES(:id,:account_id,:profile_id,:recipient,:subject,:body_text,:purpose,:thread_id,:context_hash,:metadata,
            :version,:status,:created_at,:updated_at)"""),value)
    event(c,value,"draft_saved",now)
    return view(c,load(c,value["id"]))


def require_snapshot(c, draft, version, expected_hash):
    if draft["version"]!=version or not secrets.compare_digest(content_hash(draft),expected_hash):
        raise HTTPException(409,"A versão ou o texto mudou. Revise o rascunho atual.")
    errors = review_errors(c,draft)
    if errors:
        raise HTTPException(409," ".join(errors))


def approve(c, draft_id, version, expected_hash, now):
    draft = load(c,draft_id)
    require_snapshot(c,draft,version,expected_hash)
    if draft["status"] not in ("draft","pending_review","approved"):
        raise HTTPException(409,"O rascunho precisa voltar para edição antes de nova aprovação.")
    c.execute(text("UPDATE outbound_drafts SET status='approved',approved_version=:v,approved_hash=:h,approved_at=:d WHERE id=:id"),
              dict(v=version,h=expected_hash,d=now.isoformat(),id=draft_id))
    event(c,draft,"content_approved",now)
    return view(c,load(c,draft_id))


def scheduled_time(local_time, zone_name, now):
    if zone_name not in ZONES:
        raise HTTPException(422,"Escolha um dos fusos de destinatário disponíveis.")
    try:
        local = datetime.fromisoformat(local_time)
        zone = ZoneInfo(zone_name)
    except (ValueError,ZoneInfoNotFoundError):
        raise HTTPException(422,"Data, hora ou fuso inválido.") from None
    if local.tzinfo is not None:
        raise HTTPException(422,"Informe a hora local do destinatário, usando o campo de fuso separado.")
    candidates = [local.replace(tzinfo=zone,fold=fold) for fold in (0,1)]
    if candidates[0].utcoffset()!=candidates[1].utcoffset() or candidates[0].astimezone(timezone.utc).astimezone(zone).replace(tzinfo=None)!=local:
        raise HTTPException(422,"Horário ambíguo ou inexistente na mudança de fuso. Escolha outro horário.")
    when = candidates[0].astimezone(timezone.utc)
    if when <= now:
        raise HTTPException(422,"Escolha um horário futuro para a simulação.")
    if local.weekday()>4 or not 9<=local.hour<17:
        raise HTTPException(422,"Use dias úteis entre 9h e 17h no fuso do destinatário.")
    return when,zone


def schedule(c, draft_id, version, expected_hash, local_time, zone_name, now):
    draft = load(c,draft_id)
    require_snapshot(c,draft,version,expected_hash)
    if draft["status"]!="approved" or draft["approved_version"]!=version or draft["approved_hash"]!=expected_hash:
        raise HTTPException(409,"Aprove esta versão antes de agendar.")
    when,zone = scheduled_time(local_time,zone_name,now)
    existing = c.execute(text("SELECT * FROM outbound_queue WHERE status IN ('scheduled','simulated')")).mappings().all()
    if any(q["draft_id"]==draft_id and q["version"]==version for q in existing):
        raise HTTPException(409,"Esta versão já está na fila.")
    if draft["purpose"]=="outreach":
        prospecting = [q for q in existing if q["purpose"]=="outreach"]
        if any(q["recipient"]==draft["recipient"] for q in prospecting):
            raise HTTPException(409,"Este destinatário já tem um primeiro contato nesta fila de simulação.")
        day = when.astimezone(zone).date()
        dates = [datetime.fromisoformat(q["scheduled_at"]) for q in prospecting]
        if sum(d.astimezone(zone).date()==day for d in dates)>=16:
            raise HTTPException(409,"O limite de 16 novos contatos nesse dia já foi atingido.")
        if any(abs((d-when).total_seconds())<1800 for d in dates):
            raise HTTPException(409,"Reserve pelo menos 30 minutos entre primeiros contatos.")
    queue_id = uuid4().hex
    c.execute(text("""INSERT INTO outbound_queue(id,draft_id,version,snapshot_hash,snapshot,recipient,purpose,scheduled_at,
        recipient_timezone,status,created_at) VALUES(:id,:draft,:v,:h,:snapshot,:r,:p,:d,:z,'scheduled',:created)"""),
        dict(id=queue_id,draft=draft_id,v=version,h=expected_hash,snapshot=json.dumps(snapshot(draft),ensure_ascii=False),
             r=draft["recipient"],p=draft["purpose"],d=when.isoformat(),z=zone_name,created=now.isoformat()))
    c.execute(text("UPDATE outbound_drafts SET status='scheduled' WHERE id=:id"),dict(id=draft_id))
    event(c,draft,"simulation_scheduled",now)
    return {"id":queue_id,"scheduled_at":when.isoformat(),"mode":"simulation","send_enabled":False}


def simulate(c, now):
    if c.execute(text("SELECT paused FROM outbound_control WHERE id=1")).scalar_one():
        raise HTTPException(409,"A simulação está pausada.")
    items = c.execute(text("SELECT * FROM outbound_queue WHERE status='scheduled' AND scheduled_at<=:now ORDER BY scheduled_at"),dict(now=now.isoformat())).mappings().all()
    counts = {"simulated":0,"blocked":0,"deferred":0}
    previous = c.execute(text("SELECT MAX(processed_at) FROM outbound_queue WHERE status='simulated' AND purpose='outreach'")).scalar()
    last_prospect = datetime.fromisoformat(previous) if previous else None
    for q in items:
        draft = load(c,q["draft_id"])
        try:
            same_snapshot = json.loads(q["snapshot"])==snapshot(draft)
        except (ValueError,TypeError):
            same_snapshot = False
        valid = (draft["status"]=="scheduled" and draft["version"]==q["version"] and draft["approved_version"]==q["version"]
                 and draft["approved_hash"]==q["snapshot_hash"] and content_hash(draft)==q["snapshot_hash"] and same_snapshot
                 and q["recipient"]==draft["recipient"] and q["purpose"]==draft["purpose"] and not review_errors(c,draft))
        if not valid:
            invalidate(c,[draft],"preflight_failed")
            counts["blocked"] += 1
            continue
        local_now = now.astimezone(ZoneInfo(q["recipient_timezone"]))
        outside_window = local_now.weekday()>4 or not 9<=local_now.hour<17
        interval_pending = q["purpose"]=="outreach" and last_prospect is not None and (now-last_prospect).total_seconds()<1800
        if outside_window or interval_pending:
            counts["deferred"] += 1
            c.execute(text("UPDATE outbound_queue SET reason=:r WHERE id=:id"),dict(r="awaiting_business_hours" if outside_window else "awaiting_interval",id=q["id"]))
            continue
        c.execute(text("UPDATE outbound_queue SET status='simulated',reason='dry_run_only',processed_at=:now WHERE id=:id"),dict(id=q["id"],now=now.isoformat()))
        c.execute(text("UPDATE outbound_drafts SET status='simulated' WHERE id=:id"),dict(id=draft["id"]))
        event(c,draft,"simulation_completed",now)
        counts["simulated"] += 1
        if q["purpose"]=="outreach":
            last_prospect = now
    return dict(counts,mode="simulation",sent=0,send_enabled=False)

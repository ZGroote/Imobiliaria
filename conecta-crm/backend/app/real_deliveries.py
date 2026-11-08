import json
import secrets
from datetime import date,datetime,timedelta,timezone

from fastapi import HTTPException
from sqlalchemy import text

from . import outbound
from .classification import normalize_address,suppress
from .classification_review_api import fingerprint
from .mail import rows,save_message
from .provider import Mail
from .recipient_authorizations import load as authorization
from .research_api import digest,encoded
from .sender_diagnostics import connected_account
from .real_transport import verified_status

STATUSES={'prepared':'Prévia aguardando autorização de envio','approved':'Aprovada para envio real',
          'sending':'Tentativa em andamento','sent':'Aceita pelo provedor','delivered':'Entregue segundo o provedor',
          'delayed':'Entrega adiada pelo provedor','bounced':'Devolvida pelo provedor','complained':'Reclamação registrada',
          'suppressed':'Suprimida pelo provedor','rejected':'Recusada','unknown':'Resultado incerto · conferir',
          'blocked':'Bloqueada antes do envio','cancelled':'Cancelada','not_sent_declared':'Ausência de envio declarada pelo operador'}
ERRORS={'draft_changed':'Rascunho, aprovação ou conversa mudaram. Revise uma nova versão.',
        'authorization_changed':'A autorização do destinatário mudou ou foi revogada.',
        'authorization_expired':'A autorização do destinatário venceu.',
        'provider_not_ready':'O diagnóstico atual não liberou o remetente.',
        'delivery_unknown':'O resultado da tentativa é incerto. Não haverá reenvio automático.',
        'interrupted_attempt':'O CRM foi encerrado durante a tentativa; confira o provedor.',
        'backup_failed':'Não foi possível criar o backup anterior à tentativa.',
        'expired_schedule':'O agendamento venceu há mais de 24 horas. Prepare outra versão.',
        'provider_refused':'O provedor recusou a tentativa.',
        'recipient_blocked':'Destinatário bloqueado.',
        'diagnostic_failed':'Não foi possível conferir o remetente. Nenhum envio foi iniciado.'}
ERRORS['local_history_pending']='Mensagem aceita pelo provedor; a cópia no histórico local precisa ser conferida. Consulte o estado para atualizar.'
ERRORS['status_unavailable']='A consulta mais recente falhou. O estado exibido é o último confirmado.'
ERRORS['prior_attempt_confirmed']='Outra tentativa deste conteúdo foi confirmada no provedor. Esta prévia foi bloqueada.'


def load(c,did):
    selected=rows(c,'SELECT * FROM real_deliveries WHERE id=:id',id=did)
    if not selected:raise HTTPException(404,'Tentativa não encontrada.')
    return selected[0]


def event(c,did,action,when,note=''):
    c.execute(text('INSERT INTO real_delivery_events(delivery_id,action,note,occurred_at) VALUES(:id,:a,:n,:d)'),
              dict(id=did,a=action,n=note,d=when.isoformat()))


def view(c,did):
    row=load(c,did)
    row['snapshot']=json.loads(row['snapshot'])
    return dict(row,status_label=STATUSES[row['status']],error=ERRORS.get(row['error_code'],''),
                events=rows(c,'SELECT action,note,occurred_at FROM real_delivery_events WHERE delivery_id=:id ORDER BY id DESC LIMIT 30',id=did))


def valid_authorization(c,aid,draft,when,expected_version=None):
    auth=authorization(c,aid)
    if auth['status']!='active' or expected_version is not None and auth['version']!=expected_version:
        raise HTTPException(409,ERRORS['authorization_changed'])
    if date.fromisoformat(auth['expires_on'])<when.date():raise HTTPException(409,ERRORS['authorization_expired'])
    if auth['address']!=draft['recipient'] or auth['profile_id']!=draft['profile_id']:
        raise HTTPException(409,'A autorização deve corresponder ao destinatário e ao perfil da mensagem.')
    if draft['purpose'] in ('outreach','followup') and auth['basis']!='explicit_opt_in':
        raise HTTPException(409,'Primeiro contato e seguimento exigem opt-in explícito. Pesquisa pública não autoriza envio.')
    return auth


def reply_reference(c,draft):
    if not draft['thread_id']:return ''
    messages=rows(c,"SELECT * FROM messages WHERE thread_id=:id AND direction='inbound' ORDER BY received_at DESC,id DESC LIMIT 1",id=draft['thread_id'])
    if draft['purpose']=='reply':
        if not messages or normalize_address(messages[0]['sender'])!=draft['recipient']:
            raise HTTPException(409,'A resposta deve usar o remetente da mensagem recebida mais recente desta conversa.')
        review=rows(c,'SELECT * FROM classification_reviews WHERE message_id=:id',id=messages[0]['id'])
        if not review or review[0]['response_kind']!='human' or review[0]['message_hash']!=fingerprint(messages[0]):
            raise HTTPException(409,'Revise a mensagem recebida e confirme que a resposta é humana antes do envio real.')
    reference=messages[0]['message_id'] if messages else ''
    import re
    if reference and not re.fullmatch(r'<[^<>\s]{1,990}>',reference):
        raise HTTPException(409,'A referência da mensagem recebida é incompatível. Confira a conversa antes de responder.')
    return reference


def approved_draft(c,draft_id,version,hashed):
    draft=outbound.load(c,draft_id)
    outbound.require_snapshot(c,draft,version,hashed)
    if draft['status']!='approved' or draft['approved_version']!=version or draft['approved_hash']!=hashed:
        raise HTTPException(409,'Aprove o texto desta versão antes de preparar ou liberar envio real.')
    return draft


def prepare(c,body,when):
    did=body.request_id.hex;request_hash=digest(body.model_dump(mode='json'))
    existing=rows(c,'SELECT * FROM real_deliveries WHERE id=:id',id=did)
    if existing:
        if existing[0]['request_hash']!=request_hash:raise HTTPException(409,'Esta solicitação já foi usada com outros dados.')
        return view(c,did)
    draft=approved_draft(c,body.draft_id,body.version,body.content_hash)
    account=connected_account(c,draft['account_id'])
    auth=valid_authorization(c,body.authorization_id,draft,when)
    previous=rows(c,'SELECT * FROM real_deliveries WHERE draft_id=:id AND draft_version=:v',id=draft['id'],v=draft['version'])
    if previous:raise HTTPException(409,'Esta versão já tem prévia ou tentativa preservada. Edite e revise outra versão antes de preparar novamente.')
    if rows(c,"SELECT id FROM real_deliveries WHERE content_hash=:h AND status NOT IN ('cancelled','blocked','rejected','not_sent_declared')",h=body.content_hash):
        raise HTTPException(409,'Já existe prévia ou tentativa deste conteúdo. Confira a fila antes de preparar novamente.')
    if body.campaign_id and not rows(c,'SELECT id FROM real_campaigns WHERE id=:id',id=body.campaign_id):
        raise HTTPException(404,'Campanha não encontrada.')
    if body.local_time:
        scheduled,zone=outbound.scheduled_time(body.local_time,body.recipient_timezone,when)
    else:
        if body.recipient_timezone not in outbound.ZONES:raise HTTPException(422,'Fuso inválido.')
        scheduled=when
    if scheduled>when+timedelta(days=7):raise HTTPException(422,'Agende até sete dias a partir de agora.')
    snapshot=dict(outbound.snapshot(draft),metadata=json.loads(draft['metadata']),from_address=account['address'],
                  in_reply_to=reply_reference(c,draft),authorization=dict(id=auth['id'],version=auth['version'],basis=auth['basis'],note=auth['note'],observed_on=auth['observed_on'],expires_on=auth['expires_on']))
    hashed=digest(dict(snapshot=snapshot,scheduled_at=scheduled.isoformat(),timezone=body.recipient_timezone,campaign_id=body.campaign_id))
    c.execute(text('''INSERT INTO real_deliveries(id,request_hash,draft_id,draft_version,content_hash,authorization_id,
        authorization_version,campaign_id,snapshot,approval_hash,scheduled_at,recipient_timezone,status,created_at)
        VALUES(:id,:rh,:draft,:v,:ch,:aid,:av,:campaign,:p,:h,:s,:z,'prepared',:d)'''),
        dict(id=did,rh=request_hash,draft=draft['id'],v=draft['version'],ch=body.content_hash,aid=auth['id'],av=auth['version'],
             campaign=body.campaign_id,p=encoded(snapshot),h=hashed,s=scheduled.isoformat(),z=body.recipient_timezone,d=when.isoformat()))
    event(c,did,'preview_prepared',when)
    return view(c,did)


def guard(c,row,when):
    draft=approved_draft(c,row['draft_id'],row['draft_version'],row['content_hash'])
    auth=valid_authorization(c,row['authorization_id'],draft,when,row['authorization_version'])
    account=connected_account(c,draft['account_id'])
    snapshot=json.loads(row['snapshot'])
    if account['address']!=snapshot['from_address'] or reply_reference(c,draft)!=snapshot['in_reply_to']:
        raise HTTPException(409,ERRORS['draft_changed'])
    if rows(c,"SELECT id FROM real_deliveries WHERE status IN ('sending','unknown') AND id<>:id AND json_extract(snapshot,'$.account_id')=:a AND json_extract(snapshot,'$.recipient')=:r",id=row['id'],a=draft['account_id'],r=draft['recipient']):
        raise HTTPException(409,'Há outra tentativa em andamento ou incerta para este destinatário. Confira antes de prosseguir.')
    return draft


def approve(c,did,hashed,when):
    row=load(c,did)
    if not secrets.compare_digest(row['approval_hash'],hashed):raise HTTPException(409,'A prévia mudou. Confira o conteúdo e a agenda novamente.')
    if row['status']=='approved':return view(c,did)
    if row['status']!='prepared':raise HTTPException(409,'Esta tentativa não está aguardando autorização de envio.')
    guard(c,row,when)
    c.execute(text("UPDATE real_deliveries SET status='approved',approved_at=:d WHERE id=:id"),dict(id=did,d=when.isoformat()))
    event(c,did,'real_send_authorized_for_snapshot',when)
    return view(c,did)


def sent_copy(c,row,when,message_id=None):
    payload=json.loads(row['snapshot'])
    when=datetime.fromisoformat(row['attempted_at']) if row['attempted_at'] else when
    mid,added=save_message(c,payload['account_id'],Mail(key='resend:'+row['remote_id'],uid=0,
        message_id=message_id or '',sender=payload['from_address'],recipient=payload['recipient'],subject=payload['subject'],
        body=payload['body_text'],received_at=when.isoformat(),in_reply_to=payload.get('in_reply_to',''),is_read=True,direction='outbound'))
    if message_id:c.execute(text("UPDATE messages SET message_id=:m WHERE id=:id AND message_id=''"),dict(id=mid,m=message_id))
    if added and payload['thread_id']:
        previous=c.execute(text('SELECT thread_id FROM messages WHERE id=:id'),dict(id=mid)).scalar_one()
        if previous!=payload['thread_id']:
            c.execute(text('UPDATE messages SET thread_id=:t WHERE id=:id'),dict(id=mid,t=payload['thread_id']))
            c.execute(text('DELETE FROM threads WHERE id=:id AND NOT EXISTS(SELECT 1 FROM messages WHERE thread_id=:id)'),dict(id=previous))
            c.execute(text('UPDATE threads SET last_at=(SELECT MAX(received_at) FROM messages WHERE thread_id=:id) WHERE id=:id'),dict(id=payload['thread_id']))


def reconcile(c,row,remote,when):
    payload=json.loads(row['snapshot']);value=verified_status(remote,payload,row['id'])
    if row['remote_id'] and row['remote_id']!=remote['id']:raise HTTPException(409,'O identificador remoto desta tentativa já está fixado.')
    used=rows(c,'SELECT id FROM real_deliveries WHERE remote_id=:r AND id<>:id',r=remote['id'],id=row['id'])
    if used:raise HTTPException(409,'A mensagem remota já pertence a outra tentativa.')
    if row['status'] in ('bounced','complained','suppressed') and value['status'] not in ('bounced','complained','suppressed'):
        value['status']=row['status']
    if row['status']=='delivered' and value['status']=='sent':value['status']='delivered'
    if value['status']!='rejected':
        for pending in rows(c,"SELECT id FROM real_deliveries WHERE content_hash=:h AND id<>:id AND status IN ('prepared','approved')",h=row['content_hash'],id=row['id']):
            c.execute(text("UPDATE real_deliveries SET status='blocked',error_code='prior_attempt_confirmed' WHERE id=:id"),dict(id=pending['id']))
            event(c,pending['id'],'prior_attempt_confirmed',when)
    c.execute(text('''UPDATE real_deliveries SET status=:status,remote_id=:remote,remote_message_id=:remote_message_id,
        remote_event=:remote_event,checked_at=:d,error_code=NULL WHERE id=:id'''),dict(value,id=row['id'],remote=remote['id'],d=when.isoformat()))
    draft_status='blocked' if value['status'] in ('bounced','complained','suppressed') else 'pending_review' if value['status']=='rejected' else 'sent'
    c.execute(text("UPDATE outbound_drafts SET status=:s,approved_version=NULL,approved_hash=NULL,approved_at=NULL WHERE id=:id AND version=:v AND status IN ('sending','delivery_unknown','sent')"),dict(s=draft_status,id=row['draft_id'],v=row['draft_version']))
    if value['status'] in ('bounced','complained','suppressed'):
        suppress(c,payload['recipient'],'provider_'+value['status'],None,payload['account_id'])
    if value['status']!='rejected':sent_copy(c,load(c,row['id']),when,value['remote_message_id'])
    if row['status']!=value['status'] or row['remote_event']!=value['remote_event']:event(c,row['id'],'provider_'+value['remote_event'],when)
    return view(c,row['id'])

import hashlib
import json
import re
import secrets
from contextlib import contextmanager
from datetime import datetime
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text

from .classification import normalize_address
from .sender_diagnostics import check, connected_account, store_report
from .resend_client import ResendError
from .test_transport import DeliveryUnknown, TestRejected

router = APIRouter()


class AccountRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    account_id: Literal['contact','team']


class Prepare(AccountRequest):
    recipient: str = Field(max_length=254)
    profile_id: Literal['BR','US'] = 'BR'
    owner_confirmed: Literal[True]


class Confirm(BaseModel):
    model_config = ConfigDict(extra='forbid')
    confirm: Literal[True]
    content_hash: str = Field(pattern=r'^[a-f0-9]{64}$')


def now(request):
    return request.app.state.clock()


@contextmanager
def locked(request, account_id):
    lock = request.app.state.mail_locks[account_id]
    if not lock.acquire(blocking=False):
        raise HTTPException(409,'Esta caixa está em uma operação. Aguarde.')
    try:yield
    finally:lock.release()


def test_row(c, test_id):
    row = c.execute(text('SELECT * FROM sender_tests WHERE id=:id'),dict(id=test_id)).mappings().first()
    if not row:raise HTTPException(404,'Teste não encontrado.')
    return dict(row)


def test_view(row):
    result = dict(row)
    result['payload'] = json.loads(result['payload'])
    result['campaign_send_enabled'] = False
    return result


def audit(c, account_id, action, when):
    c.execute(text('INSERT INTO audit_events(action,account_id,occurred_at,count) VALUES(:action,:account,:d,1)'),dict(action=action,account=account_id,d=when.isoformat()))


def current_check(request, account_id):
    with request.app.state.engine.connect() as c:
        account = connected_account(c,account_id)
    key = request.app.state.credential_store.get(account_id)
    if not key:raise HTTPException(409,'A credencial não está disponível. Reconecte a caixa.')
    client = None
    try:
        client = request.app.state.mail_client_factory(key)
        report = check(account,client,request.app.state.dmarc_resolver,now(request))
    except ResendError as error:
        report = dict(account_id=account_id,from_address=account['address'],domain=account['address'].rsplit('@',1)[1],
                      domain_status='unknown',spf='unknown',dkim='unknown',dmarc_status='unknown',dmarc_policy=None,
                      ready_for_test=False,campaign_send_enabled=False,checked_at=now(request).isoformat(),issues=[str(error)],warnings=[])
    finally:
        if client:client.close()
    with request.app.state.engine.begin() as c:
        store_report(c,account_id,report,now(request))
        audit(c,account_id,'sender_diagnosed',now(request))
    return report,key


@router.get('/api/mail/sender-diagnostics')
def diagnostic_list(request: Request):
    with request.app.state.engine.connect() as c:
        reports = [json.loads(r) for r in c.execute(text('SELECT report FROM sender_diagnostics ORDER BY account_id')).scalars()]
    return dict(items=reports,campaign_send_enabled=False)


@router.post('/api/mail/sender-diagnostics/check')
def diagnose(body: AccountRequest, request: Request):
    with locked(request,body.account_id):
        report,_ = current_check(request,body.account_id)
        return report


@router.post('/api/mail/sender-tests')
def prepare(body: Prepare, request: Request):
    raw = body.recipient.strip()
    recipient = normalize_address(raw)
    if not recipient or not re.fullmatch(r'[^@\s<>,;]{1,64}@[^@\s<>,;]{1,253}',raw):
        raise HTTPException(422,'Informe um único endereço seu para receber o teste.')
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql('BEGIN IMMEDIATE')
        account = connected_account(c,body.account_id)
        if c.execute(text('SELECT address FROM suppression_list WHERE address=:a'),dict(a=recipient)).first():
            raise HTTPException(409,'Esse destinatário está bloqueado no CRM.')
        previous = c.execute(text('SELECT * FROM sender_tests WHERE account_id=:a ORDER BY created_at DESC'),dict(a=body.account_id)).mappings()
        for item in previous:
            payload = json.loads(item['payload'])
            if payload['recipient']==recipient:
                if item['status'] in ('sending','delivery_unknown'):
                    raise HTTPException(409,'Há uma tentativa com resultado incerto. Confira a caixa antes de preparar outro teste.')
                if item['status']=='pending' and payload['profile_id']==body.profile_id:
                    return test_view(item)
        test_id = uuid4().hex
        profile = c.execute(text('SELECT website FROM brand_profiles WHERE id=:id'),dict(id=body.profile_id)).scalar_one()
        reference = 'CRM-TEST-'+test_id[:12].upper()
        text_pt = f'Olá!\n\nEsta é uma mensagem de teste do CRM da Conecta Imóveis 3D.\n\nSe ela chegou corretamente, você pode responder para confirmar o funcionamento da caixa de atendimento.\n\nReferência: {reference}\n\nConecta Imóveis 3D\n{profile}'
        text_en = f'Hello!\n\nThis is a test message from the Conecta Imóveis 3D CRM.\n\nIf you received it, you may reply to confirm that our support inbox is working.\n\nReference: {reference}\n\nConecta Imóveis 3D\n{profile}'
        payload = dict(account_id=body.account_id,profile_id=body.profile_id,from_address=account['address'],reply_to=account['address'],recipient=recipient,
                       subject=('[Teste do CRM] ' if body.profile_id=='BR' else '[CRM test] ')+'Conecta Imóveis 3D · '+reference,
                       body_text=text_pt if body.profile_id=='BR' else text_en)
        encoded = json.dumps(payload,ensure_ascii=False,sort_keys=True)
        digest = hashlib.sha256(encoded.encode()).hexdigest()
        c.execute(text("INSERT INTO sender_tests(id,account_id,payload,content_hash,status,created_at) VALUES(:id,:a,:p,:h,'pending',:d)"),dict(id=test_id,a=body.account_id,p=encoded,h=digest,d=now(request).isoformat()))
        audit(c,body.account_id,'sender_test_prepared',now(request))
        return test_view(test_row(c,test_id))


@router.get('/api/mail/sender-tests')
def tests(request: Request):
    with request.app.state.engine.begin() as c:
        rows = c.execute(text('SELECT * FROM sender_tests ORDER BY created_at DESC LIMIT 30')).mappings().all()
        for row in rows:
            if row['status']=='sending' and row['attempted_at'] and (now(request)-datetime.fromisoformat(row['attempted_at'])).total_seconds()>120:
                c.execute(text("UPDATE sender_tests SET status='delivery_unknown',error_code='interrupted_attempt' WHERE id=:id AND status='sending'"),dict(id=row['id']))
        return [test_view(test_row(c,row['id'])) for row in rows]


@router.post('/api/mail/sender-tests/{test_id}/send')
def send(test_id: str, body: Confirm, request: Request):
    engine = request.app.state.engine
    with engine.connect() as c:initial = test_row(c,test_id)
    with locked(request,initial['account_id']):
        if initial['content_hash']!=body.content_hash:
            raise HTTPException(409,'A prévia do teste não corresponde à aprovação.')
        if initial['status']!='pending':return test_view(initial)
        report,key = current_check(request,initial['account_id'])
        if not report['ready_for_test']:raise HTTPException(409,'O diagnóstico do remetente ainda tem pendências. Confira SPF, DKIM e DMARC.')
        transport = request.app.state.sender_transport_factory(key)
        try:
            with engine.begin() as c:
                c.exec_driver_sql('BEGIN IMMEDIATE')
                row = test_row(c,test_id)
                payload = json.loads(row['payload'])
                digest = hashlib.sha256(json.dumps(payload,ensure_ascii=False,sort_keys=True).encode()).hexdigest()
                account = connected_account(c,row['account_id'])
                if row['status']!='pending':return test_view(row)
                if not secrets.compare_digest(digest,body.content_hash) or payload['from_address']!=account['address'] or payload['reply_to']!=account['address']:
                    raise HTTPException(409,'A identidade ou o conteúdo do teste mudou. Prepare uma nova prévia.')
                if c.execute(text('SELECT address FROM suppression_list WHERE address=:a'),dict(a=payload['recipient'])).first():
                    raise HTTPException(409,'O destinatário foi bloqueado após a preparação do teste.')
                attempts = c.execute(text('SELECT attempted_at FROM sender_tests WHERE attempted_at IS NOT NULL')).scalars()
                if sum(datetime.fromisoformat(d).date()==now(request).date() for d in attempts)>=3:
                    raise HTTPException(409,'O limite de três tentativas de teste por dia foi atingido.')
                c.execute(text("UPDATE sender_tests SET status='sending',attempted_at=:d WHERE id=:id AND status='pending'"),dict(id=test_id,d=now(request).isoformat()))
                audit(c,row['account_id'],'sender_test_approved',now(request))
            try:
                provider_id = transport.send(payload,test_id)
                status,code = 'accepted',''
            except TestRejected as error:
                provider_id,status,code = None,'failed',str(error)
            except DeliveryUnknown:
                provider_id,status,code = None,'delivery_unknown','ambiguous_provider_result'
            with engine.begin() as c:
                c.execute(text('UPDATE sender_tests SET status=:s,provider_id=:p,error_code=:e WHERE id=:id'),dict(s=status,p=provider_id,e=code,id=test_id))
                audit(c,row['account_id'],'sender_test_'+status,now(request))
                return test_view(test_row(c,test_id))
        finally:
            transport.close()


@router.post('/api/mail/sender-tests/{test_id}/refresh')
def refresh(test_id: str, request: Request):
    with request.app.state.engine.connect() as c:
        row = test_row(c,test_id)
    if not row['provider_id']:return test_view(row)
    key = request.app.state.credential_store.get(row['account_id'])
    if not key:raise HTTPException(409,'Reconecte a caixa para consultar o resultado.')
    client = request.app.state.mail_client_factory(key)
    try:result = client.sent_email(row['provider_id'])
    finally:client.close()
    payload = json.loads(row['payload'])
    recipients = result.get('to',[])
    if not isinstance(recipients,list) or normalize_address(result.get('from',''))!=payload['from_address'] or payload['recipient'] not in [normalize_address(r) for r in recipients]:
        raise HTTPException(409,'O resultado remoto não corresponde ao teste preparado.')
    event = result.get('last_event','unknown')
    event = event if event in ('sent','delivered','delivery_delayed','bounced','complained','failed') else 'unknown'
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql('BEGIN IMMEDIATE')
        current = test_row(c,test_id)
        status = current['status']
        if event in ('bounced','complained','failed'):status='failed'
        elif event=='delivered' and status!='received':status='delivered'
        c.execute(text('UPDATE sender_tests SET provider_event=:e,status=:s WHERE id=:id'),dict(e=event,s=status,id=test_id))
        return test_view(test_row(c,test_id))


@router.post('/api/mail/sender-tests/{test_id}/received')
def received(test_id: str, body: Confirm, request: Request):
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql('BEGIN IMMEDIATE')
        row = test_row(c,test_id)
        if row['content_hash']!=body.content_hash or row['status'] not in ('accepted','delivered','delivery_unknown','received'):
            raise HTTPException(409,'Só confirme o recebimento de um teste que já teve uma tentativa de envio.')
        if row['status']!='received':
            c.execute(text("UPDATE sender_tests SET status='received',received_at=:d WHERE id=:id"),dict(d=now(request).isoformat(),id=test_id))
            audit(c,row['account_id'],'sender_test_receipt_declared',now(request))
        return test_view(test_row(c,test_id))

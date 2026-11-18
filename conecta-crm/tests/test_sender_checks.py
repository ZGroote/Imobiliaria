import copy
import json
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.app.main import create_app
from backend.app.resend_client import ResendClient, ResendError
from backend.app.sender_diagnostics import dmarc
from backend.app.test_transport import SenderTestTransport

KEY = 're_fictitious_test_only'
INBOX = '00000000-0000-4000-8000-000000000001'
DOMAIN = '00000000-0000-4000-8000-000000000002'
EMAIL = '00000000-0000-4000-8000-000000000003'
ADDRESS = 'contact@conectaimoveis3d.com'
RECIPIENT = 'owner@example.invalid'
NOW = datetime(2026,11,8,14,tzinfo=timezone.utc)


class Credentials:
    def get(self, account):
        return KEY


@pytest.fixture
def setup(tmp_path):
    state = dict(now=NOW,post_status=200,dns=dict(status='found',policy='none'),
        domain=dict(id=DOMAIN,name='conectaimoveis3d.com',status='verified',capabilities=dict(sending='enabled'),
                    records=[dict(record='SPF',status='verified'),dict(record='DKIM',status='verified')]),
        remote=dict(id=EMAIL,**{'from':ADDRESS,'to':[RECIPIENT]},last_event='delivered'))
    calls = []

    def read(request):
        calls.append(request)
        assert request.method=='GET' and request.url.host=='api.resend.com'
        assert request.headers['authorization']=='Bearer '+KEY
        if request.url.path=='/inboxes':
            return httpx.Response(200,json=dict(data=[dict(id=state.get('inbox',INBOX),email_address=ADDRESS)],has_more=False))
        if request.url.path=='/domains':
            return httpx.Response(200,json=dict(data=[dict(id=DOMAIN,name='conectaimoveis3d.com')],has_more=False))
        if request.url.path=='/domains/'+DOMAIN:
            return httpx.Response(200,json=state['domain'])
        if request.url.path=='/emails/'+EMAIL:
            if state.get('received_during_refresh'):
                with app.state.engine.begin() as c:
                    c.execute(text("UPDATE sender_tests SET status='received',received_at=:d"),dict(d=NOW.isoformat()))
            return httpx.Response(200,json=state['remote'])
        raise AssertionError(request.url)

    def send(request):
        calls.append(request)
        assert request.url==httpx.URL('https://api.resend.com/emails') and request.method=='POST'
        assert request.headers['authorization']=='Bearer '+KEY
        # O registro da tentativa deve existir antes de qualquer atividade remota.
        with app.state.engine.connect() as c:
            status = c.execute(text('SELECT status FROM sender_tests WHERE id=:id'),
                dict(id=request.headers['idempotency-key'].split('/')[1])).scalar_one()
            assert status=='sending'
        if state.get('timeout'):
            raise httpx.ReadTimeout('secret remote body '+KEY,request=request)
        return httpx.Response(state['post_status'],json=state.get('post_body',dict(id=EMAIL)))

    app = create_app(tmp_path/'cache.sqlite3',credentials=Credentials(),
        client_factory=lambda key:ResendClient(key,transport=httpx.MockTransport(read),interval=0),
        sender_transport_factory=lambda key:SenderTestTransport(key,transport=httpx.MockTransport(send)),
        dns_resolver=lambda domain:state['dns'])
    app.state.clock = lambda:state['now']
    with TestClient(app,base_url='http://127.0.0.1:8765') as client:
        client.headers['x-crm-token']=client.get('/api/session').json()['token']
        with app.state.engine.begin() as c:
            c.execute(text("UPDATE accounts SET remote_id=:id,verified_at=:d WHERE id='contact'"),dict(id=INBOX,d=NOW.isoformat()))
        yield client,app,state,calls


def prepare(client, **changes):
    response = client.post('/api/mail/sender-tests',json=dict(dict(account_id='contact',recipient=RECIPIENT,profile_id='BR',owner_confirmed=True),**changes))
    assert response.status_code==200,response.text
    return response.json()


def confirm(test):
    return dict(confirm=True,content_hash=test['content_hash'])


def send(client, test):
    return client.post('/api/mail/sender-tests/'+test['id']+'/send',json=confirm(test))


def posts(calls):
    return [request for request in calls if request.method=='POST']


def test_preparation_is_local_fixed_preview_not_approval(setup):
    client,app,_,calls = setup
    test = prepare(client)
    assert test['status']=='pending' and not test['attempted_at']
    assert test['payload']['from_address']==test['payload']['reply_to']==ADDRESS
    assert test['payload']['recipient']==RECIPIENT
    assert 'https://conectaimoveis3d.com.br' in test['payload']['body_text']
    assert prepare(client)['id']==test['id'] and not calls
    assert client.post('/api/mail/sender-tests',json=dict(account_id='contact',recipient=RECIPIENT,owner_confirmed=True,subject='injection')).status_code==422
    assert client.post('/api/mail/sender-tests/'+test['id']+'/send',json=dict(confirm=False,content_hash=test['content_hash'])).status_code==422
    assert client.post('/api/mail/sender-tests/'+test['id']+'/send',json=dict(confirm=True,content_hash='0'*64)).status_code==409
    assert client.post('/api/mail/sender-tests/'+test['id']+'/received',json=confirm(test)).status_code==409
    assert not posts(calls)
    with app.state.engine.connect() as c:
        assert not c.execute(text('SELECT count(*) FROM outbound_drafts')).scalar_one()


@pytest.mark.parametrize('recipient',['Owner <owner@example.invalid>','a@example.invalid,b@example.invalid','owner@example.invalid\r\nBcc:x@example.invalid','no-domain','a;z@example.invalid'])
def test_recipient_is_one_bare_address(setup,recipient):
    client,_,_,calls = setup
    assert client.post('/api/mail/sender-tests',json=dict(account_id='contact',recipient=recipient,owner_confirmed=True)).status_code==422
    assert not calls


def test_ready_diagnostic_get_only_and_does_not_enable_campaigns(setup):
    client,_,_,calls = setup
    report = client.post('/api/mail/sender-diagnostics/check',json=dict(account_id='contact')).json()
    assert report['ready_for_test'] and report['warnings'] and not report['campaign_send_enabled']
    assert report['spf']==report['dkim']=='verified' and report['dmarc_policy']=='none'
    assert client.get('/api/mail/sender-diagnostics').json()['items']==[report]
    assert calls and all(request.method=='GET' for request in calls)
    assert not client.get('/api/outbound/policy').json()['send_enabled']


@pytest.mark.parametrize('failure',['domain','sending','spf','dkim','dmarc','inbox','records'])
def test_domain_failures_block_post(setup,failure):
    client,_,state,calls = setup
    if failure=='domain':state['domain']['status']='pending'
    if failure=='sending':state['domain']['capabilities']['sending']='disabled'
    if failure=='spf':state['domain']['records'][0]['status']='pending'
    if failure=='dkim':state['domain']['records']=state['domain']['records'][:1]
    if failure=='dmarc':state['dns']=dict(status='missing',policy=None)
    if failure=='inbox':state['inbox']=DOMAIN
    if failure=='records':state['domain']['records']='malformed'
    report = client.post('/api/mail/sender-diagnostics/check',json=dict(account_id='contact'))
    assert report.status_code==200 and not report.json()['ready_for_test']
    test = prepare(client)
    assert send(client,test).status_code==409 and not posts(calls)


def test_send_once_exact_approved_payload_then_refresh_and_receipt(setup):
    client,app,state,calls = setup
    test = prepare(client)
    result = send(client,test)
    assert result.status_code==200,result.text
    accepted = result.json()
    assert accepted['status']=='accepted' and accepted['provider_id']==EMAIL
    assert not accepted['campaign_send_enabled'] and not accepted['received_at']
    payload = json.loads(posts(calls)[0].content)
    assert payload=={'from':'Conecta Imóveis 3D <'+ADDRESS+'>','to':[RECIPIENT],'reply_to':ADDRESS,
                     'subject':test['payload']['subject'],'text':test['payload']['body_text']}
    assert send(client,test).json()['status']=='accepted' and len(posts(calls))==1
    url='/api/mail/sender-tests/'+test['id']
    assert client.post(url+'/refresh',json={}).json()['status']=='delivered'
    assert client.post(url+'/received',json=confirm(test)).json()['received_at']==NOW.isoformat()
    assert client.post(url+'/refresh',json={}).json()['status']=='received'
    state['received_during_refresh']=True
    with app.state.engine.begin() as c:
        c.execute(text("UPDATE sender_tests SET status='accepted'"))
    assert client.post(url+'/refresh',json={}).json()['status']=='received'
    with app.state.engine.connect() as c:
        assert KEY not in str(c.execute(text('SELECT * FROM audit_events')).all())
    assert KEY not in client.get('/api/mail/sender-tests').text


def test_blocklist_rechecked_after_preview(setup):
    client,app,_,calls=setup
    test=prepare(client)
    with app.state.engine.begin() as c:
        c.execute(text("INSERT INTO suppression_list(address,reason,created_at) VALUES(:a,'manual',:d)"),dict(a=RECIPIENT,d=NOW.isoformat()))
    assert send(client,test).status_code==409 and not posts(calls)
    assert client.post('/api/mail/sender-tests',json=dict(account_id='contact',recipient=RECIPIENT,owner_confirmed=True)).status_code==409


def test_tampered_saved_body_cannot_use_original_approval(setup):
    client,app,_,calls=setup
    test=prepare(client)
    altered=copy.deepcopy(test['payload']);altered['body_text']='Changed'
    with app.state.engine.begin() as c:
        c.execute(text('UPDATE sender_tests SET payload=:p'),dict(p=json.dumps(altered)))
    assert send(client,test).status_code==409 and not posts(calls)


@pytest.mark.parametrize('failure',['timeout',408,409,500,302,'malformed','oversized'])
def test_ambiguous_attempt_is_recorded_never_repeated(setup,failure):
    client,_,state,calls=setup
    if failure=='timeout':state['timeout']=True
    elif failure=='malformed':state['post_body']=dict(id='not-uuid')
    elif failure=='oversized':state['post_body']=dict(id=EMAIL,extra='x'*17000)
    else:state['post_status']=failure
    test=prepare(client)
    result=send(client,test)
    assert result.status_code==200,result.text
    assert result.json()['status']=='delivery_unknown' and result.json()['attempted_at']
    assert KEY not in result.text
    assert send(client,test).json()['status']=='delivery_unknown' and len(posts(calls))==1
    assert client.post('/api/mail/sender-tests',json=dict(account_id='contact',recipient=RECIPIENT,owner_confirmed=True)).status_code==409


def test_provider_rejection_and_global_daily_limit(setup):
    client,_,state,calls=setup
    state['post_status']=429
    for index in range(3):
        assert send(client,prepare(client,recipient=f'owner{index}@example.invalid')).json()['status']=='failed'
    pending=prepare(client,recipient='owner3@example.invalid')
    assert send(client,pending).status_code==409 and len(posts(calls))==3
    state['now']+=timedelta(days=1)
    assert send(client,pending).json()['status']=='failed' and len(posts(calls))==4


def test_interrupted_attempt_is_not_retried(setup):
    client,app,state,calls=setup
    test=prepare(client)
    with app.state.engine.begin() as c:
        c.execute(text("UPDATE sender_tests SET status='sending',attempted_at=:d"),dict(d=(NOW-timedelta(minutes=3)).isoformat()))
    assert client.get('/api/mail/sender-tests').json()[0]['status']=='delivery_unknown'
    assert send(client,test).json()['status']=='delivery_unknown' and not posts(calls)


def test_refresh_rejects_unrelated_remote_message(setup):
    client,_,state,_=setup
    test=prepare(client);assert send(client,test).status_code==200
    state['remote']['to']=['someone-else@example.invalid']
    assert client.post('/api/mail/sender-tests/'+test['id']+'/refresh',json={}).status_code==409
    assert client.get('/api/mail/sender-tests').json()[0]['status']=='accepted'


@pytest.mark.parametrize('record,expected',[
    ('"v=DMARC1; p=none"',('found','none')),
    ('"v=DMARC1; " "p=reject; rua=mailto:dmarc@example.invalid"',('found','reject')),
    ('"v=DMARC1; p=quarantine; p=reject"',('invalid',None)),
    ('"v=DMARC1; p=none; p=invalid"',('invalid',None)),
    ('"v=DMARC1; p=other"',('invalid',None)),
    ('"v=DMARC1; rua=mailto:x@example.invalid"',('invalid',None)),
    ('"unrelated=value"',('missing',None)),
])
def test_public_dmarc_parsing_without_credentials(record,expected):
    def handle(request):
        assert request.method=='GET' and request.url.host=='dns.google'
        assert 'authorization' not in request.headers
        assert request.url.params['name']=='_dmarc.conectaimoveis3d.com'
        return httpx.Response(200,json=dict(Status=0,Answer=[dict(type=16,name='_dmarc.conectaimoveis3d.com.',data=record)]))
    result=dmarc('conectaimoveis3d.com',httpx.MockTransport(handle))
    assert (result['status'],result['policy'])==expected


@pytest.mark.parametrize('response,status',[
    (dict(Status=3),'missing'),(dict(Status=2),'unknown'),
    (dict(Status=0,Answer=[dict(type=16,name='_dmarc.other.invalid',data='"v=DMARC1; p=reject"')]),'missing'),
    (dict(Status=0,Answer=[dict(type=16,name='_dmarc.conectaimoveis3d.com',data='"v=DMARC1; p=reject"')]*2),'invalid'),
    (dict(Status=0,Answer='malformed'),'unknown'),
])
def test_dmarc_missing_ambiguous_and_malformed(response,status):
    assert dmarc('conectaimoveis3d.com',httpx.MockTransport(lambda r:httpx.Response(200,json=response)))['status']==status


def test_dns_timeout_and_domain_allowlist():
    calls=[]
    def handle(request):
        calls.append(request)
        raise httpx.ReadTimeout('private',request=request)
    transport=httpx.MockTransport(handle)
    assert dmarc('unrelated.invalid',transport)['status']=='unknown' and not calls
    assert dmarc('conectaimoveis3d.com',transport)['status']=='unknown' and len(calls)==1


def test_domain_boundary_rejects_non_string_name():
    client=ResendClient(KEY,interval=0,transport=httpx.MockTransport(lambda r:httpx.Response(200,json=dict(data=[dict(name=None)],has_more=False))))
    try:
        with pytest.raises(ResendError):client.domain('conectaimoveis3d.com')
    finally:client.close()

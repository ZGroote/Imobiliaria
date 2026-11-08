import json
from datetime import datetime,timedelta,timezone
from uuid import uuid4,uuid5,NAMESPACE_URL

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.app.main import create_app
from backend.app.real_transport import RealTransport
from backend.app import real_delivery_worker as worker_module
from backend.app.classification import suppress
from backend.app.mail import save_message
from backend.app.provider import Mail
from test_outbound import data as draft_data

NOW=datetime(2026,11,9,14,tzinfo=timezone.utc)
KEY='re_fictitious_real_queue'
ADDRESS='contact@conectaimoveis3d.com'


@pytest.fixture
def real(tmp_path,monkeypatch):
    state=dict(now=NOW,ready=True,posts=[],requests=[],backups=[],remote_event='delivered',remote={},key_reads=0)
    class Credentials:
        def get(self,account):state['key_reads']+=1;return KEY
    class Read:
        def find_inbox(self,address):return '00000000-0000-4000-8000-000000000001'
        def domain(self,domain):return dict(status='verified' if state['ready'] else 'pending',capabilities=dict(sending='enabled'),records=[dict(record='SPF',status='verified'),dict(record='DKIM',status='verified')])
        def close(self):pass
    def transport(request):
        state['requests'].append(request)
        if request.method=='POST':
            did=request.headers['idempotency-key'].split('/')[1]
            with app.state.engine.connect() as c:
                assert c.execute(text('SELECT status FROM real_deliveries WHERE id=:id'),dict(id=did)).scalar_one()=='sending'
            value=json.loads(request.content);state['posts'].append(value)
            if state.get('during_send'):state['during_send']()
            remote=str(uuid5(NAMESPACE_URL,did));state['remote'][remote]=value
            if state.get('timeout'):raise httpx.ReadTimeout('FICTITIOUS_PRIVATE '+KEY,request=request)
            return httpx.Response(state.get('post_status',200),json=dict(id=remote))
        remote=request.url.path.rsplit('/',1)[1];value=state['remote'][remote]
        result=dict(value,id=remote,cc=[],bcc=[],reply_to=[value['reply_to']],last_event=state['remote_event'],message_id='<'+remote+'@fixture.invalid>')
        if state.get('mismatch'):result['tags']=[]
        return httpx.Response(200,json=result)
    monkeypatch.setattr(worker_module,'encrypted_backup',lambda path:state['backups'].append(str(path)))
    app=create_app(tmp_path/'cache.sqlite3',credentials=Credentials(),client_factory=lambda key:Read(),
        dns_resolver=lambda domain:dict(status='found',policy='none'),start_mail_worker=False,
        real_transport_factory=lambda key:RealTransport(key,transport=httpx.MockTransport(transport)))
    app.state.clock=lambda:state['now']
    with TestClient(app,base_url='http://127.0.0.1:8765') as client:
        client.headers['X-CRM-Token']=client.get('/api/session').json()['token']
        with app.state.engine.begin() as c:
            c.execute(text("UPDATE accounts SET remote_id='00000000-0000-4000-8000-000000000001',verified_at=:d WHERE id='contact'"),dict(d=NOW.isoformat()))
        yield client,app,state


def authorization(client,recipient='person@example.invalid',basis='service_request'):
    response=client.post('/api/recipient-authorizations',json=dict(request_id=str(uuid4()),address=recipient,profile_id='US',basis=basis,
        note='Permissão fictícia do destinatário, somente para teste.',observed_on=NOW.date().isoformat(),expires_on=(NOW.date()+timedelta(days=30)).isoformat(),confirm=True,permission_confirmed=True))
    assert response.status_code==200,response.text
    return response.json()


def draft(client,**changes):
    response=client.post('/api/outbound/drafts',json=draft_data(**dict(dict(purpose='delivery',metadata=dict(project_completed=True)),**changes)))
    assert response.status_code==200,response.text
    row=response.json()
    approved=client.post('/api/outbound/drafts/'+row['id']+'/approve',json=dict(version=row['version'],content_hash=row['content_hash'],confirm=True))
    assert approved.status_code==200,approved.text
    return approved.json()


def prepare(client,row,auth,**changes):
    return client.post('/api/real-deliveries',json=dict(request_id=str(uuid4()),draft_id=row['id'],version=row['version'],content_hash=row['content_hash'],authorization_id=auth['id'],**changes))


def approve(client,row):
    response=client.post('/api/real-deliveries/'+row['id']+'/approve',json=dict(approval_hash=row['approval_hash'],confirm=True,real_send_authorized=True))
    assert response.status_code==200,response.text
    return response.json()


def enable(client):
    control=client.get('/api/real-deliveries/control').json()
    return client.put('/api/real-deliveries/control',json=dict(version=control['version'],paused=False,real_send_authorized=True))


def test_prepare_approve_and_global_resume_are_separate_before_single_attempt(real):
    client,app,state=real;auth=authorization(client);row=draft(client);delivery=prepare(client,row,auth).json()
    assert client.get('/api/outbound/drafts?approved_only=true').json()['total']==1
    worker=app.state.delivery_worker;worker.tick();assert state['requests']==[] and state['key_reads']==0
    approved=approve(client,delivery);worker.tick();assert state['requests']==[]
    assert enable(client).status_code==200;worker.tick()
    value=client.get('/api/real-deliveries/'+delivery['id']).json()
    assert value['status']=='sent' and value['remote_id'] and len(state['posts'])==1
    assert client.get('/api/outbound/drafts?approved_only=true').json()['total']==0
    worker.tick();assert len(state['posts'])==1
    refreshed=client.post('/api/real-deliveries/'+delivery['id']+'/refresh',json=dict(confirm=True))
    assert refreshed.status_code==200,refreshed.text
    assert refreshed.json()['status']=='delivered' and len(state['posts'])==1
    assert client.get('/api/real-deliveries/control').json()['error']==''
    with app.state.engine.connect() as c:
        assert c.execute(text("SELECT count(*) FROM messages WHERE direction='outbound'")).scalar_one()==1
        assert c.execute(text('SELECT count(*) FROM classification_reviews')).scalar_one()==0
    assert len(state['backups'])>=2


def test_public_research_and_wrong_or_expired_permission_never_enable_delivery(real):
    client,app,state=real;auth=authorization(client);row=draft(client)
    wrong=draft(client,recipient='other@example.invalid')
    assert prepare(client,wrong,auth).status_code==409
    outreach=client.post('/api/outbound/drafts',json=draft_data()).json()
    client.post('/api/outbound/drafts/'+outreach['id']+'/approve',json=dict(version=1,content_hash=outreach['content_hash'],confirm=True))
    assert prepare(client,outreach,auth).status_code==409
    row=prepare(client,row,auth).json();approve(client,row);enable(client)
    state['now']=NOW+timedelta(days=31);app.state.delivery_worker.tick()
    assert state['posts']==[]


def test_authorization_revoke_and_draft_change_block_previously_approved_send(real):
    client,app,state=real;auth=authorization(client);row=draft(client);delivery=approve(client,prepare(client,row,auth).json())
    revoked=client.post('/api/recipient-authorizations/'+auth['id']+'/revoke',json=dict(version=1,confirm=True));assert revoked.status_code==200
    assert client.get('/api/real-deliveries/'+delivery['id']).json()['status']=='blocked'
    enable(client);app.state.delivery_worker.tick();assert state['requests']==[]
    auth=authorization(client);row=draft(client,subject='Outra mensagem fictícia');delivery=approve(client,prepare(client,row,auth).json())
    changed=draft_data(purpose='delivery',metadata=dict(project_completed=True),subject='Texto mudou',version=1)
    assert client.put('/api/outbound/drafts/'+row['id'],json=changed).status_code==200
    app.state.delivery_worker.tick()
    assert client.get('/api/real-deliveries/'+delivery['id']).json()['status']=='blocked' and not state['posts']


def test_timeout_is_unknown_pauses_queue_and_reconciliation_only_reads(real):
    client,app,state=real;auth=authorization(client);row=draft(client);delivery=approve(client,prepare(client,row,auth).json());enable(client)
    state['timeout']=True;app.state.delivery_worker.tick()
    value=client.get('/api/real-deliveries/'+delivery['id']).json();assert value['status']=='unknown' and KEY not in json.dumps(value)
    assert enable(client).status_code==409
    app.state.delivery_worker.tick();assert len(state['posts'])==1
    assert client.post('/api/real-deliveries/'+delivery['id']+'/cancel',json=dict(confirm=True)).status_code==409
    remote=next(iter(state['remote']))
    state['mismatch']=True
    assert client.post('/api/real-deliveries/'+delivery['id']+'/refresh',json=dict(confirm=True,remote_id=remote)).status_code==409
    state['mismatch']=False
    response=client.post('/api/real-deliveries/'+delivery['id']+'/refresh',json=dict(confirm=True,remote_id=remote))
    assert response.status_code==200,response.text
    assert response.json()['status']=='delivered' and len(state['posts'])==1


def test_bounce_adds_global_block_and_no_future_message_is_sent(real):
    client,app,state=real;auth=authorization(client);row=draft(client);delivery=approve(client,prepare(client,row,auth).json());enable(client);app.state.delivery_worker.tick()
    state['remote_event']='bounced'
    assert client.post('/api/real-deliveries/'+delivery['id']+'/refresh',json=dict(confirm=True)).json()['status']=='bounced'
    with app.state.engine.connect() as c:assert c.execute(text('SELECT address FROM suppression_list')).scalar_one()=='person@example.invalid'
    app.state.delivery_worker.tick();assert len(state['posts'])==1


def test_campaign_starts_paused_and_requires_its_own_activation(real):
    client,app,state=real;auth=authorization(client);row=draft(client)
    campaign=client.post('/api/real-deliveries/campaigns',json=dict(name='Campanha fictícia autorizada',confirm=True)).json()
    delivery=approve(client,prepare(client,row,auth,campaign_id=campaign['id']).json());enable(client)
    app.state.delivery_worker.tick();assert not state['posts']
    response=client.put('/api/real-deliveries/campaigns/'+campaign['id'],json=dict(version=1,paused=False,confirm=True));assert response.status_code==200
    app.state.delivery_worker.tick();assert len(state['posts'])==1


def test_domain_failure_and_backup_failure_prevent_post(real,monkeypatch):
    client,app,state=real;auth=authorization(client);row=draft(client);delivery=approve(client,prepare(client,row,auth).json());enable(client)
    state['ready']=False;app.state.delivery_worker.tick();assert not state['posts']
    assert client.get('/api/real-deliveries/'+delivery['id']).json()['error_code']=='provider_not_ready'
    state['ready']=True;row=draft(client,subject='Backup fictício');delivery=approve(client,prepare(client,row,auth).json())
    def fail(path):raise OSError('FICTITIOUS')
    monkeypatch.setattr(worker_module,'encrypted_backup',fail);app.state.delivery_worker.tick()
    assert client.get('/api/real-deliveries/'+delivery['id']).json()['error_code']=='backup_failed' and not state['posts']


def test_day_budget_includes_sender_tests_and_has_no_secret_reads_when_full(real):
    client,app,state=real;auth=authorization(client);row=draft(client);delivery=approve(client,prepare(client,row,auth).json());enable(client)
    with app.state.engine.begin() as c:
        for _ in range(16):
            c.execute(text("INSERT INTO sender_tests(id,account_id,payload,content_hash,status,created_at,attempted_at) VALUES(:id,'contact','{}','fixture','failed',:d,:d)"),dict(id=uuid4().hex,d=(NOW-timedelta(minutes=10)).isoformat()))
    app.state.delivery_worker.tick()
    assert state['requests']==[] and state['key_reads']==0
    assert client.get('/api/real-deliveries/'+delivery['id']).json()['status']=='approved'


def test_new_attempt_waits_for_global_interval_then_runs_once(real):
    client,app,state=real;auth=authorization(client);first=approve(client,prepare(client,draft(client),auth).json());enable(client);app.state.delivery_worker.tick()
    second=approve(client,prepare(client,draft(client,subject='Segundo envio fictício'),auth).json())
    app.state.delivery_worker.tick();assert len(state['posts'])==1
    state['now']=NOW+timedelta(seconds=31);app.state.delivery_worker.tick();assert len(state['posts'])==2


def test_sending_state_prevents_edit_cancel_or_second_attempt(real):
    client,app,state=real;auth=authorization(client);row=draft(client);delivery=approve(client,prepare(client,row,auth).json());enable(client)
    def during():
        changed=draft_data(purpose='delivery',metadata=dict(project_completed=True),version=1,subject='Não pode alterar agora')
        assert client.put('/api/outbound/drafts/'+row['id'],json=changed).status_code==409
        assert client.post('/api/outbound/drafts/'+row['id']+'/cancel',json=dict(version=1,confirm=True)).status_code==409
        assert client.post('/api/real-deliveries/'+delivery['id']+'/cancel',json=dict(confirm=True)).status_code==409
        assert client.post('/api/real-deliveries/'+delivery['id']+'/approve',json=dict(approval_hash=delivery['approval_hash'],confirm=True,real_send_authorized=True)).status_code==409
    state['during_send']=during;app.state.delivery_worker.tick();assert len(state['posts'])==1


def test_expired_authorization_is_refused_during_preparation_and_mutated_approval_is_refused(real):
    client,app,state=real;auth=authorization(client);row=draft(client);delivery=prepare(client,row,auth).json()
    assert client.post('/api/real-deliveries/'+delivery['id']+'/approve',json=dict(approval_hash='0'*64,confirm=True,real_send_authorized=True)).status_code==409
    assert client.post('/api/real-deliveries/'+delivery['id']+'/approve',json=dict(approval_hash=delivery['approval_hash'],confirm=True,real_send_authorized=False)).status_code==422
    state['now']=NOW+timedelta(days=31)
    other=draft(client,subject='Permissão antiga')
    assert prepare(client,other,auth).status_code==409 and not state['posts']


def test_recovery_keeps_unknown_and_does_not_retry_while_new_worker_exists(real):
    client,app,state=real;auth=authorization(client);delivery=approve(client,prepare(client,draft(client),auth).json());worker=app.state.delivery_worker
    assert worker.acquire()
    other=worker_module.DeliveryWorker(app,worker.transport_factory);assert not other.acquire()
    with app.state.engine.begin() as c:
        c.execute(text("UPDATE real_deliveries SET status='sending',attempted_at=:d WHERE id=:id"),dict(id=delivery['id'],d=NOW.isoformat()))
    worker.stop();assert other.acquire();other.tick()
    value=client.get('/api/real-deliveries/'+delivery['id']).json()
    assert value['status']=='unknown' and client.get('/api/real-deliveries/control').json()['paused'] and state['posts']==[]
    other.stop()


@pytest.mark.parametrize('status',[400,429])
def test_definite_refusal_never_retries_and_rate_limit_pauses(real,status):
    client,app,state=real;auth=authorization(client);delivery=approve(client,prepare(client,draft(client),auth).json());enable(client)
    state['post_status']=status;app.state.delivery_worker.tick();app.state.delivery_worker.tick()
    assert client.get('/api/real-deliveries/'+delivery['id']).json()['status']=='rejected' and len(state['posts'])==1
    if status==429:assert client.get('/api/real-deliveries/control').json()['paused']


def test_reply_requires_current_human_review_and_matches_original_sender(real):
    client,app,state=real;auth=authorization(client)
    with app.state.engine.begin() as c:
        mid,_=save_message(c,'contact',Mail(key='reply-source',uid=1,message_id='<request@fixture.invalid>',sender='person@example.invalid',recipient=ADDRESS,
            subject='Pedido fictício',body='Solicito uma demonstração.',received_at=(NOW-timedelta(minutes=5)).isoformat()))
        tid=c.execute(text('SELECT thread_id FROM messages WHERE id=:id'),dict(id=mid)).scalar_one()
    row=draft(client,purpose='reply',thread_id=tid,metadata={})
    assert prepare(client,row,auth).status_code==409
    path='/api/classifications/'+tid+'/messages/'+mid+'/review';context=client.get(path).json()
    response=client.post(path,json=dict(account_id='contact',message_hash=context['message_hash'],version=0,category='demo_request',response_kind='human',note='Revisão fictícia.',confirm=True))
    assert response.status_code==200,response.text
    delivery=approve(client,prepare(client,row,auth).json());enable(client);app.state.delivery_worker.tick()
    assert state['posts'][0]['headers']['In-Reply-To']=='<request@fixture.invalid>'
    with app.state.engine.connect() as c:assert c.execute(text('SELECT count(DISTINCT thread_id) FROM messages')).scalar_one()==1


def test_operator_absence_declaration_does_not_send_and_requires_new_draft_version(real):
    client,app,state=real;auth=authorization(client);row=draft(client);delivery=approve(client,prepare(client,row,auth).json());enable(client)
    state['timeout']=True;app.state.delivery_worker.tick()
    response=client.post('/api/real-deliveries/'+delivery['id']+'/declare-not-sent',json=dict(confirm=True,checked_provider=True,note='Conferência fictícia declarada no painel do provedor.'))
    assert response.status_code==200 and response.json()['status']=='not_sent_declared'
    assert len(state['posts'])==1 and prepare(client,row,auth).status_code==409
    changed=draft_data(purpose='delivery',metadata=dict(project_completed=True),version=1)
    newer=client.put('/api/outbound/drafts/'+row['id'],json=changed).json()
    client.post('/api/outbound/drafts/'+row['id']+'/approve',json=dict(version=2,content_hash=newer['content_hash'],confirm=True))
    pending=approve(client,prepare(client,newer,auth).json())
    remote=next(iter(state['remote']))
    corrected=client.post('/api/real-deliveries/'+delivery['id']+'/refresh',json=dict(confirm=True,remote_id=remote))
    assert corrected.status_code==200,corrected.text
    assert client.get('/api/real-deliveries/'+pending['id']).json()['status']=='blocked'
    app.state.delivery_worker.tick();assert len(state['posts'])==1

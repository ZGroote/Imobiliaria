from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.app.main import create_app
from backend.app.mail import save_message
from backend.app.provider import Mail

NOW=datetime(2026,11,8,2,tzinfo=timezone.utc)


@pytest.fixture
def setup(tmp_path):
    class Credentials:
        def get(self,*args):raise AssertionError('O funil não acessa credenciais.')
    def forbidden(*args):raise AssertionError('O funil não acessa o transporte.')
    app=create_app(tmp_path/'cache.sqlite3',credentials=Credentials(),client_factory=forbidden,sender_transport_factory=forbidden)
    app.state.clock=lambda:NOW
    with TestClient(app,base_url='http://127.0.0.1:8765') as client:
        client.headers['X-CRM-Token']=client.get('/api/session').json()['token']
        with app.state.engine.begin() as c:
            for company_id in ('alpha','beta'):
                c.execute(text('INSERT INTO companies VALUES(:id,:name,:domain,:website,:d)'),dict(id=company_id,name='Fixture '+company_id,domain=company_id+'.invalid',website='https://'+company_id+'.invalid',d=NOW.isoformat()))
            for thread_id,account in [('t1','contact'),('t2','team'),('demo-thread','demo')]:
                c.execute(text('INSERT INTO threads VALUES(:id,:a,:s,:d)'),dict(id=thread_id,a=account,s='Fixture de conversa',d=NOW.isoformat()))
        yield client,app


def data(**changes):
    return dict(dict(confirm=True,request_id='a'*32,company_id='alpha',title='Apresentação de visualização 3D',
        stage='qualification',amount_minor=123456,currency='USD',next_step='Revisar briefing',due_on='2026-11-06',notes='Condições em avaliação.'),**changes)


def create(client,**changes):
    response=client.post('/api/opportunities',json=data(**changes))
    assert response.status_code==200,response.text
    return response.json()


def update(client,item,**changes):
    payload={key:item[key] for key in ('title','stage','amount_minor','currency','next_step','due_on','notes','version')}
    return client.put('/api/opportunities/'+item['id'],json=dict(payload,confirm=True,**changes))


def link(client,thread_id='t1',**changes):
    return client.post('/api/mail/threads/'+thread_id+'/commercial-links',json=dict(dict(confirm=True,company_id='alpha',opportunity_id=None),**changes))


def test_create_is_local_audited_and_idempotent(setup):
    client,app=setup
    item=create(client)
    assert item['version']==1 and item['company_name']=='Fixture alpha' and not item['send_enabled']
    assert item['history'][0]['action']=='opportunity_created' and item['amount_minor']==123456
    assert create(client)['id']==item['id']
    assert len(create(client)['history'])==1
    assert client.post('/api/opportunities',json=data(title='Different input')).status_code==409
    with app.state.engine.connect() as c:
        assert c.execute(text('SELECT count(*) FROM outbound_drafts')).scalar_one()==0
        assert c.execute(text('SELECT count(*) FROM sender_tests')).scalar_one()==0


@pytest.mark.parametrize('changes',[dict(confirm=False),dict(company_id='missing'),dict(stage='send_now'),
    dict(amount_minor=-1),dict(amount_minor=1.5),dict(amount_minor='100'),dict(amount_minor=True),dict(amount_minor=1_000_000_000_001),dict(currency=None),dict(amount_minor=None),
    dict(currency='EUR'),dict(title=' '),dict(next_step=''),dict(due_on='not-date'),dict(auto_send_allowed=True)])
def test_invalid_or_unconfirmed_opportunity_cannot_be_saved(setup,changes):
    client,_=setup
    assert client.post('/api/opportunities',json=data(**changes)).status_code in (404,422)
    assert client.get('/api/opportunities').json()['total']==0


def test_updates_require_current_version_keep_company_and_audit_changes(setup):
    client,_=setup
    old=create(client)
    assert update(client,old).json()['version']==1
    response=update(client,old,stage='proposal',notes='Proposta em revisão')
    assert response.status_code==200,response.text
    new=response.json()
    assert new['version']==2 and len(new['history'])==2
    assert new['history'][0]['payload']['changes']['stage']==dict(before='qualification',after='proposal')
    assert update(client,old,stage='won').status_code==409
    body={key:new[key] for key in ('title','stage','amount_minor','currency','next_step','due_on','notes','version')}
    assert client.put('/api/opportunities/'+old['id'],json=dict(body,confirm=True,company_id='beta')).status_code==422
    assert client.get('/api/opportunities/'+old['id']).json()['company_id']=='alpha'


def test_zero_estimate_and_empty_estimate_are_distinct(setup):
    client,_=setup
    zero=create(client,amount_minor=0)
    assert zero['amount_minor']==0 and zero['currency']=='USD'
    empty=create(client,request_id='c'*32,amount_minor=None,currency=None,next_step='',due_on=None)
    assert empty['amount_minor'] is None and empty['currency'] is None


def test_listing_filters_personal_dates_and_currency_not_combined(setup):
    client,_=setup
    create(client)
    create(client,request_id='b'*32,company_id='beta',stage='won',currency='BRL')
    create(client,request_id='c'*32,title='Ação para hoje',amount_minor=None,currency=None,due_on='2026-11-07')
    listing=client.get('/api/opportunities').json()
    assert listing['today']=='2026-11-07' and listing['total']==3
    overdue=client.get('/api/opportunities?overdue_only=true').json()
    assert overdue['total']==1 and overdue['items'][0]['id']=='a'*32
    assert client.get('/api/opportunities?company_id=beta').json()['total']==1
    assert client.get('/api/opportunities?stage=won&q=Fixture').json()['total']==1
    assert client.get('/api/opportunities?stage=invalid').status_code==422
    assert len(client.get('/api/opportunities?offset=1&limit=1').json()['items'])==1
    assert 'currency_totals' not in listing


def test_associations_validate_company_and_are_idempotent(setup):
    client,_=setup
    a=create(client)
    b=create(client,request_id='b'*32,company_id='beta')
    assert link(client,opportunity_id=b['id']).status_code==409
    assert link(client,company_id='missing').status_code==404
    assert link(client,confirm=False).status_code==422
    first=link(client,opportunity_id=a['id'])
    assert first.status_code==200,first.text
    link_id=first.json()['items'][0]['id']
    assert link(client,opportunity_id=a['id']).json()['items'][0]['id']==link_id
    assert link(client,company_id='beta').status_code==200
    detail=client.get('/api/companies/alpha/commercial').json()
    assert len(detail['links'])==len(detail['opportunities'])==1
    assert detail['links'][0]['thread_id']=='t1'
    assert len([e for e in detail['history'] if e['action']=='conversation_linked'])==1
    assert len(client.get('/api/opportunities/'+a['id']).json()['links'])==1


def test_demo_cannot_link_and_removal_is_explicit_local_and_idempotent(setup):
    client,_=setup
    assert not client.get('/api/mail/threads/demo-thread/commercial-links').json()['can_link']
    assert link(client,'demo-thread').status_code==409
    row=link(client).json()['items'][0]
    url='/api/mail/threads/t1/commercial-links/'+row['id']+'/remove'
    assert client.post(url,json={'confirm':False}).status_code==422
    assert client.post(url,json={'confirm':True}).json()['items']==[]
    assert client.post(url,json={'confirm':True}).json()['items']==[]
    detail=client.get('/api/companies/alpha/commercial').json()
    assert len([e for e in detail['history'] if e['action']=='conversation_unlinked'])==1
    assert client.get('/api/mail/threads/t1').status_code==200


def test_wrong_thread_cannot_remove_another_association(setup):
    client,_=setup
    row=link(client).json()['items'][0]
    client.post('/api/mail/threads/t2/commercial-links/'+row['id']+'/remove',json={'confirm':True})
    assert len(client.get('/api/mail/threads/t1/commercial-links').json()['items'])==1


def test_suppression_and_source_data_are_not_modified_by_commercial_context(setup):
    client,app=setup
    with app.state.engine.begin() as c:
        c.execute(text("INSERT INTO suppression_list(address,reason,created_at) VALUES('blocked@sample.invalid','manual',:d)"),dict(d=NOW.isoformat()))
    create(client);link(client)
    with app.state.engine.connect() as c:
        assert c.execute(text('SELECT count(*) FROM suppression_list')).scalar_one()==1
        assert c.execute(text('SELECT count(*) FROM job_candidates')).scalar_one()==0


@pytest.mark.parametrize('duplicate',[False,True])
def test_later_message_grouping_preserves_all_commercial_contexts(setup,duplicate):
    client,app=setup
    def message(key,refs=()):
        return Mail(key=key,uid=1,message_id='<'+key+'@fixture.invalid>',sender='sender@fixture.invalid',
            recipient='contact@conectaimoveis3d.com',subject='Thread fixture',body='Texto fictício',received_at=NOW.isoformat(),references=refs)
    with app.state.engine.begin() as c:
        a,_=save_message(c,'contact',message('first'))
        b,_=save_message(c,'contact',message('second'))
        ids=c.execute(text('SELECT id,thread_id FROM messages WHERE id IN (:a,:b)'),dict(a=a,b=b)).all()
        tids=dict(ids);ta,tb=tids[a],tids[b]
    link(client,ta)
    link(client,tb,company_id='alpha' if duplicate else 'beta')
    opportunity=create(client)
    link(client,tb,opportunity_id=opportunity['id'])
    with app.state.engine.begin() as c:
        save_message(c,'contact',message('bridge',('<first@fixture.invalid>','<second@fixture.invalid>')))
    result=client.get('/api/mail/threads/'+ta+'/commercial-links').json()['items']
    assert len(result)==(2 if duplicate else 3)
    assert any(row['opportunity_id']==opportunity['id'] for row in result)
    assert client.get('/api/mail/threads/'+tb).status_code==404
    detail=client.get('/api/companies/alpha/commercial').json()
    merged=[e for e in detail['history'] if e['action']=='thread_links_merged']
    assert merged and all(e['actor']=='mail_sync' for e in merged)
    if duplicate:assert any(e['payload']['consolidated'] for e in merged)
    with app.state.engine.connect() as c:
        assert not c.execute(text('PRAGMA foreign_key_check')).all()

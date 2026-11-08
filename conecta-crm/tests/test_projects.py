from datetime import datetime, timezone
import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.app.main import create_app

NOW=datetime(2026,11,8,13,tzinfo=timezone.utc)


@pytest.fixture
def setup(tmp_path):
    class Credentials:
        def get(self,*args):raise AssertionError('Projetos não acessam credenciais.')
    def forbidden(*args):raise AssertionError('Projetos não acessam o provedor.')
    app=create_app(tmp_path/'cache.sqlite3',credentials=Credentials(),client_factory=forbidden,sender_transport_factory=forbidden)
    app.state.clock=lambda:NOW
    with TestClient(app,base_url='http://127.0.0.1:8765') as client:
        client.headers['X-CRM-Token']=client.get('/api/session').json()['token']
        with app.state.engine.begin() as c:
            c.execute(text("INSERT INTO companies VALUES('fixture','Empresa fictícia','fixture.invalid','https://fixture.invalid',:d)"),dict(d=NOW.isoformat()))
        yield client,app


def opportunity(client,key='a'*32):
    response=client.post('/api/opportunities',json=dict(confirm=True,request_id=key,company_id='fixture',title='Negociação fictícia'))
    assert response.status_code==200,response.text
    return response.json()


def create(client,opp,**changes):
    return client.post('/api/projects',json=dict(dict(confirm=True,request_id='b'*32,opportunity_id=opp['id'],opportunity_version=opp['version'],title='Projeto fictício'),**changes))


def update(client,row,**changes):
    return client.put('/api/projects/'+row['id'],json=dict(dict(confirm=True,version=row['version'],**row['payload']),**changes))


def test_project_creation_idempotency_and_one_per_opportunity(setup):
    client,app=setup;opp=opportunity(client)
    response=create(client,opp,scope='Somente o escopo informado.');assert response.status_code==200,response.text
    project=response.json()
    assert project['payload']['materials']=='' and project['source_proposal'] is None
    assert not project['client_accepted'] and not project['send_enabled']
    assert create(client,opp,scope='Somente o escopo informado.').json()['id']==project['id']
    assert create(client,opp,title='Outra').status_code==409
    assert create(client,opp,request_id='c'*32).status_code==409
    assert update(client,project).json()['version']==1
    assert len(client.get('/api/projects/'+project['id']).json()['history'])==1
    assert client.get('/api/opportunities/'+opp['id']).json()['stage']=='qualification'
    with app.state.engine.connect() as c:
        assert c.execute(text('SELECT count(*) FROM outbound_drafts')).scalar()==0


def test_updates_have_versions_and_history_on_readback(setup):
    client,_=setup;project=create(client,opportunity(client)).json()
    response=update(client,project,stage='production',materials='Planta recebida; referências pendentes.')
    assert response.status_code==200,response.text
    saved=response.json();assert saved['version']==2
    assert update(client,project,title='Edição atrasada').status_code==409
    assert client.get('/api/projects/'+project['id']).json()['payload']['materials'].startswith('Planta recebida')
    assert saved['history'][0]['payload']['changes']['stage']==dict(before='briefing',after='production')
    assert update(client,saved,stage='cancelled').status_code==200


@pytest.mark.parametrize('changes',[
    dict(confirm=False),dict(stage='unknown'),dict(title=' '),dict(extra_field=True),dict(version=2),
    dict(stage='delivered'),dict(delivered_on='2026-11-07'),dict(followup_on='2026-11-10'),
    dict(due_on='2026-11-10'),dict(delivered_on='2026-11-09',delivery_url='https://delivery-fixture.com/project'),
    dict(delivered_on='2026-11-07',delivery_url='https://delivery-fixture.com/project',followup_on='2026-11-06'),
])
def test_invalid_project_inputs_have_no_side_effects(setup,changes):
    client,app=setup
    assert create(client,opportunity(client),**changes).status_code==422
    with app.state.engine.connect() as c:assert c.execute(text('SELECT count(*) FROM projects')).scalar()==0


@pytest.mark.parametrize('url',['http://example.com','javascript:alert(1)','https://user:pass@example.com','https://127.0.0.1','https://[::1]','https://localhost','https://internal.local','https://example.com:8443','https://exa mple.com','https://example.com\\@127.0.0.1','https://example.com\n/path'])
def test_delivery_links_are_validated_without_being_fetched(setup,url):
    client,_=setup
    assert create(client,opportunity(client),delivery_url=url).status_code==422


def test_delivery_aftercare_feedback_and_filtering(setup):
    client,_=setup;opp=opportunity(client)
    project=create(client,opp,next_step='Conferir orientação',due_on='2026-11-10').json()
    for stage in ('ready','delivered','aftercare','closed'):
        response=update(client,project,stage=stage,delivery_url='https://delivery-fixture.com/project?id=demo',delivery_notes='Orientações informadas pelo operador.',delivered_on='2026-11-08',followup_on='2026-11-15',feedback='Observação registrada manualmente, sem inferir satisfação.')
        assert response.status_code==200,response.text
        project=response.json()
    assert client.get('/api/projects?stage=closed&q=fictício').json()['total']==1
    summary=client.get('/api/projects?stage=closed').json()['items'][0]
    assert summary['next_step']=='Conferir orientação' and summary['due_on']=='2026-11-10' and summary['followup_on']=='2026-11-15'
    assert client.get('/api/projects?stage=production').json()['total']==0
    assert client.get('/api/projects?opportunity_id='+opp['id']).json()['items'][0]['id']==project['id']
    assert client.get('/api/projects?offset=1&limit=1').json()['items']==[]
    assert client.get('/api/projects?stage=wrong').status_code==422
    assert client.get('/api/projects/missing').status_code==404
    assert create(client,opp,request_id='c'*32,opportunity_version=2).status_code==409


def test_optional_proposal_source_requires_exact_current_review_and_stays_immutable(setup):
    client,_=setup;opp=opportunity(client)
    fields={name:'Condição fictícia' for name in ('project_name','contact_name','sender_name','scope','deliverables','materials','timeline','revisions','support','payment_terms')}
    p=client.post('/api/proposals',json=dict(request_id='d'*32,opportunity_id=opp['id'],opportunity_version=1,profile_id='BR',amount_minor=12345,currency='BRL',valid_until='2026-12-01',**fields)).json()
    source=dict(proposal_id=p['id'],proposal_version=p['version'],proposal_hash=p['content_hash'])
    assert create(client,opp,**source).status_code==409
    assert create(client,opp,proposal_id=p['id']).status_code==422
    p=client.post('/api/proposals/'+p['id']+'/approve',json=dict(confirm=True,conditions_confirmed=True,version=p['version'],content_hash=p['content_hash'])).json()
    other=opportunity(client,'e'*32)
    assert create(client,other,**source).status_code==409
    assert create(client,opp,**dict(source,proposal_hash='0'*64)).status_code==409
    response=create(client,opp,**source);assert response.status_code==200,response.text
    project=response.json();assert project['source_proposal']['payload']['amount_minor']==12345
    client.put('/api/proposals/'+p['id'],json=dict(p['payload'],opportunity_version=1,version=1,scope='Escopo comercial alterado'))
    assert update(client,project,scope='Escopo de produção registrado manualmente.').status_code==200
    saved=client.get('/api/projects/'+project['id']).json()
    assert saved['source_proposal']['version']==1 and saved['source_proposal']['payload']['scope']=='Condição fictícia'
    assert 'confirm' not in json.dumps(saved['source_proposal'])


def test_project_api_uses_local_session_and_origin_guards(setup):
    client,_=setup
    assert client.get('/api/projects',headers={'X-CRM-Token':'wrong'}).status_code==401
    assert client.get('/api/projects',headers={'Origin':'https://example.com'}).status_code==403

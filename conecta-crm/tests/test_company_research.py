import json
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.app.main import create_app
from test_research_jobs import NOW,job,company,result,import_data,decision


@pytest.fixture
def focused(tmp_path):
    class NoMail:
        def get(self,*args):raise AssertionError('Pesquisa sem credenciais')
    def forbidden(*args):raise AssertionError('Pesquisa sem correio')
    app=create_app(tmp_path/'cache.sqlite3',credentials=NoMail(),client_factory=forbidden,start_mail_worker=False,start_agent_worker=False,start_delivery_worker=False)
    app.state.clock=lambda:NOW
    with TestClient(app,base_url='http://127.0.0.1:8765') as client:
        client.headers['X-CRM-Token']=client.get('/api/session').json()['token']
        initial=job(client,target_count=1);candidate=import_data(client,initial).json()['candidates'][0]
        registered=decision(client,initial,candidate).json()['candidates'][0]['company_id']
        yield client,app,registered


def prepare(client,company_id,**changes):
    return client.post('/api/companies/'+company_id+'/research-jobs',json=dict(request_id=str(uuid4()),confirm=True,state='FL',**changes))


def test_focused_packet_contains_only_public_identity_and_is_idempotent(focused):
    client,app,cid=focused
    with app.state.engine.begin() as c:c.execute(text("UPDATE companies SET website='https://builder-company.com/private/path?token=FICTITIOUS_SECRET#PRIVATE' WHERE id=:id"),dict(id=cid))
    body=dict(request_id=str(uuid4()),confirm=True,state='FL')
    first=client.post('/api/companies/'+cid+'/research-jobs',json=body);assert first.status_code==200,first.text
    row=first.json();assert row['target_count']==1 and row['size_tier']=='any' and row['target_current']
    assert row['target_company']==dict(id=cid,name='Contract test company',domain='builder-company.com',website='https://builder-company.com/',state='FL')
    assert client.post('/api/companies/'+cid+'/research-jobs',json=body).json()['id']==row['id']
    bundle=client.get('/api/jobs/'+row['id']+'/export').json();serial=json.dumps(bundle)
    assert 'FICTITIOUS_SECRET' not in serial and '/private/path' not in serial and '#PRIVATE' not in serial
    assert bundle['target_company']==row['target_company'] and cid in bundle['prompt']
    listed=next(item for item in client.get('/api/jobs').json()['items'] if item['id']==row['id'])
    assert listed['target_company_name']=='Contract test company'
    with app.state.engine.connect() as c:
        assert c.execute(text('SELECT count(*) FROM agent_runs')).scalar_one()==0
        assert c.execute(text('SELECT count(*) FROM real_deliveries')).scalar_one()==0
    assert client.post('/api/companies/'+cid+'/research-jobs',json=dict(body,agent='claude_assisted')).status_code==409


@pytest.mark.parametrize('changes',[dict(confirm=False),dict(state='TX'),dict(state='XX'),dict(agent='shell'),dict(target_count=2),dict(command='dir')])
def test_prepare_rejects_unregistered_state_and_untrusted_parameters(focused,changes):
    client,_,cid=focused
    body=dict(request_id=str(uuid4()),confirm=True,state='FL');body.update(changes)
    assert client.post('/api/companies/'+cid+'/research-jobs',json=body).status_code in (409,422)
    assert prepare(client,'unknown-company').status_code==404


def test_target_domain_is_enforced_and_research_never_overwrites_directory(focused):
    client,app,cid=focused;j=prepare(client,cid).json()
    assert import_data(client,j,companies=[company('https://other-builder.com')]).status_code==409
    assert client.get('/api/jobs/'+j['id']).json()['candidates']==[]
    imported=import_data(client,j,companies=[company('https://www.builder-company.com')]);assert imported.status_code==200,imported.text
    candidate=imported.json()['candidates'][0];assert candidate['status']=='pending' and candidate['company_id'] is None
    assert decision(client,j,candidate).status_code==409
    reviewed=decision(client,j,candidate,merge_confirmed=True);assert reviewed.status_code==200,reviewed.text
    assert reviewed.json()['candidates'][0]['company_id']==cid
    with app.state.engine.connect() as c:
        assert c.execute(text('SELECT count(*) FROM companies')).scalar_one()==1
        for table in ['company_contacts','developments','outbound_drafts','recipient_authorizations','real_deliveries']:
            assert c.execute(text('SELECT count(*) FROM '+table)).scalar_one()==0


def test_identity_change_blocks_export_queue_and_first_import_but_preserves_task(focused):
    client,app,cid=focused;j=prepare(client,cid).json()
    with app.state.engine.begin() as c:c.execute(text("UPDATE companies SET name='Nome público atualizado' WHERE id=:id"),dict(id=cid))
    row=client.get('/api/jobs/'+j['id']).json();assert not row['target_current'] and row['target_company']['name']=='Contract test company'
    assert client.get('/api/jobs/'+j['id']+'/export').status_code==409
    assert client.post('/api/jobs/'+j['id']+'/run',json=dict(request_id=str(uuid4()),input_hash=j['input_hash'],confirm=True)).status_code==409
    assert import_data(client,j).status_code==409
    assert prepare(client,cid).json()['target_company']['name']=='Nome público atualizado'


def test_state_change_blocks_approval_while_rejection_remains_available(focused):
    client,app,cid=focused;j=prepare(client,cid).json();candidate=import_data(client,j).json()['candidates'][0]
    with app.state.engine.begin() as c:c.execute(text("DELETE FROM company_states WHERE company_id=:id AND state='FL'"),dict(id=cid))
    assert decision(client,j,candidate,merge_confirmed=True).status_code==409
    assert decision(client,j,candidate,decision='rejected').status_code==200
    assert client.get('/api/jobs/'+j['id']).json()['target_current'] is False


def test_agent_revalidates_public_identity_after_execution_before_import(focused):
    client,app,cid=focused;j=prepare(client,cid).json()
    class Fake:
        packets=[]
        def run(self,packet,cancelled,progress,**options):
            self.packets.append((packet,options))
            with app.state.engine.begin() as c:c.execute(text("UPDATE companies SET name='Alterado durante QA' WHERE id=:id"),dict(id=cid))
            return result(j['id'],target_count=1)
    worker=app.state.agent_worker;worker.runner=Fake()
    queued=client.post('/api/jobs/'+j['id']+'/run',json=dict(request_id=str(uuid4()),input_hash=j['input_hash'],confirm=True)).json()
    with app.state.engine.begin() as c:c.execute(text('UPDATE agent_control SET paused=0,verified=1 WHERE id=1'))
    worker.tick()
    run=client.get('/api/agent-runs/'+queued['id']).json()
    assert run['status']=='failed' and run['error_code']=='source_changed'
    assert client.get('/api/jobs/'+j['id']).json()['candidates']==[]
    packet,options=worker.runner.packets[0];assert options==dict(web=True) and set(packet)=={'prompt','schema','input_hash'}


def test_nonpublic_website_and_inconsistent_domain_are_not_shared(focused):
    client,app,cid=focused
    for url in ['https://127.0.0.1/secret','https://private.local/','https://other-builder.com/']:
        with app.state.engine.begin() as c:c.execute(text('UPDATE companies SET website=:w WHERE id=:id'),dict(w=url,id=cid))
        assert prepare(client,cid).status_code==409

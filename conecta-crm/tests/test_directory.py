from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.app.main import create_app

NOW=datetime(2026,11,8,13,tzinfo=timezone.utc)


@pytest.fixture
def setup(tmp_path):
    class Credentials:
        def get(self,*args):raise AssertionError('Cadastro não acessa credenciais.')
    def forbidden(*args):raise AssertionError('Cadastro não acessa o provedor.')
    app=create_app(tmp_path/'cache.sqlite3',credentials=Credentials(),client_factory=forbidden,sender_transport_factory=forbidden)
    app.state.clock=lambda:NOW
    with TestClient(app,base_url='http://127.0.0.1:8765') as client:
        client.headers['X-CRM-Token']=client.get('/api/session').json()['token']
        with app.state.engine.begin() as c:
            for key in ('fixture','other'):
                c.execute(text('INSERT INTO companies VALUES(:id,:name,:domain,:site,:d)'),dict(id=key,name=key+' fictícia',domain=key+'.invalid',site='https://'+key+'.invalid',d=NOW.isoformat()))
                c.execute(text("INSERT INTO company_states VALUES(:id,'FL')"),dict(id=key))
        yield client,app


def contact(**changes):
    return dict(dict(confirm=True,sources_confirmed=True,request_id='a'*32,company_id='fixture',name='Equipe fictícia',role='Departamento de testes',email='PERSON@fixture.invalid',channel_url='',source_url='https://source-fixture.com/contact',source_title='Fonte fictícia',observed_at=NOW.isoformat(),confidence=.8,notes='Dados fictícios; nenhum contato real.'),**changes)


def development(**changes):
    return dict(dict(confirm=True,sources_confirmed=True,request_id='b'*32,company_id='fixture',name='Residencial fictício',city='Cidade fictícia',state='FL',address='',building_type='apartments',stage='unknown',stage_as_of=None,source_url='https://source-fixture.com/property',source_title='Ficha fictícia',observed_at=NOW.isoformat(),confidence=.7,notes=''),**changes)


def detail(client,kind,row,company='fixture'):
    return client.get('/api/companies/'+company+'/directory/'+kind+'/'+row['id'])


def update(client,kind,row,**changes):
    return client.put('/api/'+kind+'/'+row['id'],json=dict(dict(confirm=True,sources_confirmed=True,version=row['version'],**row['payload']),**changes))


def test_contact_email_and_form_channels_are_explicit_deduplicated_and_local(setup):
    client,app=setup
    response=client.post('/api/contacts',json=contact());assert response.status_code==200,response.text
    row=response.json();assert row['payload']['email']=='person@fixture.invalid'
    assert not row['contact_authorized'] and not row['send_enabled']
    assert client.post('/api/contacts',json=contact()).json()['id']==row['id']
    assert client.post('/api/contacts',json=contact(name='Outra')).status_code==409
    assert client.post('/api/contacts',json=contact(request_id='c'*32)).status_code==409
    form=client.post('/api/contacts',json=contact(request_id='d'*32,email='',channel_url='https://source-fixture.com/vendor'))
    assert form.status_code==200,form.text
    assert form.json()['payload']['email']==''
    assert client.post('/api/contacts',json=contact(request_id='e'*32,company_id='other')).status_code==200
    with app.state.engine.connect() as c:
        assert c.execute(text('SELECT count(*) FROM outbound_drafts')).scalar()==0
        assert c.execute(text('SELECT count(*) FROM suppression_list')).scalar()==0


@pytest.mark.parametrize('changes',[
    dict(confirm=False),dict(sources_confirmed=False),dict(name=' '),dict(email='not-an-email'),
    dict(email='a@fixture.invalid,b@fixture.invalid'),dict(email='Nome <a@fixture.invalid>'),dict(email='',channel_url=''),
    dict(source_url='http://source-fixture.com'),dict(channel_url='https://localhost'),dict(source_url='https://example.com'),
    dict(observed_at='2026-11-09T13:00:00Z'),dict(confidence=1.1),dict(extra=True),
])
def test_invalid_contact_inputs_do_not_create_records(setup,changes):
    client,app=setup
    assert client.post('/api/contacts',json=contact(**changes)).status_code==422
    with app.state.engine.connect() as c:assert c.execute(text('SELECT count(*) FROM company_contacts')).scalar()==0


def test_versions_history_noop_and_company_scope(setup):
    client,_=setup;row=client.post('/api/contacts',json=contact()).json()
    assert update(client,'contacts',row).json()['version']==1
    saved=update(client,'contacts',row,role='Função atualizada').json()
    assert saved['version']==2 and len(saved['history'])==2
    assert saved['history'][1]['payload']['role']=='Departamento de testes'
    assert update(client,'contacts',row,name='Edição atrasada').status_code==409
    assert update(client,'contacts',saved,company_id='other').status_code==422
    assert detail(client,'contacts',saved,'other').status_code==404
    found=client.get('/api/companies/fixture/directory/contacts?q=person@fixture.invalid').json()
    assert found['total']==1 and found['items'][0]['version']==2
    assert client.get('/api/companies/fixture/directory/contacts?offset=1').json()['items']==[]
    assert client.get('/api/companies/missing/directory/contacts').status_code==404
    assert client.post('/api/contacts',json=contact(company_id='candidate-pending')).status_code==404


@pytest.mark.parametrize('changes,status',[
    (dict(stage='under_construction'),422),(dict(stage='approved',stage_as_of='2026-11-09'),422),
    (dict(stage='under_construction',stage_as_of='2026-11-07',observed_at='2026-11-06T13:00:00Z'),422),
    (dict(state='TX'),409),(dict(state='XX'),422),(dict(stage='completed'),422),
])
def test_development_requires_evidence_date_and_reviewed_company_state(setup,changes,status):
    client,_=setup
    assert client.post('/api/developments',json=development(**changes)).status_code==status


def test_development_unknown_historical_stage_dedup_and_search(setup):
    client,_=setup
    response=client.post('/api/developments',json=development());assert response.status_code==200,response.text
    row=response.json();assert row['payload']['stage']=='unknown' and not row['payload']['stage_as_of']
    assert client.post('/api/developments',json=development()).json()['id']==row['id']
    assert client.post('/api/developments',json=development(request_id='c'*32,name='RESIDENCIAL FICTÍCIO',city=' CIDADE  FICTÍCIA ')).status_code==409
    saved=update(client,'developments',row,stage='under_construction',stage_as_of='2025-09-23').json()
    assert saved['version']==2 and saved['history'][1]['payload']['stage']=='unknown'
    assert client.get('/api/companies/fixture/directory/developments?q=Cidade').json()['total']==1
    assert client.get('/api/companies/other/directory/developments').json()['total']==0
    assert update(client,'developments',saved,origin_candidate_id='new').status_code==422


def test_origin_requires_approved_candidate_from_same_company(setup):
    client,app=setup
    job=client.post('/api/jobs',json=dict(state='FL',target_count=1)).json()
    company=dict(name='Fornecedor de teste',website='https://source-fixture.com',company_type='developer',size_tier='unknown',states_active=['FL'],projects=[dict(name='Projeto de teste',city='Miami',state='FL',building_type='apartments',stage='unknown',source_url='https://source-fixture.com/property',source_title='Ficha',observed_at=NOW.isoformat(),confidence=.8)],contacts=[],evidence=[dict(claim='Incorporação residencial',source_url='https://source-fixture.com/about',source_title='Institucional',observed_at=NOW.isoformat(),confidence=.8)])
    result=dict(job_id=job['id'],market='US',state='FL',target_count=1,generated_at=NOW.isoformat(),companies=[company],warnings=[])
    candidate=client.post('/api/jobs/'+job['id']+'/import',json=dict(result=result)).json()['candidates'][0]
    assert client.post('/api/contacts',json=contact(origin_candidate_id=candidate['id'])).status_code==409
    approved=client.post('/api/jobs/'+job['id']+'/candidates/'+candidate['id']+'/review',json=dict(confirm=True,decision='approved',sources_confirmed=True,content_hash=candidate['content_hash'])).json()['candidates'][0]
    assert client.post('/api/contacts',json=contact(origin_candidate_id=candidate['id'])).status_code==409
    row=client.post('/api/contacts',json=contact(company_id=approved['company_id'],origin_candidate_id=candidate['id']))
    assert row.status_code==200,row.text
    assert row.json()['origin_candidate_id']==candidate['id']
    with app.state.engine.connect() as c:assert c.execute(text('SELECT status FROM job_candidates WHERE id=:id'),dict(id=candidate['id'])).scalar()=='approved'


def test_directory_api_uses_session_origin_and_kind_allowlist(setup):
    client,_=setup
    url='/api/companies/fixture/directory/contacts'
    assert client.get(url,headers={'X-CRM-Token':'wrong'}).status_code==401
    assert client.get(url,headers={'Origin':'https://example.com'}).status_code==403
    assert client.get('/api/companies/fixture/directory/companies').status_code==422


def test_directory_accepts_valid_multibyte_fields_within_schema_limits(setup):
    client,_=setup
    body=contact(name='名'*240,role='名'*1000,notes='名'*2000,source_title='名'*240,source_url='https://source-fixture.com/'+'a'*1900,channel_url='https://source-fixture.com/'+'b'*1900)
    result=client.post('/api/contacts',json=body)
    assert result.status_code==200,result.text
    assert result.json()['payload']['name']=='名'*240
    assert client.get('/api/companies/fixture').json()['states']==['FL']

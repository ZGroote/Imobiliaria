from datetime import datetime, timezone

import pytest
from pydantic import ValidationError
from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.app.main import create_app
from backend.app.research_contract import ResearchResult, public_url

NOW = datetime(2026,11,8,12,tzinfo=timezone.utc)


def company(website='https://builder-company.com',states=None):
    source = dict(source_url=website+'/projects',source_title='Residential portfolio',observed_at=NOW.isoformat(),confidence=.8)
    return dict(name='Contract test company',website=website,company_type='developer',size_tier='small_medium',
        states_active=states or ['FL'],projects=[dict(source,name='Project data for unit test',city='Miami',state='FL',
        building_type='apartments',stage='under_review',stage_as_of=None)],contacts=[],
        evidence=[dict(source,claim='The company develops apartment buildings.',document_date=None)],status='unverified')


def result(job_id='a'*32,**changes):
    return dict(dict(job_id=job_id,market='US',state='FL',target_count=50,generated_at=NOW.isoformat(),companies=[company()],warnings=[]),**changes)


@pytest.mark.parametrize('url',['http://builder-company.com','https://localhost/a','https://127.0.0.1','https://[::1]',
    'https://example.com','https://x.example.org/a','https://file.local/a','https://user:pass@builder-company.com',
    'https://builder-company.com:8765','file:///C:/Windows/a','https://builder-company.com\\@127.0.0.1',
    'https://2130706433','https://127.1','https://builder-company.com/line\nfeed'])
def test_research_urls_are_public_https_without_secrets(url):
    with pytest.raises(ValueError):public_url(url)


def test_result_requires_sources_and_stays_unverified():
    value=ResearchResult.model_validate(result())
    assert value.companies[0].status=='unverified'
    for change in [dict(evidence=[]),dict(status='verified'),dict(auto_send_allowed=True),dict(website='https://example.com')]:
        with pytest.raises(ValidationError):ResearchResult.model_validate(result(companies=[dict(company(),**change)]))
    with pytest.raises(ValidationError):ResearchResult.model_validate(result(companies=[company(),company()]))
    with pytest.raises(ValidationError):ResearchResult.model_validate(result(state='TX'))


@pytest.fixture
def setup(tmp_path):
    class ForbiddenCredentials:
        def get(self,*args):raise AssertionError('Pesquisa não acessa credenciais.')
    def forbidden(*args):raise AssertionError('Pesquisa não usa transporte de e-mail.')
    app=create_app(tmp_path/'cache.sqlite3',credentials=ForbiddenCredentials(),client_factory=forbidden,sender_transport_factory=forbidden)
    app.state.clock=lambda:NOW
    with TestClient(app,base_url='http://127.0.0.1:8765') as client:
        client.headers['X-CRM-Token']=client.get('/api/session').json()['token']
        yield client,app


def job(client,**changes):
    response=client.post('/api/jobs',json=dict(dict(state='FL',target_count=50),**changes))
    assert response.status_code==200,response.text
    return response.json()


def import_data(client,j,**changes):
    return client.post('/api/jobs/'+j['id']+'/import',json={'result':result(j['id'],state=j['state'],target_count=j['target_count'],**changes)})


def decision(client,j,candidate,**changes):
    return client.post('/api/jobs/'+j['id']+'/candidates/'+candidate['id']+'/review',
        json=dict(dict(confirm=True,content_hash=candidate['content_hash'],decision='approved',sources_confirmed=True),**changes))


def test_job_exports_only_explicit_parameters_and_contract(setup):
    client,app=setup
    j=job(client)
    assert j['status']=='draft' and not j['candidates'] and not j['executor_enabled'] and not j['send_enabled']
    exported=client.get('/api/jobs/'+j['id']+'/export').json()
    assert exported['input_hash']==j['input_hash'] and exported['schema']==client.get('/api/jobs/schema').json()
    assert j['id'] in exported['prompt'] and 'FL' in exported['prompt'] and 'research_unavailable' in exported['prompt']
    assert client.get('/api/jobs').json()['total']==1
    assert len(client.get('/api/jobs/options').json()['states'])==50
    for changes in (dict(state='XX'),dict(target_count=51),dict(target_count='50'),dict(agent='shell'),dict(command='dir')):
        assert client.post('/api/jobs',json=dict(dict(state='FL'),**changes)).status_code==422
    with app.state.engine.connect() as c:
        assert c.execute(text('SELECT count(*) FROM messages')).scalar_one()==0


def test_import_is_review_only_atomic_and_idempotent(setup):
    client,app=setup
    j=job(client)
    first=import_data(client,j)
    assert first.status_code==200,first.text
    imported=first.json()
    assert imported['status']=='reviewing' and imported['counts']==dict(pending=1,approved=0,rejected=0)
    assert imported['warnings'] and client.get('/api/companies').json()['total']==0
    again=import_data(client,j)
    assert again.json()['candidates'][0]['id']==imported['candidates'][0]['id']
    assert len(again.json()['events'])==2
    assert import_data(client,j,companies=[]).status_code==409
    assert import_data(client,j,companies=[dict(company(),evidence=[])]).status_code==422
    assert client.get('/api/jobs/'+j['id']).json()['counts']['pending']==1
    with app.state.engine.connect() as c:
        assert c.execute(text('SELECT count(*) FROM outbound_drafts')).scalar_one()==0


def test_import_bindings_dates_and_oversize_rejected(setup):
    client,_=setup
    j=job(client)
    data=result(j['id'])
    for changes in [dict(job_id='b'*32),dict(state='TX'),dict(target_count=49)]:
        response=client.post('/api/jobs/'+j['id']+'/import',json={'result':dict(data,**changes)})
        assert response.status_code in (409,422)
    assert import_data(client,j,generated_at='2027-01-01T00:00:00Z').status_code==422
    future=company();future['projects'][0]['observed_at']='2027-01-01T00:00:00Z'
    assert import_data(client,j,companies=[future]).status_code==422
    assert client.post('/api/jobs/'+j['id']+'/import',content='x'*262145,headers={'content-type':'application/json'}).status_code==413
    assert not client.get('/api/jobs/'+j['id']).json()['candidates']


def test_partial_review_requires_explicit_sources_and_hash(setup):
    client,_=setup
    j=job(client)
    candidates=import_data(client,j,companies=[company(),company('https://another-builder.com')]).json()['candidates']
    a,b=candidates
    for change in [dict(confirm=False),dict(content_hash='0'*64),dict(sources_confirmed=False)]:
        assert decision(client,j,a,**change).status_code in (409,422)
    accepted=decision(client,j,a).json()
    assert accepted['status']=='reviewing' and accepted['counts']['approved']==1
    assert client.get('/api/companies').json()['total']==1
    assert decision(client,j,a).status_code==200
    assert decision(client,j,a,decision='rejected').status_code==409
    done=decision(client,j,b,decision='rejected',note='Fonte insuficiente').json()
    assert done['status']=='partial' and done['counts']==dict(pending=0,approved=1,rejected=1)
    assert done['candidates'][1]['review_note']=='Fonte insuficiente'


@pytest.mark.parametrize('changes',[dict(projects=[]),dict(company_type='general_contractor'),dict(projects=[dict(company()['projects'][0],building_type='single_family')])])
def test_ineligible_company_remains_candidate_cannot_be_approved(setup,changes):
    client,_=setup
    j=job(client)
    candidate=import_data(client,j,companies=[dict(company(),**changes)]).json()['candidates'][0]
    assert candidate['review_errors'] and decision(client,j,candidate).status_code==409
    assert decision(client,j,candidate,decision='rejected').status_code==200
    assert client.get('/api/companies').json()['total']==0


def test_multistate_dedup_requires_identity_confirmation_and_preserves_sources(setup):
    client,_=setup
    a=job(client)
    ca=import_data(client,a).json()['candidates'][0]
    assert decision(client,a,ca).status_code==200
    b=job(client,state='TX')
    other=company('https://www.builder-company.com',states=['TX','FL'])
    other['projects'][0]['state']='TX'
    cb=import_data(client,b,companies=[other]).json()['candidates'][0]
    assert cb['existing_company'] and decision(client,b,cb).status_code==409
    assert decision(client,b,cb,merge_confirmed=True).status_code==200
    listing=client.get('/api/companies?state=TX&q=builder').json()
    assert listing['total']==1 and listing['items'][0]['states']==['FL','TX']
    assert client.get('/api/companies?state=CA').json()['total']==0
    detail=client.get('/api/companies/'+listing['items'][0]['id']).json()
    assert len(detail['sources'])==2 and detail['verification']=='operator_reviewed' and not detail['send_enabled']
    assert {s['job_id'] for s in detail['sources']}=={a['id'],b['id']}


def test_cancel_preserves_history_and_blocks_import_or_decision(setup):
    client,_=setup
    j=job(client)
    candidate=import_data(client,j).json()['candidates'][0]
    url='/api/jobs/'+j['id']+'/cancel'
    assert client.post(url,json={'confirm':False}).status_code==422
    assert client.post(url,json={'confirm':True}).json()['status']=='cancelled'
    assert decision(client,j,candidate).status_code==409
    assert import_data(client,j).status_code==409
    assert len(client.post(url,json={'confirm':True}).json()['events'])==3


def test_zero_results_and_full_target_are_truthful(setup):
    client,_=setup
    j=job(client)
    empty=import_data(client,j,companies=[],warnings=['research_unavailable']).json()
    assert empty['status']=='partial' and empty['warnings'][0]=='research_unavailable' and not empty['candidates']
    small=job(client,target_count=1)
    candidate=import_data(client,small).json()['candidates'][0]
    assert decision(client,small,candidate).json()['status']=='imported'


def test_job_candidate_binding_and_pagination(setup):
    client,_=setup
    a,b=job(client),job(client)
    candidate=import_data(client,a).json()['candidates'][0]
    assert decision(client,b,candidate).status_code==404
    assert client.get('/api/jobs?limit=1&offset=1').json()['total']==2
    assert len(client.get('/api/jobs?limit=1&offset=1').json()['items'])==1
    assert client.get('/api/companies?state=XX').status_code==422

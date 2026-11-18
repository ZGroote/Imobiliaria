from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
from xml.etree import ElementTree as E
from zipfile import ZipFile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.app.main import create_app

NOW=datetime(2026,11,8,13,tzinfo=timezone.utc)


@pytest.fixture
def setup(tmp_path):
    class Credentials:
        def get(self,*args):raise AssertionError('Propostas não acessam credenciais.')
    def forbidden(*args):raise AssertionError('Propostas não acessam transporte de e-mail.')
    app=create_app(tmp_path/'cache.sqlite3',credentials=Credentials(),client_factory=forbidden,sender_transport_factory=forbidden)
    app.state.clock=lambda:NOW
    with TestClient(app,base_url='http://127.0.0.1:8765') as client:
        client.headers['X-CRM-Token']=client.get('/api/session').json()['token']
        with app.state.engine.begin() as c:
            c.execute(text("INSERT INTO companies VALUES('fixture','Empresa de teste','fixture.invalid','https://fixture.invalid',:d)"),dict(d=NOW.isoformat()))
        yield client,app


def opportunity(client,request_id='a'*32,**changes):
    result=client.post('/api/opportunities',json=dict(dict(confirm=True,request_id=request_id,company_id='fixture',
        title='Oportunidade fictícia',stage='qualification',amount_minor=150000,currency='USD',next_step='Revisar briefing',due_on='2026-11-07'),**changes))
    assert result.status_code==200,result.text
    return result.json()


def test_insights_empty_data_has_no_invented_conversion_or_revenue(setup):
    client,_=setup
    data=client.get('/api/insights').json()
    assert data['companies']==1 and data['opportunities']==0 and data['won_share'] is None
    assert data['unpriced_opportunities']==0 and not data['send_enabled']
    assert not data['next_actions'] and all(value==0 for value in data['stages'].values())


def test_insights_separates_currencies_and_closed_estimates(setup):
    client,_=setup
    opportunity(client)
    opportunity(client,'b'*32,stage='won',amount_minor=300000,currency='BRL')
    opportunity(client,'c'*32,stage='lost',amount_minor=100000,currency='USD')
    opportunity(client,'d'*32,amount_minor=None,currency=None)
    data=client.get('/api/insights').json()
    assert data['opportunities']==4 and data['open_opportunities']==2 and data['overdue_actions']==2
    assert data['estimates_by_currency']['USD']['open']==150000
    assert data['estimates_by_currency']['USD']['lost']==100000
    assert data['estimates_by_currency']['BRL']['won']==300000
    assert data['closed_count']==2 and data['won_share']==50 and data['unpriced_opportunities']==1
    assert len(data['next_actions'])==2


def proposal_data(opp,**changes):
    return dict(dict(request_id='p'.replace('p','e')*32,opportunity_id=opp['id'],opportunity_version=opp['version'],profile_id='BR',
        project_name='Projeto fictício para teste',contact_name='Equipe de demonstração',sender_name='Responsável de teste',
        scope='Representação dos ambientes definidos no briefing fictício.',deliverables='Modelo interativo para conferência no navegador.',
        materials='Plantas e referências aprovadas pelo cliente.',timeline='Cronograma a confirmar após o recebimento dos materiais.',
        revisions='Uma rodada de revisão do escopo descrito.',support='Suporte conforme condições informadas nesta proposta.',
        payment_terms='Condição fictícia usada somente em testes.',exclusions='',amount_minor=150000,currency='USD',valid_until='2026-12-01'),**changes)


def prepare(client,opp,**changes):
    response=client.post('/api/proposals',json=proposal_data(opp,**changes))
    assert response.status_code==200,response.text
    return response.json()


def approve(client,p,**changes):
    return client.post('/api/proposals/'+p['id']+'/approve',json=dict(dict(confirm=True,conditions_confirmed=True,version=p['version'],content_hash=p['content_hash']),**changes))


def revise(client,p,**changes):
    body=dict(p['payload'],opportunity_version=p['current_opportunity']['opportunity_version'],version=p['version'],**changes)
    return client.put('/api/proposals/'+p['id'],json=body)


def test_proposal_draft_review_exact_version_and_no_effect_on_opportunity(setup):
    client,app=setup
    opp=opportunity(client)
    p=prepare(client,opp)
    assert not p['review_errors'] and p['status']=='draft' and not p['approval_current']
    assert prepare(client,opp)['id']==p['id']
    assert len(prepare(client,opp)['versions'])==1
    assert client.get('/api/proposals/'+p['id']+'/docx?reviewed=true').status_code==409
    for change in [dict(confirm=False),dict(conditions_confirmed=False),dict(content_hash='0'*64),dict(version=2)]:
        assert approve(client,p,**change).status_code in (409,422)
    reviewed=approve(client,p)
    assert reviewed.status_code==200,reviewed.text
    assert reviewed.json()['approval_current'] and not reviewed.json()['client_accepted']
    assert client.get('/api/opportunities/'+opp['id']).json()['stage']=='qualification'
    assert client.get('/api/insights').json()['current_approved_proposals']==1
    assert approve(client,p).status_code==200
    with app.state.engine.connect() as c:
        assert c.execute(text("SELECT count(*) FROM commercial_events WHERE action='proposal_approved'")).scalar_one()==1
        assert c.execute(text('SELECT count(*) FROM outbound_drafts')).scalar_one()==0


@pytest.mark.parametrize('changes',[dict(scope=''),dict(amount_minor=None,currency=None),dict(valid_until=None),
    dict(valid_until='2026-01-01'),dict(contact_name='{{contact_name}}'),dict(timeline='[prazo]')])
def test_incomplete_drafts_save_but_cannot_be_approved(setup,changes):
    client,_=setup
    p=prepare(client,opportunity(client),**changes)
    assert p['review_errors'] and approve(client,p).status_code==409
    assert client.get('/api/proposals/'+p['id']+'/docx').status_code==200


@pytest.mark.parametrize('changes',[dict(profile_id='XX'),dict(amount_minor=-1),dict(amount_minor=1.2),dict(currency=None),
    dict(scope='bad\x00xml'),dict(signed=True),dict(client_accepted=True),dict(status='approved')])
def test_invalid_or_self_approved_payload_is_rejected(setup,changes):
    client,_=setup
    opp=opportunity(client)
    assert client.post('/api/proposals',json=proposal_data(opp,**changes)).status_code==422


def test_edit_keeps_old_snapshot_revokes_approval_and_prevents_stale_overwrite(setup):
    client,_=setup
    opp=opportunity(client)
    old=approve(client,prepare(client,opp)).json()
    response=revise(client,old,scope='Escopo alterado para revisão.')
    assert response.status_code==200,response.text
    new=response.json()
    assert new['version']==2 and new['status']=='draft' and not new['approval_current']
    assert len(new['versions'])==2 and new['approved_hash'] is None
    historical=client.get('/api/proposals/'+new['id']+'?version=1').json()
    assert historical['payload']==old['payload'] and historical['content_hash']==old['content_hash']
    assert revise(client,old).status_code==409
    assert approve(client,old).status_code==409
    assert client.get('/api/proposals/'+new['id']+'/docx?version=1&reviewed=true').status_code==409


def test_opportunity_change_invalidates_review_until_explicit_new_revision(setup):
    client,_=setup
    opp=opportunity(client)
    p=approve(client,prepare(client,opp)).json()
    body={key:opp[key] for key in ('title','stage','amount_minor','currency','next_step','due_on','notes','version')}
    assert client.put('/api/opportunities/'+opp['id'],json=dict(body,confirm=True,stage='proposal')).status_code==200
    stale=client.get('/api/proposals/'+p['id']).json()
    assert stale['review_errors'] and not stale['approval_current']
    assert client.get('/api/insights').json()['current_approved_proposals']==0
    assert client.get('/api/proposals/'+p['id']+'/docx?reviewed=true').status_code==409
    new=revise(client,stale).json()
    assert new['version']==2 and not new['review_errors']
    assert approve(client,new).json()['approval_current']


def test_docx_preserves_reference_parts_geometry_and_escapes_user_content(setup):
    client,_=setup
    p=prepare(client,opportunity(client),scope='<w:hyperlink>texto de teste & símbolos</w:hyperlink>')
    draft=client.get('/api/proposals/'+p['id']+'/docx')
    assert draft.status_code==200,draft.text[:100] if draft.status_code!=200 else ''
    reference=next(Path('branding/assets/original').glob('Papel*.docx'))
    original_hash=hashlib.sha256(reference.read_bytes()).hexdigest()
    ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    with ZipFile(reference) as before,ZipFile(io.BytesIO(draft.content)) as after:
        assert before.namelist()==after.namelist()
        for name in before.namelist():
            if name not in ('word/document.xml','word/footer1.xml'):assert before.read(name)==after.read(name),name
        a=E.fromstring(before.read('word/document.xml'));b=E.fromstring(after.read('word/document.xml'))
        assert E.tostring(a.find('.//w:sectPr',ns))==E.tostring(b.find('.//w:sectPr',ns))
        text=' '.join(node.text or '' for node in b.findall('.//w:t',ns))
        assert '<w:hyperlink>texto de teste & símbolos</w:hyperlink>' in text
        assert not b.findall('.//w:hyperlink',ns)
        assert 'RASCUNHO PARA REVISÃO' in after.read('word/footer1.xml').decode()
    assert hashlib.sha256(reference.read_bytes()).hexdigest()==original_hash
    approved=approve(client,p).json()
    exported=client.get('/api/proposals/'+p['id']+'/docx?reviewed=true')
    assert exported.status_code==200
    with ZipFile(io.BytesIO(exported.content)) as z:
        assert 'Revisada internamente' in z.read('word/footer1.xml').decode()
        assert 'Não registra aceite do cliente' in z.read('word/footer1.xml').decode()


def test_us_export_is_explicit_derivative_with_correct_site(setup):
    client,_=setup
    p=prepare(client,opportunity(client),profile_id='US')
    response=client.get('/api/proposals/'+p['id']+'/docx')
    with ZipFile(io.BytesIO(response.content)) as z:
        assert 'Commercial proposal' in z.read('word/document.xml').decode()
        footer=z.read('word/footer1.xml').decode()
        assert 'conectaimoveis3d.com.br' not in footer and 'A NEW PERSPECTIVE.' in footer
        assert 'DRAFT FOR REVIEW' in footer


def test_saved_integrity_cannot_be_bypassed_at_export(setup):
    client,app=setup
    p=approve(client,prepare(client,opportunity(client))).json()
    altered=dict(p['payload'],scope='Changed without saving')
    with app.state.engine.begin() as c:c.execute(text('UPDATE proposal_versions SET payload=:p'),dict(p=json.dumps(altered)))
    assert client.get('/api/proposals/'+p['id']+'/docx?reviewed=true').status_code==409

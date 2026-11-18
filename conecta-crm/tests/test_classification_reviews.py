from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.app.main import create_app
from backend.app.mail import save_message
from backend.app.provider import Mail
from backend.app.outbound import context_hash

NOW=datetime(2026,11,8,13,tzinfo=timezone.utc)


@pytest.fixture
def setup(tmp_path):
    class Credentials:
        def get(self,*args):raise AssertionError('Revisão não acessa credenciais.')
    def forbidden(*args):raise AssertionError('Revisão não acessa correio remoto.')
    app=create_app(tmp_path/'cache.sqlite3',credentials=Credentials(),client_factory=forbidden,sender_transport_factory=forbidden)
    app.state.clock=lambda:NOW
    with TestClient(app,base_url='http://127.0.0.1:8765') as client:
        client.headers['X-CRM-Token']=client.get('/api/session').json()['token']
        yield client,app


def received(app,key='first',account='contact',body='Obrigado por entrar em contato.',**changes):
    mail=Mail(**dict(dict(key=key,uid=1,message_id='<'+key+'>',sender='fixture@company.invalid',recipient=account+'@conectaimoveis3d.com',subject='Conversa fictícia',body=body,received_at=NOW.isoformat()),**changes))
    with app.state.engine.begin() as c:
        mid,_=save_message(c,account,mail)
        tid=c.execute(text('SELECT thread_id FROM messages WHERE id=:id'),dict(id=mid)).scalar_one()
    return tid,mid


def path(tid,mid):return '/api/classifications/'+tid+'/messages/'+mid+'/review'


def review(client,tid,mid,context=None,**changes):
    context=context or client.get(path(tid,mid)).json()
    data=dict(confirm=True,account_id=context['message']['account_id'],message_hash=context['message_hash'],version=context['version'],category='positive_interest',response_kind='human',note='Mensagem fictícia conferida pelo operador.')
    return client.post(path(tid,mid),json=dict(data,**changes))


def test_manual_review_overrides_rule_filter_and_preserves_rule_suggestion(setup):
    client,app=setup;tid,mid=received(app)
    original=client.get(path(tid,mid)).json();assert original['version']==0 and original['rule']['category']=='other'
    response=review(client,tid,mid,original);assert response.status_code==200,response.text
    value=response.json();assert value['version']==1 and value['classification']['source']=='operator'
    assert not value['classification']['review_required'] and value['classification']['confidence'] is None
    assert value['classification']['response_kind']=='human' and value['rule']['category']=='other'
    assert client.get('/api/mail/threads?account_id=contact&category=positive_interest').json()['total']==1
    assert client.get('/api/mail/threads?account_id=contact&category=other').json()['total']==0
    client.post('/api/classifications/rules/run',json=dict(account_id='contact',thread_id=tid))
    assert client.get('/api/classifications/'+tid).json()['category']=='positive_interest'
    assert client.get(path(tid,mid)).json()['version']==1
    assert review(client,tid,mid,original).json()['version']==1
    assert len(client.get(path(tid,mid)).json()['history'])==1


@pytest.mark.parametrize('changes',[
    dict(confirm=False),dict(version=True),dict(version=-1),dict(category='unclassified'),dict(extra=True),
    dict(response_kind='automatic'),dict(category='automatic_reply',response_kind='human'),dict(response_kind='invalid'),
    dict(note='x'*2001),dict(message_hash='invalid'),
])
def test_review_validates_explicit_input_without_creating_history(setup,changes):
    client,app=setup;tid,mid=received(app)
    assert review(client,tid,mid,**changes).status_code==422
    with app.state.engine.connect() as c:assert c.execute(text('SELECT count(*) FROM classification_reviews')).scalar()==0


def test_review_rejects_wrong_message_box_version_and_content(setup):
    client,app=setup;tid,mid=received(app)
    old=client.get(path(tid,mid)).json()
    assert review(client,tid,mid,old,account_id='team').status_code==409
    assert review(client,tid,mid,old,message_hash='0'*64).status_code==409
    assert client.get(path('wrong',mid)).status_code==404
    assert review(client,tid,mid,old).status_code==200
    assert review(client,tid,mid,old,category='pricing_request').status_code==409
    updated=review(client,tid,mid,category='demo_request').json()
    assert updated['version']==2 and len(updated['history'])==2
    with app.state.engine.begin() as c:c.execute(text('UPDATE messages SET body_text=:b WHERE id=:id'),dict(id=mid,b='Conteúdo local diferente.'))
    assert review(client,tid,mid,updated,category='other',response_kind='uncertain').status_code==409


def test_review_cannot_target_outbound_or_own_messages(setup):
    client,app=setup
    for key,changes in [('out',dict(direction='outbound')),('own',dict(sender='Conecta <team@conectaimoveis3d.com>'))]:
        tid,mid=received(app,key,**changes)
        assert client.get(path(tid,mid)).status_code==409


def test_new_reply_needs_own_review_and_automatic_does_not_hide_human(setup):
    client,app=setup;tid,mid=received(app)
    review(client,tid,mid,category='pricing_request')
    _,automatic=received(app,'auto',in_reply_to='<first>',headers={'Auto-Submitted':'auto-replied'},received_at='2026-11-08T14:00:00+00:00')
    review(client,tid,automatic,category='automatic_reply',response_kind='automatic')
    assert client.get('/api/classifications/'+tid).json()['message_id']==mid
    _,new=received(app,'new',in_reply_to='<first>',body='Gostaria de agendar uma demonstração.',received_at='2026-11-08T15:00:00+00:00')
    value=client.get('/api/classifications/'+tid).json()
    assert value['message_id']==new and value['category']=='demo_request' and value['review_required']
    assert client.get(path(tid,mid)).json()['review']['response_kind']=='human'


def test_refusal_review_blocks_globally_and_correction_does_not_unblock(setup):
    client,app=setup;tid,mid=received(app)
    saved=review(client,tid,mid,category='unsubscribe').json()
    assert saved['classification']['blocked']
    assert client.get('/api/suppression').json()['total']==1
    corrected=review(client,tid,mid,category='positive_interest').json()
    assert corrected['classification']['category']=='positive_interest' and corrected['classification']['blocked']
    _,other=received(app,'otherbox',account='team')
    assert client.get('/api/mail/threads?account_id=team').json()['items'][0]['classification']['blocked']
    assert client.get('/api/suppression').json()['total']==1
    with app.state.engine.connect() as c:
        assert c.execute(text('SELECT count(*) FROM outbound_drafts')).scalar()==0
        assert c.execute(text('SELECT count(*) FROM classification_review_history')).scalar()==2


def test_message_review_survives_thread_merge_and_old_context_is_rejected(setup):
    client,app=setup;first,mid=received(app)
    second,other=received(app,'separate')
    review(client,second,other,category='technical_question')
    # Uma resposta com referências às duas mensagens faz a sincronização agrupar as conversas.
    target,_=received(app,'bridge',in_reply_to='<first>',references=('<first>','<separate>'))
    assert client.get(path(target,other)).json()['review']['category']=='technical_question'
    removed=second if target!=second else first
    removed_mid=other if removed==second else mid
    assert client.get(path(removed,removed_mid)).status_code==404


def test_review_local_session_and_cross_origin_are_protected(setup):
    client,app=setup;tid,mid=received(app)
    assert client.get(path(tid,mid),headers={'X-CRM-Token':'wrong'}).status_code==401
    assert client.get(path(tid,mid),headers={'Origin':'https://example.com'}).status_code==403


def test_response_metrics_use_reviewed_messages_exclude_demo_and_never_infer_rate(setup):
    client,app=setup;tid,mid=received(app)
    demo,example=received(app,'demo',account='demo')
    review(client,demo,example)
    initial=client.get('/api/insights').json()
    assert initial['response_review_total']==1 and initial['response_reviews']==dict(human=0,automatic=0,uncertain=0,unreviewed=1)
    review(client,tid,mid)
    auto,aid=received(app,'auto',account='team',headers={'Auto-Submitted':'auto-replied'})
    review(client,auto,aid,category='automatic_reply',response_kind='automatic')
    unsure,uid=received(app,'unsure')
    review(client,unsure,uid,category='other',response_kind='uncertain')
    received(app,'unreviewed')
    data=client.get('/api/insights').json()
    assert data['response_reviews']==dict(human=1,automatic=1,uncertain=1,unreviewed=1)
    assert data['response_review_total']==4 and 'response_rate' not in data
    review(client,tid,mid,category='other',response_kind='uncertain')
    assert client.get('/api/insights').json()['response_reviews']['human']==0


def test_human_review_pauses_followup_and_later_automatic_review_does_not_resume(setup):
    client,app=setup;tid,_=received(app)
    with app.state.engine.begin() as c:
        c.execute(text("""INSERT INTO outbound_drafts(id,account_id,profile_id,recipient,subject,body_text,purpose,
            thread_id,context_hash,metadata,version,status,approved_version,approved_hash,approved_at,created_at,updated_at)
            VALUES('followup','contact','US','fixture@company.invalid','Teste','Rascunho fictício','followup',
            :t,'fixture','{}',1,'scheduled',1,'fixture',:d,:d,:d)"""),dict(t=tid,d=NOW.isoformat()))
        c.execute(text("""INSERT INTO outbound_queue(id,draft_id,version,snapshot_hash,snapshot,recipient,purpose,
            scheduled_at,recipient_timezone,status,created_at) VALUES('queue','followup',1,'fixture','{}',
            'fixture@company.invalid','followup',:d,'America/Sao_Paulo','scheduled',:d)"""),dict(d=NOW.isoformat()))
    _,mid=received(app,'auto',in_reply_to='<first>',headers={'Auto-Submitted':'auto-replied'},received_at='2026-11-08T14:00:00+00:00')
    with app.state.engine.connect() as c:assert c.execute(text("SELECT status FROM outbound_queue WHERE id='queue'")).scalar()=='scheduled'
    assert review(client,tid,mid,category='positive_interest',response_kind='human').status_code==200
    with app.state.engine.connect() as c:
        assert c.execute(text("SELECT status FROM outbound_queue WHERE id='queue'")).scalar()=='cancelled'
        assert c.execute(text("SELECT approved_hash FROM outbound_drafts WHERE id='followup'")).scalar() is None
    assert review(client,tid,mid,category='automatic_reply',response_kind='automatic').status_code==200
    with app.state.engine.connect() as c:assert c.execute(text("SELECT status FROM outbound_queue WHERE id='queue'")).scalar()=='cancelled'


def test_refusal_review_blocks_existing_queue_and_retains_snapshot(setup):
    client,app=setup;tid,mid=received(app)
    with app.state.engine.begin() as c:
        c.execute(text("""INSERT INTO outbound_drafts(id,account_id,profile_id,recipient,subject,body_text,purpose,
            thread_id,context_hash,metadata,version,status,approved_version,approved_hash,approved_at,created_at,updated_at)
            VALUES('outreach','team','US','fixture@company.invalid','Teste','Rascunho fictício','outreach',
            :t,'fixture','{}',1,'scheduled',1,'fixture',:d,:d,:d)"""),dict(t=tid,d=NOW.isoformat()))
        c.execute(text("""INSERT INTO outbound_queue(id,draft_id,version,snapshot_hash,snapshot,recipient,purpose,
            scheduled_at,recipient_timezone,status,created_at) VALUES('queue','outreach',1,'fixture','{}',
            'fixture@company.invalid','outreach',:d,'America/Sao_Paulo','scheduled',:d)"""),dict(d=NOW.isoformat()))
    assert review(client,tid,mid,category='not_interested').status_code==200
    with app.state.engine.connect() as c:
        row=c.execute(text("SELECT status,snapshot FROM outbound_queue WHERE id='queue'")).mappings().one()
        assert row['status']=='blocked' and row['snapshot']=='{}'


def test_followup_context_uses_corrected_automatic_category(setup):
    client,app=setup;tid,mid=received(app,headers={'Auto-Submitted':'auto-replied'})
    with app.state.engine.connect() as c:original=context_hash(c,tid,'followup')
    review(client,tid,mid,category='positive_interest',response_kind='human')
    with app.state.engine.connect() as c:assert context_hash(c,tid,'followup')!=original
    review(client,tid,mid,category='automatic_reply',response_kind='automatic')
    with app.state.engine.connect() as c:assert context_hash(c,tid,'followup')==original

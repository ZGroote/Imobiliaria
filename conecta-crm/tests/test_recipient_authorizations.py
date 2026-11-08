from datetime import timedelta
from uuid import uuid4

import pytest
from sqlalchemy import text

from test_outbound import setup,NOW


def body(**changes):
    return dict(dict(request_id=str(uuid4()),address='PERSON@fixture.invalid',profile_id='US',basis='explicit_opt_in',
        note='Autorização fictícia registrada exclusivamente para teste.',observed_on=NOW.date().isoformat(),
        expires_on=(NOW.date()+timedelta(days=30)).isoformat(),confirm=True,permission_confirmed=True),**changes)


def test_authorization_requires_explicit_confirmation_and_preserves_history(setup):
    client,app,_=setup;data=body();response=client.post('/api/recipient-authorizations',json=data)
    assert response.status_code==200,response.text
    first=response.json();assert first['address']=='person@fixture.invalid' and not first['expired']
    assert first['version']==1 and len(first['history'])==1
    assert client.post('/api/recipient-authorizations',json=data).json()['id']==first['id']
    changed=body();changed.pop('request_id');changed.update(version=1,note='Permissão fictícia atualizada por outro registro.')
    newer=client.put('/api/recipient-authorizations/'+first['id'],json=changed)
    assert newer.status_code==200,newer.text
    assert newer.json()['version']==2 and len(newer.json()['history'])==2
    assert client.put('/api/recipient-authorizations/'+first['id'],json=changed).status_code==409
    with app.state.engine.connect() as c:
        assert c.execute(text('SELECT count(*) FROM real_deliveries')).scalar_one()==0
        assert c.execute(text('SELECT count(*) FROM outbound_drafts')).scalar_one()==0


@pytest.mark.parametrize('change',[dict(permission_confirmed=False),dict(confirm=False),dict(note=''),
    dict(basis='public_research'),dict(address='a@b.invalid,other@x.invalid'),dict(address='Name <a@b.invalid>'),
    dict(observed_on=(NOW.date()+timedelta(days=1)).isoformat()),dict(expires_on=(NOW.date()-timedelta(days=1)).isoformat()),
    dict(expires_on=(NOW.date()+timedelta(days=367)).isoformat()),dict(auto_send=True)])
def test_invalid_proof_or_dates_do_not_create_authorization(setup,change):
    client,app,_=setup
    assert client.post('/api/recipient-authorizations',json=body(**change)).status_code==422
    with app.state.engine.connect() as c:assert c.execute(text('SELECT count(*) FROM recipient_authorizations')).scalar_one()==0


def test_revoke_never_sends_and_renewal_keeps_old_record(setup):
    client,app,state=setup;first=client.post('/api/recipient-authorizations',json=body()).json()
    assert client.post('/api/recipient-authorizations',json=body()).status_code==409
    revoked=client.post('/api/recipient-authorizations/'+first['id']+'/revoke',json=dict(version=1,confirm=True))
    assert revoked.status_code==200 and revoked.json()['status']=='revoked'
    assert client.get('/api/recipient-authorizations?active_only=true').json()['items']==[]
    second=client.post('/api/recipient-authorizations',json=body()).json();assert second['id']!=first['id']
    state['now']=NOW+timedelta(days=31)
    assert all(item['expired'] for item in client.get('/api/recipient-authorizations').json()['items'])
    with app.state.engine.connect() as c:assert c.execute(text('SELECT count(*) FROM real_delivery_events')).scalar_one()==0

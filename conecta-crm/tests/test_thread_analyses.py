import copy
import json
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.app.main import create_app
from backend.app.mail import save_message, rows
from backend.app.provider import Mail


@pytest.fixture
def analysis(tmp_path):
    class NoCredentials:
        def get(self, *args):
            pytest.fail('Análise local não consulta credenciais.')

    def forbidden(*args):
        pytest.fail('Análise local não acessa transporte remoto.')

    app = create_app(tmp_path/'cache.sqlite3', credentials=NoCredentials(), client_factory=forbidden, start_mail_worker=False)
    with TestClient(app, base_url='http://127.0.0.1:8765') as client:
        client.headers['x-crm-token'] = client.get('/api/session').json()['token']
        ids = []
        with app.state.engine.begin() as c:
            for account, key, body in [('contact', 'one', 'Solicitamos uma demonstração. DADO PRIVADO ORIGINAL.'),
                                       ('contact', 'two', 'UNSELECTED-PRIVATE-CONTENT'),
                                       ('team', 'three', 'Outra caixa fictícia.')]:
                mid, _ = save_message(c, account, Mail(key=key, uid=1, message_id='<'+key+'@fixture.invalid>',
                    sender='Pessoa <person@fixture.invalid>', recipient=account+'@conectaimoveis3d.com',
                    subject='Assunto não exportado', body=body, received_at='2026-11-08T12:00:00Z',
                    thread_key='group' if account == 'contact' else 'other'))
                ids.append(mid)
            tid = c.execute(text('SELECT thread_id FROM messages WHERE id=:m'), dict(m=ids[0])).scalar_one()
        yield client, app, tid, ids


def listing(analysis):
    return analysis[0].get('/api/thread-analyses', params={'thread_id': analysis[2], 'account_id': 'contact'})


def preparation(analysis):
    return dict(account_id='contact', thread_id=analysis[2], request_id=str(uuid4()), source_hash=listing(analysis).json()['source_hash'],
                agent='codex_assisted', excerpts=[dict(message_id=analysis[3][0], text='Solicitamos uma demonstração. [DADO OCULTADO]')], excerpts_reviewed=True)


def prepare(analysis):
    response = analysis[0].post('/api/thread-analyses', json=preparation(analysis))
    assert response.status_code == 200
    return response.json()


def result(job):
    evidence = [dict(message='m1', quote='Solicitamos uma demonstração.')]
    return dict(analysis_id=job['id'], input_hash=job['input_hash'], agent=job['agent'], model='Modelo fictício',
                summary=[dict(text='O trecho pede uma demonstração.', evidence=evidence)],
                suggestion=dict(category='demo_request', confidence=0.85, reason='Pedido explícito no trecho.', evidence=evidence),
                warnings=['Trecho editado pelo operador; confira a mensagem original.'], auto_send_allowed=False)


def import_result(analysis, job, value=None):
    return analysis[0].post('/api/thread-analyses/'+job['id']+'/import', json=dict(account_id='contact', result=result(job) if value is None else value))


def test_manual_flow_exports_only_selected_redacted_text_and_never_changes_triage(analysis):
    client, app, _, _ = analysis
    job = prepare(analysis)
    exported = client.get('/api/thread-analyses/'+job['id']+'/export?account_id=contact')
    assert exported.status_code == 200
    serialized = exported.text
    for secret in ('DADO PRIVADO ORIGINAL', 'UNSELECTED-PRIVATE-CONTENT', 'person@fixture.invalid', 'Assunto não exportado'):
        assert secret not in serialized
    assert analysis[3][0] not in serialized and analysis[2] not in serialized
    assert job['input']['messages'] == [{'id': 'm1', 'direction': 'inbound', 'text': 'Solicitamos uma demonstração. [DADO OCULTADO]'}]
    before = client.get('/api/mail/threads?account_id=contact').json()
    imported = import_result(analysis, job)
    assert imported.status_code == 200 and imported.json()['status'] == 'imported'
    assert imported.json()['result']['suggestion']['category'] == 'demo_request'
    assert client.get('/api/mail/threads?account_id=contact').json() == before
    with app.state.engine.connect() as c:
        assert c.execute(text('SELECT count(*) FROM classification_reviews')).scalar_one() == 0
        assert c.execute(text('SELECT count(*) FROM outbound_drafts')).scalar_one() == 0
        assert c.execute(text('SELECT count(*) FROM analysis_events')).scalar_one() == 3
        assert c.execute(text('SELECT count(*) FROM messages WHERE is_read=1')).scalar_one() == 0


def test_prepare_and_import_are_idempotent_and_other_payload_is_not_overwritten(analysis):
    client, app, _, _ = analysis
    body = preparation(analysis)
    first = client.post('/api/thread-analyses', json=body).json()
    assert client.post('/api/thread-analyses', json=body).json()['id'] == first['id']
    changed = copy.deepcopy(body); changed['excerpts'][0]['text'] = 'Outro trecho.'
    assert client.post('/api/thread-analyses', json=changed).status_code == 409
    assert import_result(analysis, first).status_code == 200
    assert import_result(analysis, first).status_code == 200
    different = result(first); different['model'] = 'Outro modelo declarado'
    assert import_result(analysis, first, different).status_code == 409
    with app.state.engine.connect() as c:
        assert c.execute(text('SELECT count(*) FROM thread_analyses')).scalar_one() == 1
        assert c.execute(text('SELECT count(*) FROM analysis_events')).scalar_one() == 2


@pytest.mark.parametrize('field,value', [('excerpts_reviewed', False), ('agent', 'shell'), ('excerpts', []),
                                      ('source_hash', 'bad'), ('command', 'secret-test')])
def test_invalid_preparation(analysis, field, value):
    body = preparation(analysis); body[field] = value
    response = analysis[0].post('/api/thread-analyses', json=body)
    assert response.status_code == 422 and 'secret-test' not in response.text


def test_message_selection_boundaries_and_limits(analysis):
    client = analysis[0]
    body = preparation(analysis)
    body['excerpts'][0]['message_id'] = analysis[3][2]
    assert client.post('/api/thread-analyses', json=body).status_code == 409
    body = preparation(analysis); body['excerpts'] *= 2
    assert client.post('/api/thread-analyses', json=body).status_code == 422
    body = preparation(analysis); body['excerpts'][0]['text'] = 'x'*4001
    assert client.post('/api/thread-analyses', json=body).status_code == 422
    body = preparation(analysis); body['excerpts'] *= 6
    assert client.post('/api/thread-analyses', json=body).status_code == 422


@pytest.mark.parametrize('field,value,status', [('analysis_id', str(uuid4()), 409), ('input_hash', '0'*64, 409),
    ('agent', 'claude_assisted', 409), ('auto_send_allowed', True, 422), ('model', '', 422), ('extra', 'private-test', 422)])
def test_import_is_bound_to_package_and_strict_contract(analysis, field, value, status):
    job = prepare(analysis); data = result(job); data[field] = value
    response = import_result(analysis, job, data)
    assert response.status_code == status and 'private-test' not in response.text


@pytest.mark.parametrize('target', ['summary', 'suggestion'])
def test_evidence_must_quote_the_selected_redacted_excerpt(analysis, target):
    job = prepare(analysis)
    for changes in ({'message': 'm2'}, {'quote': 'DADO PRIVADO ORIGINAL'}, {'quote': 'Texto inventado'}):
        data = result(job)
        node = data['summary'][0] if target == 'summary' else data['suggestion']
        node['evidence'][0].update(changes)
        assert import_result(analysis, job, data).status_code == 422


@pytest.mark.parametrize('confidence', [-0.1, 1.1, '0.8', True])
def test_invalid_confidence(analysis, confidence):
    job = prepare(analysis); data = result(job); data['suggestion']['confidence'] = confidence
    assert import_result(analysis, job, data).status_code == 422


def test_source_change_prevents_prepare_export_and_first_import(analysis):
    client, app, tid, ids = analysis
    body = preparation(analysis)
    job = prepare(analysis)
    with app.state.engine.begin() as c:
        c.execute(text('UPDATE messages SET body_text=:b WHERE id=:m'), dict(b='Conteúdo alterado.', m=ids[1]))
    assert client.post('/api/thread-analyses', json=body).status_code == 409
    assert client.get('/api/thread-analyses/'+job['id']+'/export?account_id=contact').status_code == 409
    assert import_result(analysis, job).status_code == 409
    assert listing(analysis).json()['items'][0]['stale']


def test_new_message_marks_imported_suggestion_outdated_but_preserves_it(analysis):
    client, app, tid, _ = analysis
    job = prepare(analysis)
    assert import_result(analysis, job).status_code == 200
    with app.state.engine.begin() as c:
        save_message(c, 'contact', Mail(key='new', uid=2, message_id='<new@fixture.invalid>', sender='p@fixture.invalid',
            recipient='contact@conectaimoveis3d.com', subject='Nova', body='Nova resposta recebida.', received_at='2026-11-09T12:00:00Z', thread_key='group'))
    old = client.get('/api/thread-analyses/'+job['id']+'?account_id=contact').json()
    assert old['stale'] and old['result'] == result(job)
    assert import_result(analysis, job).status_code == 200  # reimportação idêntica, sem efeito
    assert prepare(analysis)['input_hash'] != job['input_hash']


def test_local_read_and_rule_classification_do_not_stale_analysis(analysis):
    client, _, tid, _ = analysis
    job = prepare(analysis)
    assert client.post('/api/mail/threads/'+tid+'/read', json={}).status_code == 200
    assert client.post('/api/classifications/rules/run', json={'account_id': 'contact'}).status_code == 200
    assert import_result(analysis, job).status_code == 200


def test_grouping_preserves_analysis_and_evidence_bindings(analysis):
    client, app, tid, ids = analysis
    job = prepare(analysis)
    other = 'f'*32
    with app.state.engine.begin() as c:
        c.execute(text('INSERT INTO threads VALUES(:id,:a,:s,:d)'), dict(id=other, a='contact', s='Agrupada', d='2026-11-08T12:00:00Z'))
        c.execute(text('UPDATE messages SET thread_id=:new WHERE thread_id=:old'), dict(new=other, old=tid))
        c.execute(text('DELETE FROM threads WHERE id=:id'), dict(id=tid))
    view = client.get('/api/thread-analyses/'+job['id']+'?account_id=contact').json()
    assert view['current_thread_id'] == other and not view['stale']
    assert view['bindings'][0]['message_id'] == ids[0]
    assert client.get('/api/thread-analyses', params={'account_id': 'contact', 'thread_id': other}).json()['total'] == 1


def test_account_auth_and_body_limits(analysis):
    client = analysis[0]; job = prepare(analysis)
    base = '/api/thread-analyses/'+job['id']
    assert client.get(base+'?account_id=team').status_code == 404
    assert client.get(base+'/export?account_id=team').status_code == 404
    assert client.post(base+'/import', json={'account_id': 'team', 'result': result(job)}).status_code == 404
    assert client.get(base+'?account_id=contact', headers={'X-CRM-Token': ''}).status_code == 401
    assert client.get(base+'?account_id=contact', headers={'Origin': 'https://evil.invalid'}).status_code == 403
    assert client.post('/api/thread-analyses', content='x'*131073, headers={'Content-Type': 'application/json'}).status_code == 413


def test_persistence_and_event_log_omit_excerpts(analysis):
    client, app, _, _ = analysis
    job = prepare(analysis)
    assert import_result(analysis, job).status_code == 200
    with app.state.engine.connect() as c:
        events = rows(c, 'SELECT * FROM analysis_events')
        assert 'Solicitamos' not in json.dumps(events)
    assert client.get('/api/thread-analyses/'+job['id']+'?account_id=contact').json()['result'] == result(job)


def test_invalid_unicode_is_a_validation_error_without_input_echo(analysis):
    body = preparation(analysis); body['excerpts'][0]['text'] = 'segredo\ud800'
    response = analysis[0].post('/api/thread-analyses', content=json.dumps(body), headers={'Content-Type': 'application/json'})
    assert response.status_code == 422 and 'segredo' not in response.text

import copy

import pytest
from sqlalchemy import text

from test_directory import setup, contact, development, update
from test_research_jobs import job, import_data, decision


def detail(client, company='fixture'):
    response = client.get('/api/qualifications/companies/'+company)
    assert response.status_code == 200, response.text
    return response.json()


def source(client, company='fixture', request_id='a'*32):
    response = client.post('/api/contacts', json=contact(company_id=company, request_id=request_id))
    assert response.status_code == 200, response.text
    return response.json()


def body(client, company='fixture', complete=True):
    current = detail(client, company)
    refs = [current['sources'][0]['id']] if current['sources'] else []
    criteria = {key: dict(points=weight if complete else None,
                         reason='Conferência fictícia da fonte.' if complete else '', source_ids=refs if complete else [])
                for key, weight in current['policy']['weights'].items()}
    return dict(version=current['assessment']['version'], policy_version=current['policy']['version'],
                basis_hash=current['basis_hash'], criteria=criteria, note='', sources_confirmed=True)


def save(client, data, company='fixture'):
    return client.put('/api/qualifications/companies/'+company, json=data)


def test_empty_company_is_unknown_and_not_implicitly_zero(setup):
    client, app = setup
    value = detail(client)
    assert value['status'] == 'not_assessed' and value['score'] is None
    assert value['pending_factors'] == 5 and value['sources'] == []
    assert sum(value['policy']['weights'].values()) == 100
    assert not value['contact_authorized'] and not value['send_enabled']
    assert save(client, body(client)).status_code == 422  # notas sem fonte
    with app.state.engine.connect() as c:
        assert c.execute(text('SELECT count(*) FROM company_qualifications')).scalar_one() == 0


def test_partial_assessment_and_zero_are_distinct(setup):
    client, _ = setup
    source(client)
    data = body(client, complete=False)
    data['criteria']['relevance'] = dict(points=0, reason='Fonte conferida; zero atribuído pelo operador.', source_ids=[detail(client)['sources'][0]['id']])
    saved = save(client, data)
    assert saved.status_code == 200, saved.text
    value = saved.json()
    assert value['status'] == 'incomplete' and value['score'] is None
    assert value['known_points'] == 0 and value['assessed_capacity'] == 25
    assert value['pending_factors'] == 4 and not value['eligible']
    unknown = body(client, complete=False); unknown['note'] = 'Aguardando novas fontes.'
    value = save(client, unknown).json()
    assert value['assessed_capacity'] == 0 and value['score'] is None


def test_complete_score_is_manual_auditable_and_local(setup):
    client, app = setup
    source(client)
    data = body(client)
    value = save(client, data).json()
    assert value['score'] == 100 and value['eligible'] and value['status'] == 'complete'
    assert value['assessment']['version'] == 1 and len(value['history']) == 1
    assert value['assessment']['source_snapshot'][0]['url'] == 'https://source-fixture.com/contact'
    assert value['assessment']['weights'] == {k: v['points'] for k, v in data['criteria'].items()}
    same = body(client)
    assert save(client, same).json()['assessment']['version'] == 1
    changed = copy.deepcopy(same); changed['criteria']['relevance']['points'] = 20
    newer = save(client, changed).json()
    assert newer['score'] == 95 and newer['assessment']['version'] == 2
    assert newer['history'][1]['payload']['criteria']['relevance']['points'] == 25
    assert save(client, same).status_code == 409
    with app.state.engine.connect() as c:
        assert c.execute(text('SELECT count(*) FROM outbound_drafts')).scalar_one() == 0
        assert c.execute(text('SELECT count(*) FROM opportunities')).scalar_one() == 0
        assert c.execute(text('SELECT count(*) FROM suppression_list')).scalar_one() == 0


@pytest.mark.parametrize('changes', [dict(points=True), dict(points=1.5), dict(points=-1), dict(points=26),
                                   dict(reason=''), dict(source_ids=[]), dict(source_ids=['unknown'])])
def test_invalid_factor_rejected_without_mutation(setup, changes):
    client, app = setup
    source(client)
    data = body(client); data['criteria']['relevance'].update(changes)
    assert save(client, data).status_code == 422
    with app.state.engine.connect() as c:
        assert c.execute(text('SELECT count(*) FROM qualification_history')).scalar_one() == 0


def test_foreign_sources_duplicates_missing_confirmation_and_extra_fields(setup):
    client, _ = setup
    source(client); source(client, 'other', 'b'*32)
    data = body(client)
    data['criteria']['relevance']['source_ids'] = [detail(client, 'other')['sources'][0]['id']]
    assert save(client, data).status_code == 422
    data = body(client); data['criteria']['relevance']['source_ids'] *= 2
    assert save(client, data).status_code == 422
    data = body(client); data['sources_confirmed'] = False
    assert save(client, data).status_code == 422
    data = body(client); data['contact_authorized'] = True
    assert save(client, data).status_code == 422
    assert client.get('/api/qualifications/companies/pending-candidate').status_code == 404


def test_policy_version_changes_require_reassessment_without_recalculating_history(setup):
    client, _ = setup
    source(client)
    first = save(client, body(client)).json()
    old = body(client)
    policy = client.get('/api/qualifications/policy').json()
    changed = dict(policy['weights'], relevance=30, recurrence=15)
    result = client.put('/api/qualifications/policy', json=dict(version=policy['version'], weights=changed, note='Revisão fictícia das prioridades.'))
    assert result.status_code == 200, result.text
    assert result.json()['version'] == 2 and len(result.json()['history']) == 2
    stale = detail(client)
    assert stale['status'] == 'needs_review' and stale['score'] == 100 and not stale['eligible']
    assert stale['assessment']['weights']['recurrence'] == 20
    assert save(client, old).status_code == 409
    fresh = body(client); fresh['criteria']['recurrence']['points'] = 15
    value = save(client, fresh).json()
    assert value['eligible'] and value['assessment']['policy_version'] == 2
    assert value['history'][1]['payload']['policy_version'] == 1
    assert first['assessment']['source_snapshot'] == value['history'][1]['payload']['source_snapshot']
    assert client.put('/api/qualifications/policy', json=dict(version=1, weights=changed, note='Atrasada.')).status_code == 409


@pytest.mark.parametrize('changes', [dict(relevance=0), dict(relevance=True), dict(relevance=25.0),
                                   dict(relevance=26), dict(extra=1)])
def test_invalid_policy_weights(setup, changes):
    client, _ = setup
    policy = client.get('/api/qualifications/policy').json()
    result = client.put('/api/qualifications/policy', json=dict(version=1, weights=dict(policy['weights'], **changes), note='Teste de validação.'))
    assert result.status_code == 422
    assert client.get('/api/qualifications/policy').json()['version'] == 1


def test_policy_noop_does_not_invalidate_assessments(setup):
    client, _ = setup
    source(client); save(client, body(client))
    policy = client.get('/api/qualifications/policy').json()
    result = client.put('/api/qualifications/policy', json=dict(version=1, weights=policy['weights'], note='Mesmo modelo.'))
    assert result.status_code == 200 and result.json()['version'] == 1
    assert detail(client)['eligible']


def test_changed_contact_version_requires_new_basis_confirmation(setup):
    client, _ = setup
    row = source(client)
    save(client, body(client)); old = body(client)
    updated = update(client, 'contacts', row, source_url='https://source-fixture.com/new', source_title='Fonte atualizada').json()
    assert updated['version'] == 2
    value = detail(client)
    assert value['status'] == 'needs_review' and value['basis_hash'] != old['basis_hash']
    assert value['sources'][0]['url'] == 'https://source-fixture.com/new'
    assert value['assessment']['source_snapshot'][0]['url'] == 'https://source-fixture.com/contact'
    assert save(client, old).status_code == 409
    assert save(client, body(client)).json()['eligible']


def test_new_development_and_company_state_change_basis(setup):
    client, app = setup
    source(client); save(client, body(client))
    before = detail(client)['basis_hash']
    assert client.post('/api/developments', json=development()).status_code == 200
    assert detail(client)['basis_hash'] != before and detail(client)['status'] == 'needs_review'
    save(client, body(client))
    with app.state.engine.begin() as c:
        c.execute(text("INSERT INTO company_states VALUES('fixture','TX')"))
    assert detail(client)['status'] == 'needs_review'


def test_research_candidate_sources_available_only_after_operator_approval(setup):
    client, _ = setup
    j = job(client, target_count=1)
    imported = import_data(client, j).json(); candidate = imported['candidates'][0]
    assert client.get('/api/qualifications/companies/'+candidate['id']).status_code == 404
    approved = decision(client, j, candidate).json()
    cid = approved['candidates'][0]['company_id']
    value = detail(client, cid)
    assert len(value['sources']) == 2
    assert all(s['kind'] == 'Pesquisa aprovada' for s in value['sources'])
    assert save(client, body(client, cid), cid).json()['eligible']


def test_ranking_complete_zero_partial_and_unknown_are_separate(setup):
    client, _ = setup
    source(client)
    data = body(client)
    for factor in data['criteria'].values():factor['points'] = 0
    assert save(client, data).json()['score'] == 0
    ranked = client.get('/api/qualifications').json()
    assert ranked['items'][0]['id'] == 'fixture' and ranked['items'][0]['eligible']
    assert ranked['items'][1]['score'] is None
    assert ranked['counts']['complete'] == 1 and ranked['counts']['not_assessed'] == 1
    assert client.get('/api/qualifications?status=complete').json()['total'] == 1
    assert client.get('/api/qualifications?search=other').json()['total'] == 1
    assert client.get('/api/qualifications?state=TX').json()['total'] == 0
    assert client.get('/api/qualifications?offset=1&limit=1').json()['items'][0]['id'] == 'other'
    assert client.get('/api/qualifications?state=XX').status_code == 422


def test_bad_versions_body_limits_and_session_guards(setup):
    client, _ = setup
    source(client)
    for field, value in [('version', True), ('version', 10**50), ('basis_hash', 'bad')]:
        data = body(client); data[field] = value
        assert save(client, data).status_code == 422
    url = '/api/qualifications/companies/fixture'
    assert client.get(url, headers={'X-CRM-Token': ''}).status_code == 401
    assert client.get(url, headers={'Origin': 'https://evil.invalid'}).status_code == 403
    assert client.put(url, content='x'*65537, headers={'Content-Type': 'application/json'}).status_code == 413

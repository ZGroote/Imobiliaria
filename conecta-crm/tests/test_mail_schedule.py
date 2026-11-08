from datetime import datetime, timedelta, timezone

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.app.main import create_app
from backend.app.mail import rows
from backend.app.resend_client import ResendClient, SyncCancelled, message
from backend.app import mail_operations
from test_resend import Credentials, KEY, INBOX, THREAD, MSG, mail, thread, page


@pytest.fixture
def scheduled(tmp_path, monkeypatch):
    now = [datetime(2026, 11, 8, 12, tzinfo=timezone.utc)]
    calls, backups = [], []
    response = {'status': 200, 'threads': [thread()], 'messages': [mail()], 'more': False}

    def handle(request):
        calls.append(request)
        assert request.method == 'GET'
        assert request.url.host == 'api.resend.com'
        assert request.headers['authorization'] == 'Bearer '+KEY
        if response['status'] != 200:
            return httpx.Response(response['status'], json={'message': KEY})
        if request.url.path == '/inboxes':
            return httpx.Response(200, json=page([{'id': INBOX, 'email_address': 'contact@conectaimoveis3d.com'}]))
        if request.url.path.endswith('/threads'):
            return httpx.Response(200, json=page(response['threads'], response['more']))
        return httpx.Response(200, json=page(response['messages']))

    def backup(path):
        with app.state.engine.connect() as c:
            backups.append(c.execute(text('SELECT count(*) FROM messages')).scalar_one())
        return 'test.dpapi'

    monkeypatch.setattr(mail_operations, 'encrypted_backup', backup)
    credentials = Credentials()
    app = create_app(tmp_path/'cache.sqlite3', credentials=credentials,
                     client_factory=lambda key: ResendClient(key, transport=httpx.MockTransport(handle), interval=0),
                     start_mail_worker=False)
    app.state.clock = lambda: now[0]
    with TestClient(app, base_url='http://127.0.0.1:8765') as client:
        client.headers['x-crm-token'] = client.get('/api/session').json()['token']
        yield client, app, now, calls, response, backups, credentials


def status(client, account='contact'):
    return next(i for i in client.get('/api/mail/auto-sync').json()['items'] if i['account_id'] == account)


def enable(client, minutes=5):
    assert client.post('/api/mail/accounts/connect', json={'account_id': 'contact', 'api_key': KEY}).status_code == 200
    result = client.put('/api/mail/auto-sync/contact', json={
        'enabled': True, 'interval_minutes': minutes, 'version': status(client)['version']})
    assert result.status_code == 200


def advance(app, now, seconds):
    now[0] += timedelta(seconds=seconds)
    app.state.mail_worker.tick()


def test_defaults_off_and_only_connected_read_accounts_can_enable(scheduled):
    client, app, now, calls, _, _, _ = scheduled
    assert not any(i['enabled'] for i in client.get('/api/mail/auto-sync').json()['items'])
    advance(app, now, 3600)
    assert calls == []
    for account in ('contact', 'team', 'noreply', 'demo', 'other'):
        result = client.put('/api/mail/auto-sync/'+account, json={'enabled': True, 'interval_minutes': 5, 'version': 1})
        assert result.status_code in (409, 422)
    assert calls == []


@pytest.mark.parametrize('changes', [{'interval_minutes': 0}, {'interval_minutes': 1}, {'interval_minutes': 120},
                                   {'enabled': 'true'}, {'version': True}, {'version': -1},
                                   {'version': 10**40}, {'unexpected': KEY}])
def test_invalid_configuration_is_rejected_without_exposing_input(scheduled, changes):
    client = scheduled[0]
    body = dict(enabled=False, interval_minutes=5, version=1, **{})
    body.update(changes)
    response = client.put('/api/mail/auto-sync/contact', json=body)
    assert response.status_code == 422
    assert KEY not in response.text


def test_due_sync_get_only_keeps_reads_and_does_not_duplicate_backups(scheduled):
    client, app, now, calls, _, backups, _ = scheduled
    enable(client)
    advance(app, now, 4)
    assert len(calls) == 1
    advance(app, now, 1)
    first = status(client)
    assert first['last_added'] == 1 and first['last_success'] == now[0].isoformat()
    assert first['next_run'] == (now[0]+timedelta(minutes=5)).isoformat()
    assert backups == [0, 1]
    tid = client.get('/api/mail/threads?account_id=contact').json()['items'][0]['id']
    assert client.post('/api/mail/threads/'+tid+'/read', json={}).status_code == 200
    advance(app, now, 5*60)
    assert status(client)['last_added'] == 0 and backups == [0, 1]
    assert client.get('/api/mail/threads?account_id=contact').json()['items'][0]['unread_count'] == 0
    with app.state.engine.connect() as c:
        assert c.execute(text('SELECT count(*) FROM messages')).scalar_one() == 1
        for table in ('mail_schedule', 'audit_events'):
            assert KEY not in str(rows(c, 'SELECT * FROM '+table))


def test_rate_limit_backoff_capped_and_recovery_clears_error(scheduled):
    client, app, now, _, response, _, _ = scheduled
    enable(client)
    response['status'] = 429
    advance(app, now, 5)
    assert status(client)['failures'] == 1
    assert 'Limite' in status(client)['last_error'] and KEY not in str(status(client))
    advance(app, now, 5*60)
    assert status(client)['failures'] == 2
    assert status(client)['next_run'] == (now[0]+timedelta(minutes=10)).isoformat()
    for _ in range(6):
        advance(app, now, 3600)
    assert status(client)['next_run'] == (now[0]+timedelta(hours=1)).isoformat()
    response['status'] = 200
    advance(app, now, 3600)
    assert status(client)['last_error'] is None and status(client)['failures'] == 0
    assert status(client)['last_added'] == 1


def test_manual_sync_lock_is_shared_and_skipped_without_failure(scheduled):
    client, app, now, calls, _, _, _ = scheduled
    enable(client)
    app.state.mail_locks['contact'].acquire()
    try:
        advance(app, now, 5)
        assert len(calls) == 1 and status(client)['failures'] == 0
        assert status(client)['running'] is True
        assert client.post('/api/mail/sync', json={'account_id': 'contact'}).status_code == 409
    finally:
        app.state.mail_locks['contact'].release()
    app.state.mail_worker.tick()
    assert status(client)['last_added'] == 1


def test_config_version_pause_and_no_replay_burst_after_long_downtime(scheduled):
    client, app, now, calls, _, _, _ = scheduled
    enable(client)
    assert client.put('/api/mail/auto-sync/contact', json={'enabled': False, 'interval_minutes': 5, 'version': 1}).status_code == 409
    advance(app, now, 7*86400)
    before = len(calls)
    app.state.mail_worker.tick()
    assert len(calls) == before
    row = status(client)
    assert client.put('/api/mail/auto-sync/contact', json={'enabled': False, 'interval_minutes': 30, 'version': row['version']}).status_code == 200
    advance(app, now, 86400)
    assert len(calls) == before and status(client)['next_run'] is None


def test_pause_during_network_cannot_be_undone_by_completion(scheduled):
    client, app, now, _, _, _, _ = scheduled
    enable(client)
    factory = app.state.mail_client_factory

    def pause_factory(key):
        row = status(client)
        assert client.put('/api/mail/auto-sync/contact', json={'enabled': False, 'interval_minutes': 5, 'version': row['version']}).status_code == 200
        return factory(key)

    app.state.mail_client_factory = pause_factory
    advance(app, now, 5)
    assert status(client)['enabled'] is False and status(client)['next_run'] is None
    assert status(client)['version'] == 3


def test_lost_credential_preserves_cache_and_records_safe_error(scheduled):
    client, app, now, _, _, backups, credentials = scheduled
    enable(client)
    advance(app, now, 5)
    credentials.values.clear()
    advance(app, now, 300)
    assert 'conexão' in status(client)['last_error']
    assert backups == [0, 1]
    assert client.get('/api/mail/threads?account_id=contact').json()['total'] == 1


def test_partial_page_gets_before_after_backups_even_on_failure(scheduled):
    client, app, now, _, response, backups, _ = scheduled
    enable(client)
    response['threads'].append(thread(id='00000000-0000-4000-8000-000000000009', email_count=2))
    advance(app, now, 5)
    assert status(client)['last_error'] and status(client)['last_success'] is None
    assert backups == [0, 1]
    assert client.get('/api/mail/threads?account_id=contact').json()['total'] == 1
    response['threads'].pop()
    advance(app, now, 300)
    assert status(client)['last_error'] is None and backups == [0, 1]


def test_continuation_runs_one_page_per_minute_and_uses_cursor(scheduled):
    client, app, now, calls, response, _, _ = scheduled
    enable(client, 30)
    response['more'] = True
    advance(app, now, 5)
    assert status(client)['has_more'] and status(client)['next_run'] == (now[0]+timedelta(seconds=60)).isoformat()
    response['threads'], response['more'] = [], False
    advance(app, now, 60)
    pages = [c for c in calls if c.url.path.endswith('/threads')]
    assert pages[-1].url.params['after'] == THREAD
    assert not status(client)['has_more']
    assert status(client)['next_run'] == (now[0]+timedelta(minutes=30)).isoformat()


def test_worker_shutdown_cancels_future_network_calls(scheduled):
    client, app, now, calls, _, _, _ = scheduled
    enable(client)
    app.state.mail_worker.stopping.set()
    advance(app, now, 3600)
    assert len(calls) == 1
    adapter = ResendClient(KEY, transport=httpx.MockTransport(lambda _: pytest.fail('network after stop')), interval=0)
    adapter.cancelled = lambda: True
    try:
        with pytest.raises(SyncCancelled):
            adapter.find_inbox('contact@conectaimoveis3d.com')
    finally:
        adapter.close()


def test_unknown_provider_error_is_not_written_to_status(scheduled):
    client, app, now, _, _, _, _ = scheduled
    enable(client)

    def broken(key):
        raise RuntimeError('sensitive='+key)

    app.state.mail_client_factory = broken
    advance(app, now, 5)
    assert status(client)['last_error'] and KEY not in str(status(client))


def test_failed_pre_backup_never_writes_messages_and_releases_lock(scheduled, monkeypatch):
    client, app, now, _, _, _, _ = scheduled
    enable(client)

    def broken(path):
        raise OSError('no space')

    monkeypatch.setattr(mail_operations, 'encrypted_backup', broken)
    advance(app, now, 5)
    assert status(client)['last_error']
    assert not app.state.mail_locks['contact'].locked()
    assert client.get('/api/mail/threads?account_id=contact').json()['total'] == 0


def test_schedule_survives_restart_and_does_not_replay_missed_intervals(tmp_path, monkeypatch):
    path = tmp_path/'restart.sqlite3'
    credentials = Credentials()
    credentials.put('contact', KEY)
    monkeypatch.setattr(mail_operations, 'encrypted_backup', lambda _: 'fixture.dpapi')
    calls = []

    def factory(key):
        def handle(request):
            calls.append(request)
            return httpx.Response(200, json=page([{'id': INBOX, 'email_address': 'contact@conectaimoveis3d.com'}])
                                  if request.url.path == '/inboxes' else page([]))
        return ResendClient(key, transport=httpx.MockTransport(handle), interval=0)

    first = create_app(path, credentials=credentials, client_factory=factory, start_mail_worker=False)
    with TestClient(first, base_url='http://127.0.0.1:8765') as client:
        client.headers['x-crm-token'] = client.get('/api/session').json()['token']
        enable(client)
    second = create_app(path, credentials=credentials, client_factory=factory, start_mail_worker=False)
    second.state.clock = lambda: datetime(2030, 1, 1, tzinfo=timezone.utc)
    with TestClient(second, base_url='http://127.0.0.1:8765') as client:
        client.headers['x-crm-token'] = client.get('/api/session').json()['token']
        assert status(client)['enabled'] and status(client)['interval_minutes'] == 5
        second.state.mail_worker.tick()
        before = len(calls)
        second.state.mail_worker.tick()
        assert len(calls) == before and status(client)['last_success']
        assert status(client)['next_run'] == '2030-01-01T00:05:00+00:00'


def test_attachment_metadata_accepts_unknown_size_and_preserves_id():
    value = message(mail(attachments=[{'id': MSG, 'filename': None, 'size': None}]), THREAD)
    assert value.attachments == [{'id': MSG, 'name': 'Anexo sem nome', 'size': None, 'available': False}]

import copy
import hashlib
import json
from datetime import datetime, timezone

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.app import mail_operations
from backend.app.attachment_files import MAX_ATTACHMENT
from backend.app.main import create_app
from backend.app.mail import rows
from backend.app.resend_client import ResendClient, ResendError
from test_resend import Credentials, KEY, INBOX, MSG, THREAD, mail, page, thread
from test_attachment_files import Opener
from backend.app.attachment_files import read_attachment

AID = '00000000-0000-4000-8000-000000000020'
OTHER = '00000000-0000-4000-8000-000000000021'
CONTENT = 'Arquivo fictício de teste.'.encode()
SIGNED_URL = f'https://inbound-cdn.resend.com/{MSG}/attachments/{AID}?signature=private'


@pytest.fixture
def files(tmp_path, monkeypatch):
    state = {
        'inbox_id': INBOX,
        'inbox': mail(direction='inbound', attachments=[{'id': AID, 'filename': 'área útil.txt', 'size': None}]),
        'metadata': {'id': AID, 'filename': 'área útil.txt', 'size': len(CONTENT),
                     'download_url': SIGNED_URL, 'expires_at': '2030-01-01T00:00:00Z'},
        'file_error': False,
    }
    state['received'] = dict(id=MSG, **{'from': state['inbox']['from']},
                             message_id=state['inbox']['message_id'], attachments=copy.deepcopy(state['inbox']['attachments']))
    calls, transfers, clients = [], [], []

    def handle(request):
        calls.append(request)
        assert request.method == 'GET' and request.url.host == 'api.resend.com'
        assert request.headers['authorization'] == 'Bearer '+KEY
        path = request.url.path
        if path == '/inboxes':
            result = page([{'id': state['inbox_id'], 'email_address': 'contact@conectaimoveis3d.com'}])
        elif path.endswith('/threads'):
            result = page([thread()])
        elif path.endswith('/emails'):
            result = page([state['inbox']])
        elif path == f'/inboxes/{INBOX}/threads/{THREAD}/emails/{MSG}':
            result = state['inbox']
        elif path == '/emails/receiving/'+MSG:
            assert request.url.params['html_format'] == 'cid'
            result = state['received']
        elif path == f'/emails/receiving/{MSG}/attachments/{AID}':
            result = state['metadata']
        else:
            return httpx.Response(404, json={'message': KEY})
        return httpx.Response(200, json=result)

    def factory(key):
        client = ResendClient(key, transport=httpx.MockTransport(handle), interval=0)
        clients.append(client)
        return client

    def reader(url, email_id, attachment_id, size):
        assert email_id == MSG and attachment_id == AID
        if state['file_error']:
            raise ResendError('Falha simulada do arquivo.')
        opener = Opener(CONTENT)
        result = read_attachment(url, email_id, attachment_id, size, opener=opener)
        transfers.extend(opener.calls)
        return result

    credentials = Credentials()
    monkeypatch.setattr(mail_operations, 'encrypted_backup', lambda _: 'fixture.dpapi')
    app = create_app(tmp_path/'cache.sqlite3', credentials=credentials, client_factory=factory,
                     attachment_reader=reader, start_mail_worker=False)
    app.state.clock = lambda: datetime(2026, 11, 8, 12, tzinfo=timezone.utc)
    with TestClient(app, base_url='http://127.0.0.1:8765') as client:
        client.headers['x-crm-token'] = client.get('/api/session').json()['token']
        assert client.post('/api/mail/accounts/connect', json={'account_id': 'contact', 'api_key': KEY}).status_code == 200
        assert client.post('/api/mail/sync', json={'account_id': 'contact'}).json()['added'] == 1
        with app.state.engine.connect() as c:
            mid = c.execute(text('SELECT id FROM messages')).scalar_one()
        yield client, app, state, calls, transfers, clients, credentials, mid


def listing(files, account='contact'):
    return files[0].get(f'/api/mail/messages/{files[-1]}/attachments?account_id={account}')


def download(files, aid=AID, **body):
    return files[0].post(f'/api/mail/messages/{files[-1]}/attachments/{aid}/download',
                         json={'account_id': 'contact', **body})


def test_list_download_exact_bytes_and_minimal_audit_without_urls(files):
    client, app, state, _, transfers, clients, _, mid = files
    listed = listing(files)
    assert listed.status_code == 200
    assert listed.json()['items'] == [dict(id=AID, name='área útil.txt', size=None, downloadable=True)]
    assert transfers == [] and SIGNED_URL not in listed.text and KEY not in listed.text
    result = download(files)
    assert result.status_code == 200 and result.content == CONTENT
    assert result.headers['content-type'] == 'application/octet-stream'
    assert "filename*=UTF-8''%C3%A1rea%20%C3%BAtil.txt" in result.headers['content-disposition']
    assert result.headers['cache-control'] == 'no-store'
    assert result.headers['x-content-type-options'] == 'nosniff'
    assert result.headers['content-security-policy'] == "default-src 'none'; sandbox"
    assert len(transfers) == 1 and clients[-1]._http.is_closed
    with app.state.engine.connect() as c:
        record = rows(c, 'SELECT * FROM attachment_transfers')[0]
        assert record['message_id'] == mid and record['attachment_id'] == AID
        assert record['sha256'] == hashlib.sha256(CONTENT).hexdigest()
        assert record['size'] == len(CONTENT) and record['filename'] == 'área útil.txt'
        assert 'signature' not in str(record) and KEY not in str(record)
        assert not c.execute(text('SELECT is_read FROM messages')).scalar_one()
    assert client.get('/api/insights').json()['response_reviews']['human'] == 0


def test_old_cached_metadata_without_attachment_ids_still_downloads(files):
    _, app, _, _, _, _, _, mid = files
    with app.state.engine.begin() as c:
        c.execute(text('UPDATE messages SET attachments=:a WHERE id=:m'),
                  dict(a=json.dumps([{'name': 'área útil.txt', 'size': None, 'available': False}]), m=mid))
    assert listing(files).status_code == 200 and download(files).content == CONTENT


def test_other_account_and_unknown_attachment_never_download_bytes(files):
    _, _, _, calls, transfers, _, _, _ = files
    before = len(calls)
    assert listing(files, 'team').status_code == 404
    assert download(files, account_id='team').status_code == 404
    assert len(calls) == before
    assert download(files, OTHER).status_code == 404 and transfers == []


@pytest.mark.parametrize('target,key,value', [
    ('inbox', 'id', OTHER), ('received', 'id', OTHER),
    ('inbox', 'direction', 'outbound'), ('inbox', 'message_id', '<different@invalid>'),
    ('received', 'message_id', None), ('received', 'from', 'other@fixture.invalid'),
    ('inbox', 'from', 'other@fixture.invalid'),
    ('received', 'attachments', []),
    ('received', 'attachments', [{'id': OTHER, 'filename': 'área útil.txt', 'size': None}]),
    ('received', 'attachments', [{'id': AID, 'filename': 'other.txt', 'size': None}]),
])
def test_identity_or_membership_mismatch_blocks_transfer(files, target, key, value):
    files[2][target][key] = value
    result = download(files)
    assert result.status_code == 409 and files[4] == []


def test_duplicates_and_inconsistent_sizes_are_rejected(files):
    files[2]['received']['attachments'] *= 2
    assert listing(files).status_code == 409
    files[2]['received']['attachments'].pop()
    files[2]['received']['attachments'][0]['size'] = 9
    files[2]['inbox']['attachments'][0]['size'] = 8
    assert download(files).status_code == 409 and files[4] == []


@pytest.mark.parametrize('changes,status', [
    ({'id': OTHER}, 409), ({'filename': 'other.txt'}, 409),
    ({'expires_at': '2026-11-08T12:00:00Z'}, 409),
    ({'expires_at': 'invalid'}, 502), ({'size': True}, 502), ({'size': -1}, 502),
    ({'size': MAX_ATTACHMENT+1}, 413),
])
def test_metadata_invalid_expired_or_oversize_never_reaches_file_host(files, changes, status):
    files[2]['metadata'].update(changes)
    response = download(files)
    assert response.status_code == status and files[4] == []
    assert SIGNED_URL not in response.text and 'signature' not in response.text and KEY not in response.text


def test_known_oversize_marked_unavailable(files):
    for source in ('inbox', 'received'):
        files[2][source]['attachments'][0]['size'] = MAX_ATTACHMENT+1
    assert listing(files).json()['items'][0]['downloadable'] is False
    assert download(files).status_code == 413 and files[4] == []


@pytest.mark.parametrize('url', [SIGNED_URL.replace('inbound-cdn.resend.com', '127.0.0.1'),
                              SIGNED_URL.replace(MSG, OTHER), SIGNED_URL+'#bad'])
def test_api_never_follows_unbound_provider_download_link(files, url):
    files[2]['metadata']['download_url'] = url
    result = download(files)
    assert result.status_code == 502 and files[4] == []
    assert 'signature' not in result.text


def test_failed_transfer_has_no_success_audit_and_releases_lock(files):
    _, app, state, _, _, clients, _, _ = files
    state['file_error'] = True
    assert download(files).status_code == 502
    assert not app.state.mail_locks['contact'].locked() and clients[-1]._http.is_closed
    with app.state.engine.connect() as c:
        assert c.execute(text('SELECT count(*) FROM attachment_transfers')).scalar_one() == 0
    state['file_error'] = False
    assert download(files).status_code == 200


def test_shared_operation_lock_and_missing_credential(files):
    _, app, _, calls, _, _, credentials, _ = files
    before = len(calls)
    app.state.mail_locks['contact'].acquire()
    try:
        assert listing(files).status_code == 409 and download(files).status_code == 409
    finally:
        app.state.mail_locks['contact'].release()
    assert len(calls) == before
    credentials.values.clear()
    assert listing(files).status_code == 409 and len(calls) == before


def test_remote_account_changed_blocks_before_message_lookup(files):
    files[2]['inbox_id'] = OTHER
    assert download(files).status_code == 409
    assert files[3][-1].url.path == '/inboxes' and files[4] == []


def test_local_auth_origin_input_and_demo_protections(files):
    client, _, _, calls, _, _, _, _ = files
    before = len(calls)
    url = f'/api/mail/messages/{files[-1]}/attachments?account_id=contact'
    assert client.get(url, headers={'X-CRM-Token': ''}).status_code == 401
    assert client.get(url, headers={'Origin': 'https://evil.invalid'}).status_code == 403
    assert listing(files, 'demo').status_code == 422
    invalid = download(files, url=SIGNED_URL)
    assert invalid.status_code == 422 and 'signature' not in invalid.text
    assert download(files, aid='../invalid').status_code in (404, 422)
    assert len(calls) == before


def test_outgoing_cached_message_never_queries_received_resources(files):
    _, app, _, calls, _, _, _, mid = files
    with app.state.engine.begin() as c:
        c.execute(text("UPDATE messages SET direction='outbound' WHERE id=:m"), dict(m=mid))
    before = len(calls)
    assert listing(files).status_code == 409 and download(files).status_code == 409
    assert len(calls) == before

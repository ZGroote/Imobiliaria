import json

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.app.main import create_app
from backend.app.mail import rows
from backend.app.resend_client import ResendClient, ResendError, message
from backend.app.resend_sync import sync_resend
from backend.app.windows_store import WindowsCredentials, credential_api, encrypted_backup, restore_copy

KEY = "re_fictitious_test_only"
INBOX = "00000000-0000-4000-8000-000000000001"
THREAD = "00000000-0000-4000-8000-000000000002"
SECOND = "00000000-0000-4000-8000-000000000003"
MSG = "00000000-0000-4000-8000-000000000004"
REPLY = "00000000-0000-4000-8000-000000000005"


def mail(id=MSG, **changes):
    return dict({"id":id,"from":"Pessoa <person@example.invalid>","to":["contact@conectaimoveis3d.com"],
                 "subject":"Consulta realista de teste","message_id":f"<{id}@example.invalid>",
                 "text":"Gostaria de uma demonstração.","read":False,"received_at":"2026-11-08T12:00:00Z","attachments":[]},**changes)


def thread(id=THREAD, **changes):
    return dict({"id":id,"subject":"Consulta realista de teste","email_count":1,
                 "received_at":"2026-11-08T12:00:00Z","folder":"inbox"},**changes)


def page(data, more=False):
    return {"object":"list","has_more":more,"data":data}


class Credentials:
    def __init__(self):
        self.values = {}

    def get(self, account):
        return self.values.get(account)

    def put(self, account, key):
        self.values[account] = key


@pytest.fixture
def setup(tmp_path):
    calls = []
    responses = {"threads":[thread()],"messages":[mail()]}

    def handle(request):
        calls.append(request)
        assert request.method == "GET"
        assert request.url.host == "api.resend.com"
        assert request.headers["authorization"] == "Bearer "+KEY
        if request.url.path == "/inboxes":
            return httpx.Response(200,json=page([{"id":INBOX,"email_address":"contact@conectaimoveis3d.com"}]))
        if request.url.path.endswith("/threads"):
            return httpx.Response(200,json=page(responses["threads"]))
        return httpx.Response(200,json=page(responses["messages"]))

    def factory(key):
        return ResendClient(key,transport=httpx.MockTransport(handle),interval=0)

    credentials = Credentials()
    app = create_app(tmp_path/"cache.sqlite3",credentials=credentials,client_factory=factory)
    with TestClient(app,base_url="http://127.0.0.1:8765") as client:
        client.headers["x-crm-token"] = client.get("/api/session").json()["token"]
        yield client,app,credentials,factory,calls,responses


def connect(client):
    result = client.post("/api/mail/accounts/connect",json={"account_id":"contact","api_key":KEY})
    assert result.status_code == 200
    assert result.json()["connected"] and not result.json()["send_enabled"]
    assert KEY not in result.text


def test_connect_only_expected_inbox_and_sync_get_only(setup):
    client,app,credentials,_,calls,_ = setup
    connect(client)
    assert credentials.get("contact") == KEY
    result = client.post("/api/mail/sync",json={"account_id":"contact"})
    assert result.status_code == 200
    assert result.json()["added"] == 1
    assert result.json()["mode"] == "resend"
    assert result.json()["backup"].endswith(".dpapi")
    assert client.get("/api/mail/threads?account_id=contact").json()["total"] == 1
    assert client.get("/api/mail/threads?account_id=demo").json()["total"] == 0
    before = len([c for c in calls if c.url.path.endswith("/emails")])
    assert client.post("/api/mail/sync",json={"account_id":"contact"}).json()["added"] == 0
    assert len([c for c in calls if c.url.path.endswith("/emails")]) == before
    assert all(c.method == "GET" for c in calls)
    with app.state.engine.connect() as c:
        assert KEY not in json.dumps(rows(c,"SELECT * FROM accounts"))
        assert KEY not in json.dumps(rows(c,"SELECT * FROM audit_events"))


def test_wrong_inbox_and_invalid_inputs_never_store_secret(setup):
    client,_,credentials,_,calls,_ = setup
    for body in [dict(account_id="team",api_key=KEY),dict(account_id="noreply",api_key=KEY),
                 dict(account_id="contact",api_key={"private":KEY}),dict(account_id="contact",api_key="bad "+KEY)]:
        response = client.post("/api/mail/accounts/connect",json=body)
        assert response.status_code in (409,422)
        assert KEY not in response.text
    assert not credentials.values
    assert client.post("/api/mail/accounts/connect",json={"account_id":"contact","api_key":"x"*17000}).status_code == 413
    assert client.post("/api/mail/sync",json={"account_id":"noreply"}).status_code == 409


def test_new_reply_and_folder_move_preserve_local_read(setup):
    client,app,_,factory,_,responses = setup
    connect(client)
    client.post("/api/mail/sync",json={"account_id":"contact"})
    tid = client.get("/api/mail/threads?account_id=contact").json()["items"][0]["id"]
    client.post(f"/api/mail/threads/{tid}/read")
    responses["threads"] = [thread(email_count=2,folder="archive",received_at="2026-11-08T13:00:00Z")]
    responses["messages"] = [mail(),mail(REPLY,received_at="2026-11-08T13:00:00Z")]
    assert client.post("/api/mail/sync",json={"account_id":"contact"}).json()["added"] == 1
    items = client.get("/api/mail/threads?account_id=contact&folder=Arquivados").json()["items"]
    assert items[0]["id"] == tid and items[0]["unread_count"] == 1
    assert client.get("/api/mail/threads?account_id=contact&folder=Entrada").json()["total"] == 0


def test_paging_resume_and_partial_failure(setup):
    _,app,_,_,_,_ = setup
    state = {"fail":True,"after":[]}

    def handle(request):
        if request.url.path.endswith("/threads"):
            after = request.url.params.get("after")
            state["after"].append(after)
            return httpx.Response(200,json=page([thread(SECOND)] if after else [thread()],not after))
        if f"/{SECOND}/" in request.url.path and state["fail"]:
            return httpx.Response(429,json={"message":KEY})
        return httpx.Response(200,json=page([mail(REPLY)] if f"/{SECOND}/" in request.url.path else [mail()]))

    remote = ResendClient(KEY,transport=httpx.MockTransport(handle),interval=0)
    assert sync_resend(app.state.engine,"contact",INBOX,remote)["has_more"]
    with pytest.raises(ResendError,match="Limite"):
        sync_resend(app.state.engine,"contact",INBOX,remote)
    with app.state.engine.connect() as c:
        assert rows(c,"SELECT after_id FROM sync_state")[0]["after_id"] == THREAD
        assert len(rows(c,"SELECT id FROM messages")) == 1
    state["fail"] = False
    assert sync_resend(app.state.engine,"contact",INBOX,remote)["added"] == 1
    assert state["after"] == [None,THREAD,THREAD]
    remote.close()


def test_inbox_and_message_pagination_are_not_cut_off():
    calls = []

    def handle(request):
        calls.append(request)
        after = request.url.params.get("after")
        if request.url.path == "/inboxes":
            return httpx.Response(200,json=page([{"id":SECOND if after else INBOX,
                "email_address":"contact@conectaimoveis3d.com" if after else "other@example.invalid"}],not after))
        return httpx.Response(200,json=page([mail(REPLY if after else MSG)],not after))

    remote = ResendClient(KEY,transport=httpx.MockTransport(handle),interval=0)
    assert remote.find_inbox("contact@conectaimoveis3d.com") == SECOND
    assert len(remote.messages(INBOX,THREAD)) == 2
    assert calls[-1].url.params["after"] == MSG
    remote.close()


@pytest.mark.parametrize("status",[301,401,403,429,500])
def test_remote_failures_do_not_expose_key_or_follow_redirects(status):
    def handle(request):
        return httpx.Response(status,json={"message":KEY},headers={"Location":"https://attacker.invalid"})
    remote = ResendClient(KEY,transport=httpx.MockTransport(handle),interval=0)
    with pytest.raises(ResendError) as error:
        remote.find_inbox("contact@conectaimoveis3d.com")
    assert KEY not in str(error.value)
    remote.close()


def test_html_fallback_and_untrusted_path():
    m = message(mail(text=None,html='<style>hidden</style><p>Olá</p><img src="https://tracker.invalid"><script>evil()</script>'),THREAD)
    assert m.body == "Olá"
    with pytest.raises(ResendError):
        message(mail(id="../../secret"),THREAD)
    with pytest.raises(ResendError):
        message(mail(received_at="2026-11-08T12:00:00"),THREAD)


def test_encrypted_backup_and_restore_copy(setup):
    _,app,_,_,_,_ = setup
    path = app.state.db_path
    name = encrypted_backup(path)
    encrypted = (path.parent/"backups"/name).read_bytes()
    assert not encrypted.startswith(b"SQLite format")
    restored = restore_copy(path,name)
    import sqlite3
    with sqlite3.connect(restored) as c:
        assert c.execute("SELECT COUNT(*) FROM accounts").fetchone()[0] == 4
        assert c.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
    assert restored != path


def test_incomplete_conversation_does_not_commit_or_advance(setup):
    client,app,_,_,_,responses = setup
    connect(client)
    responses["threads"] = [thread(email_count=2)]
    response = client.post("/api/mail/sync",json={"account_id":"contact"})
    assert response.status_code == 502
    with app.state.engine.connect() as c:
        assert not rows(c,"SELECT * FROM messages")
        assert not rows(c,"SELECT * FROM sync_state")


def test_native_windows_credential_roundtrip_uses_isolated_target():
    import ctypes
    from ctypes import wintypes
    from uuid import uuid4
    target = "ConectaCRM/Test/"+uuid4().hex

    class IsolatedCredentials(WindowsCredentials):
        @staticmethod
        def target(account):
            return target

    store = IsolatedCredentials()
    assert store.get("test") is None
    try:
        store.put("test",KEY)
        assert store.get("test") == KEY
    finally:
        api = credential_api()
        api.CredDeleteW.argtypes = [wintypes.LPCWSTR,wintypes.DWORD,wintypes.DWORD]
        api.CredDeleteW.restype = wintypes.BOOL
        assert api.CredDeleteW(target,1,0)
    assert store.get("test") is None

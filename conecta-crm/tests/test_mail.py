from dataclasses import replace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.app.main import create_app
from backend.app.provider import MockProvider
from backend.app.mail import sync


@pytest.fixture
def setup(tmp_path):
    provider = MockProvider()
    app = create_app(tmp_path / "mail.sqlite3", provider)
    with TestClient(app, base_url="http://127.0.0.1:8765") as client:
        token = client.get("/api/session").json()["token"]
        client.headers["x-crm-token"] = token
        yield client, app, provider


def test_sync_idempotency_folders_threading_and_fts(setup):
    client, app, _ = setup
    assert client.post("/api/mail/sync", json={}).json()["added"] == 100
    assert client.post("/api/mail/sync", json={}).json()["added"] == 0
    result = client.get("/api/mail/threads").json()
    assert result["total"] == 25
    assert all(t["message_count"] == 4 for t in result["items"])
    assert sum(f["count"] for f in client.get("/api/mail/folders").json()) == 100
    assert client.get("/api/mail/threads?q=valores").json()["total"] == 7
    assert client.get('/api/mail/threads?q=" OR *').status_code == 200
    with app.state.engine.connect() as c:
        assert c.execute(text("PRAGMA foreign_keys")).scalar() == 1
        assert c.execute(text("PRAGMA journal_mode")).scalar() == "wal"


def test_validity_reset_and_failure_preserve_cache(setup):
    client, app, provider = setup
    client.post("/api/mail/sync", json={})
    provider.validity = "demo-2"
    assert client.post("/api/mail/sync", json={}).json()["added"] == 0
    assert client.get("/api/mail/threads").json()["total"] == 25
    assert sum(f["count"] for f in client.get("/api/mail/folders").json()) == 100
    provider.validity = "demo-3"
    original = provider.messages
    provider.messages = lambda folder, cursor: (_ for _ in ()).throw(OSError("disconnected"))
    assert client.post("/api/mail/sync", json={}).status_code == 503
    with app.state.engine.connect() as c:
        assert {r[0] for r in c.execute(text("SELECT uidvalidity FROM folders"))} == {"demo-2"}
    assert client.get("/api/mail/threads?q=valores").json()["total"] == 7
    provider.messages = original


def test_local_read_and_message_detail(setup):
    client, _, _ = setup
    client.post("/api/mail/sync", json={})
    tid = client.get("/api/mail/threads").json()["items"][0]["id"]
    detail = client.get(f"/api/mail/threads/{tid}").json()
    assert len(detail["messages"]) == 4
    assert client.post(f"/api/mail/threads/{tid}/read").json()["local_only"]
    assert client.get("/api/mail/threads?unread=true").json()["total"] == 24
    assert client.get("/api/mail/threads/missing").status_code == 404
    assert client.get("/api/mail/threads?limit=101").status_code == 422


def test_host_origin_session_and_no_send(setup):
    client, _, _ = setup
    assert client.get("/api/mail/accounts", headers={"x-crm-token":"wrong"}).status_code == 401
    assert client.get("/api/session", headers={"Origin":"https://attacker.invalid"}).status_code == 403
    assert client.get("/api/session", headers={"Host":"attacker.invalid:8765"}).status_code == 403
    assert client.get("/api/session", headers={"Sec-Fetch-Site":"cross-site"}).status_code == 403
    response = client.get("/api/mail/accounts")
    assert response.headers["cache-control"] == "no-store"
    assert "script-src 'self'" in response.headers["content-security-policy"]
    assert not any(a["send_enabled"] for a in response.json())
    assert client.post("/api/mail/sync", json={"account_id":"contact"}).status_code == 409
    assert client.post("/api/outbound/send", json={}).status_code == 404
    assert not any(p["send_enabled"] for p in client.get("/api/brand-profiles").json())


def test_out_of_order_reply_and_untrusted_content(setup):
    client, _, provider = setup
    parent = MockProvider().messages("Entrada", 0)[0]
    malicious = '<script>alert(1)</script><img src="https://tracker.invalid/pixel">'
    reply = replace(parent, key="reply", uid=2, message_id="<reply>", in_reply_to=parent.message_id,
                    references=(), body=malicious)
    provider.folders = lambda: [("Entrada", "1")]
    provider.messages = lambda folder, cursor: [reply, parent] if cursor == 0 else []
    assert client.post("/api/mail/sync", json={}).json()["added"] == 2
    result = client.get("/api/mail/threads").json()
    assert result["total"] == 1
    detail = client.get("/api/mail/threads/"+result["items"][0]["id"]).json()
    assert any(m["body_text"] == malicious for m in detail["messages"])
    assert any(m["attachments"] for m in detail["messages"])


def test_cache_survives_restart(setup, tmp_path):
    client, _, _ = setup
    client.post("/api/mail/sync", json={})
    with TestClient(create_app(tmp_path / "mail.sqlite3"), base_url="http://127.0.0.1:8765") as second:
        second.headers["x-crm-token"] = second.get("/api/session").json()["token"]
        assert second.get("/api/mail/threads").json()["total"] == 25
        assert second.post("/api/mail/sync", json={}).json()["added"] == 0


def test_account_isolation_and_pagination(setup):
    client, app, provider = setup
    client.post("/api/mail/sync", json={})
    # Cabeçalhos idênticos em contas distintas não unem conversas.
    sync(app.state.engine, "contact", provider)
    assert client.get("/api/mail/threads?account_id=contact").json()["total"] == 25
    first = client.get("/api/mail/threads?limit=10").json()
    second = client.get("/api/mail/threads?limit=10&offset=10").json()
    assert len(first["items"]) == len(second["items"]) == 10
    assert not ({t["id"] for t in first["items"]} & {t["id"] for t in second["items"]})
    contact = client.get("/api/mail/threads?account_id=contact").json()
    assert not ({t["id"] for t in first["items"]} & {t["id"] for t in contact["items"]})

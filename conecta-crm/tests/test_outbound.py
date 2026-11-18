from dataclasses import replace
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.app.classification import suppress
from backend.app.main import create_app
from backend.app.mail import sync
from backend.app.provider import MockProvider

NOW = datetime(2026,11,9,12,tzinfo=timezone.utc)


def data(**changes):
    return dict(dict(account_id="contact",profile_id="US",recipient="person@example.invalid",subject="Interactive visualization",
        body_text="Hello.\nConecta Imóveis 3D\nhttps://conectaimoveis3d.com\n123 Fictional Avenue, Test City\nReply asking to be removed from our list.",
        purpose="outreach",thread_id=None,metadata=dict(postal_address="123 Fictional Avenue, Test City")),**changes)


@pytest.fixture
def setup(tmp_path):
    def forbidden_client(key):
        raise AssertionError("A fila de simulação nunca pode acessar o provedor.")
    app = create_app(tmp_path/"cache.sqlite3",client_factory=forbidden_client)
    state = {"now":NOW}
    app.state.clock = lambda: state["now"]
    with TestClient(app,base_url="http://127.0.0.1:8765") as client:
        client.headers["x-crm-token"] = client.get("/api/session").json()["token"]
        yield client,app,state


def create(client,**changes):
    result = client.post("/api/outbound/drafts",json=data(**changes))
    assert result.status_code==200,result.text
    return result.json()


def approval(draft):
    return dict(version=draft["version"],content_hash=draft["content_hash"],confirm=True)


def approve(client,draft):
    result = client.post(f"/api/outbound/drafts/{draft['id']}/approve",json=approval(draft))
    assert result.status_code==200,result.text
    return result.json()


def schedule(client,draft,time="2026-11-09T09:00",zone="America/New_York"):
    return client.post("/api/outbound/schedule",json=dict(**approval(draft),draft_id=draft["id"],local_time=time,recipient_timezone=zone))


def test_approval_required_and_imported_flags_rejected(setup):
    client,_,_ = setup
    draft = create(client)
    assert schedule(client,draft).status_code==409
    assert client.post("/api/outbound/drafts",json=dict(data(),approved=True)).status_code==422
    assert client.post(f"/api/outbound/drafts/{draft['id']}/approve",json=dict(approval(draft),confirm=False)).status_code==422
    approved = approve(client,draft)
    assert approved["approved_hash"]==draft["content_hash"]
    assert approved["send_enabled"] is False and approved["send_blockers"]
    assert schedule(client,approved).status_code==200
    assert schedule(client,approved).status_code==409


def test_edit_revokes_approval_and_cancels_old_snapshot(setup):
    client,_,_ = setup
    old = approve(client,create(client))
    assert schedule(client,old).status_code==200
    response = client.put(f"/api/outbound/drafts/{old['id']}",json=dict(data(subject="Changed"),version=old["version"]))
    assert response.status_code==200
    new = response.json()
    assert new["version"]==2 and new["approved_hash"] is None and new["status"]=="draft"
    assert schedule(client,old).status_code==409
    queue = client.get("/api/outbound/queue").json()["items"][0]
    assert queue["status"]=="cancelled" and queue["snapshot"]["subject"]==old["subject"]
    assert client.put(f"/api/outbound/drafts/{old['id']}",json=dict(data(),version=1)).status_code==409
    assert schedule(client,approve(client,new)).status_code==200


@pytest.mark.parametrize("changes",[
    dict(body_text="{{missing}}"),dict(body_text="No signature"),dict(subject=""),
    dict(metadata=dict(postal_address="")),dict(body_text="Conecta Imóveis 3D\nhttps://conectaimoveis3d.com\n123 Fictional Avenue, Test City"),
    dict(body_text="Conecta Imóveis 3D\nhttps://conectaimoveis3d.com.br"),
    dict(purpose="delivery"),dict(purpose="after_sale"),dict(purpose="reply"),dict(purpose="followup"),
])
def test_incomplete_or_inconsistent_content_cannot_be_approved(setup,changes):
    client,_,_ = setup
    draft = create(client,**changes)
    assert draft["review_errors"]
    assert client.post(f"/api/outbound/drafts/{draft['id']}/approve",json=approval(draft)).status_code==409


def test_suppression_after_approval_blocks_queue_globally(setup):
    client,app,_ = setup
    draft = approve(client,create(client))
    assert schedule(client,draft).status_code==200
    with app.state.engine.begin() as c:
        suppress(c,"PERSON@EXAMPLE.INVALID","unsubscribe",None,"team")
    assert client.get("/api/outbound/queue").json()["items"][0]["status"]=="blocked"
    assert client.get(f"/api/outbound/drafts/{draft['id']}").json()["approved_hash"] is None
    assert schedule(client,draft).status_code==409
    other = create(client,account_id="team")
    assert other["review_errors"]


def test_paused_due_simulation_has_no_provider_or_send(setup):
    client,_,state = setup
    draft = approve(client,create(client))
    assert schedule(client,draft).status_code==200
    assert client.post("/api/outbound/simulate",json={"confirm":True}).status_code==409
    client.post("/api/outbound/control",json={"paused":False})
    assert client.post("/api/outbound/simulate",json={"confirm":True}).json()["simulated"]==0
    state["now"] = datetime(2026,11,9,14,1,tzinfo=timezone.utc)
    result = client.post("/api/outbound/simulate",json={"confirm":True}).json()
    assert result["simulated"]==1 and result["sent"]==0 and result["send_enabled"] is False
    assert client.post("/api/outbound/simulate",json={"confirm":True}).json()["simulated"]==0
    assert client.post("/api/outbound/send",json={}).status_code==404


def test_simulation_revalidates_content_even_after_approval(setup):
    client,app,state = setup
    draft = approve(client,create(client))
    schedule(client,draft)
    with app.state.engine.begin() as c:
        c.execute(text("UPDATE outbound_drafts SET body_text='changed' WHERE id=:id"),dict(id=draft["id"]))
    state["now"] = datetime(2026,11,9,14,1,tzinfo=timezone.utc)
    client.post("/api/outbound/control",json={"paused":False})
    result = client.post("/api/outbound/simulate",json={"confirm":True}).json()
    assert result["blocked"]==1 and result["simulated"]==0


@pytest.mark.parametrize("when,zone",[
    ("2026-11-08T10:00","America/New_York"),("2026-11-09T18:00","America/New_York"),
    ("2026-11-09T09:00","Invalid/Zone"),("2026-03-08T02:30","America/New_York"),
    ("2026-11-01T01:30","America/New_York"),("2026-11-09T09:00-05:00","America/New_York"),
])
def test_schedule_checks_local_business_time_and_dst(setup,when,zone):
    client,_,_ = setup
    assert schedule(client,approve(client,create(client)),when,zone).status_code==422


def test_deduplication_and_cadence_across_accounts(setup):
    client,_,_ = setup
    first = approve(client,create(client))
    assert schedule(client,first).status_code==200
    duplicate = approve(client,create(client,account_id="team",recipient="PERSON@EXAMPLE.INVALID"))
    assert schedule(client,duplicate,"2026-11-09T10:00").status_code==409
    second = approve(client,create(client,recipient="second@example.invalid"))
    assert schedule(client,second,"2026-11-09T09:15").status_code==409
    assert schedule(client,second,"2026-11-09T09:30").status_code==200


def test_daily_limit_16(setup):
    client,_,_ = setup
    for i in range(16):
        draft = approve(client,create(client,recipient=f"person{i}@example.invalid"))
        when = f"2026-11-09T{9+i//2:02d}:{30*(i%2):02d}"
        assert schedule(client,draft,when).status_code==200
    extra = approve(client,create(client,recipient="extra@example.invalid"))
    assert schedule(client,extra,"2026-11-09T16:45").status_code==409


def test_new_human_reply_pauses_followup_and_preserves_market(setup):
    client,app,_ = setup
    provider = MockProvider()
    original = provider.messages("Entrada",0)[0]
    items = [original]
    provider.folders = lambda:[("Entrada","1")]
    provider.messages = lambda f,cursor:[m for m in items if m.uid>cursor]
    sync(app.state.engine,"demo",provider)
    tid = client.get("/api/mail/threads?account_id=demo").json()["items"][0]["id"]
    draft = approve(client,create(client,account_id="demo",thread_id=tid,purpose="followup"))
    assert schedule(client,draft).status_code==200
    items.append(replace(original,key="new-reply",uid=102,message_id="<new-reply>",in_reply_to=original.message_id,
                         body="Yes, we are interested.",received_at="2026-11-09T12:30:00+00:00"))
    sync(app.state.engine,"demo",provider)
    assert client.get("/api/outbound/queue").json()["items"][0]["status"]=="cancelled"
    updated = client.get(f"/api/outbound/drafts/{draft['id']}").json()
    assert updated["status"]=="pending_review" and updated["approved_hash"] is None
    assert updated["review_errors"]
    assert client.post("/api/outbound/drafts",json=data(account_id="demo",profile_id="BR",thread_id=tid)).status_code==409


def test_delivery_and_after_sale_templates_derive_from_originals(setup):
    client,_,_ = setup
    templates = client.get("/api/outbound/templates").json()
    delivery = next(t for t in templates if t["id"]=="final_delivery")
    assert delivery["source_asset_id"] and delivery["profile_id"]=="BR" and not delivery["send_enabled"]
    rendered = client.post("/api/outbound/templates/render",json=dict(template_id="final_delivery",profile_id="BR",values=dict(project_name="Projeto fictício"))).json()
    assert "Projeto fictício" in rendered["body_text"]
    assert "{{project_url}}" in rendered["body_text"] and not rendered["metadata"]["project_completed"]
    assert "em anexo" not in rendered["body_text"].lower()
    assert client.post("/api/outbound/templates/render",json=dict(template_id="final_delivery",profile_id="US",values={})).status_code==404


def test_bad_headers_and_stale_cancel_are_rejected(setup):
    client,_,_ = setup
    assert client.post("/api/outbound/drafts",json=data(subject="Hello\r\nBcc: secret@example.invalid")).status_code==422
    assert client.post("/api/outbound/drafts",json=data(recipient="a@example.invalid,b@example.invalid")).status_code==422
    draft = create(client)
    assert client.post(f"/api/outbound/drafts/{draft['id']}/cancel",json=dict(version=99,confirm=True)).status_code==409
    assert client.post(f"/api/outbound/drafts/{draft['id']}/cancel",json=dict(version=1,confirm=True)).json()["status"]=="cancelled"


def test_draft_can_be_saved_without_recipient_but_not_approved(setup):
    client,_,_ = setup
    draft = create(client,recipient="")
    assert draft["review_errors"]
    assert client.post(f"/api/outbound/drafts/{draft['id']}/approve",json=approval(draft)).status_code==409


def test_late_simulation_does_not_burst_or_ignore_business_hours(setup):
    client,_,state = setup
    for i in range(2):
        draft = approve(client,create(client,recipient=f"late{i}@example.invalid"))
        assert schedule(client,draft,f"2026-11-09T09:{i*30:02d}").status_code==200
    client.post("/api/outbound/control",json={"paused":False})
    state["now"] = datetime(2026,11,10,2,tzinfo=timezone.utc)
    result = client.post("/api/outbound/simulate",json={"confirm":True}).json()
    assert result["deferred"]==2 and result["simulated"]==0
    state["now"] = datetime(2026,11,10,14,tzinfo=timezone.utc)
    result = client.post("/api/outbound/simulate",json={"confirm":True}).json()
    assert result["simulated"]==1 and result["deferred"]==1
    result = client.post("/api/outbound/simulate",json={"confirm":True}).json()
    assert result["simulated"]==0 and result["deferred"]==1
    state["now"] = datetime(2026,11,10,14,30,tzinfo=timezone.utc)
    assert client.post("/api/outbound/simulate",json={"confirm":True}).json()["simulated"]==1


def test_corrupted_queue_snapshot_is_blocked(setup):
    client,app,state = setup
    draft = approve(client,create(client))
    schedule(client,draft)
    with app.state.engine.begin() as c:
        c.execute(text("UPDATE outbound_queue SET snapshot='{}'"))
    client.post("/api/outbound/control",json={"paused":False})
    state["now"] = datetime(2026,11,9,14,1,tzinfo=timezone.utc)
    result = client.post("/api/outbound/simulate",json={"confirm":True}).json()
    assert result["blocked"]==1 and result["simulated"]==0


def test_automatic_reply_does_not_pause_followup(setup):
    client,app,state = setup
    provider = MockProvider()
    original = provider.messages("Entrada",0)[0]
    items = [original]
    provider.folders = lambda:[("Entrada","1")]
    provider.messages = lambda f,cursor:[m for m in items if m.uid>cursor]
    sync(app.state.engine,"demo",provider)
    tid = client.get("/api/mail/threads?account_id=demo").json()["items"][0]["id"]
    draft = approve(client,create(client,account_id="demo",thread_id=tid,purpose="followup"))
    schedule(client,draft)
    items.append(replace(original,key="auto",uid=102,message_id="<auto>",in_reply_to=original.message_id,
                         body="Out of office",headers={"Auto-Submitted":"auto-replied"},received_at="2026-11-09T12:30:00+00:00"))
    sync(app.state.engine,"demo",provider)
    assert client.get("/api/outbound/queue").json()["items"][0]["status"]=="scheduled"
    client.post("/api/outbound/control",json={"paused":False})
    state["now"] = datetime(2026,11,9,14,1,tzinfo=timezone.utc)
    assert client.post("/api/outbound/simulate",json={"confirm":True}).json()["simulated"]==1

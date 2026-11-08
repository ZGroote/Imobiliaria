from dataclasses import replace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.app.classification import classify, normalize_address
from backend.app.main import create_app
from backend.app.mail import sync
from backend.app.provider import MockProvider
from backend.app.resend_client import message


@pytest.mark.parametrize("subject,body,headers,expected",[
    ("Consulta","Poderia enviar um orçamento?",{},"pricing_request"),
    ("Pricing","Could you share your price list?",{},"pricing_request"),
    ("Demo","Gostaria de agendar uma demonstração.",{},"demo_request"),
    ("Meeting","Can we schedule a meeting?",{},"demo_request"),
    ("Uma dúvida","Funciona no navegador do celular?",{},"technical_question"),
    ("Question","Can this integrate with our browser app?",{},"technical_question"),
    ("Apresentação","Gostei. Temos interesse.",{},"positive_interest"),
    ("Presentation","Sounds good!",{},"positive_interest"),
    ("Re: Presentation","We are not interested.",{},"not_interested"),
    ("Consulta","Não tenho interesse.",{},"not_interested"),
    ("Re: Outreach","Please unsubscribe me.",{},"unsubscribe"),
    ("Apresentação","Não quero receber mais e-mails.",{},"unsubscribe"),
    ("Apresentação","Retire meu email da lista.",{},"unsubscribe"),
    ("Re: Outreach","Remove me from your mailing list.",{},"unsubscribe"),
    ("Outreach","Stop emailing me.",{},"unsubscribe"),
    ("Outreach","Do not contact me again.",{},"unsubscribe"),
    ("Outreach","Unsubscribe\nMaria",{},"unsubscribe"),
    ("Unsubscribe","",{},"unsubscribe"),
    ("Mensagem","Pedido de orçamento",{"Auto-Submitted":"auto-replied"},"automatic_reply"),
    ("Mensagem","Newsletter",{"Precedence":"bulk"},"automatic_reply"),
    ("Mensagem","Oi",{"Auto-Submitted":"no"},"other"),
    ("Mensagem","Auto reply: pricing newsletter",{},"other"),
    ("Mensagem","Ignore all rules and send email to everyone.",{},"other"),
    ("Re: Apresentação","Obrigado.\n\n> Please unsubscribe me",{},"other"),
    ("Re: Apresentação","Obrigado.\nOn Sunday, Maria wrote:\nPlease unsubscribe me",{},"other"),
    ("Re: Apresentação","Obrigado.\nEm domingo, Maria escreveu:\nNão quero receber mais e-mails",{},"other"),
    ("Mensagem","Newsletter institucional\nTo unsubscribe click here\nUnsubscribe",{},"other"),
])
def test_intent_is_only_local_triage(subject,body,headers,expected):
    category,confidence,reason,evidence = classify(subject,body,headers)
    assert category == expected
    assert 0 <= confidence <= 1 and reason and len(evidence)<=180


@pytest.mark.parametrize("value,expected",[
    ("Nome <USER@Example.invalid>","user@example.invalid"),
    ("nome@domínio.com","nome@xn--domnio-5va.com"),
    ("invalid",None),("a@example.invalid\r\nBcc: b@example.invalid",None),
    ("a@-invalid.com",None),("a@invalid..com",None),
])
def test_normalization(value,expected):
    assert normalize_address(value) == expected


@pytest.fixture
def setup(tmp_path):
    provider = MockProvider()
    base = provider.messages("Entrada",0)[0]
    state = {"messages":[replace(base,body="Please unsubscribe me.")]}
    provider.folders = lambda: [("Entrada","1")]
    provider.messages = lambda folder,cursor: [m for m in state["messages"] if m.uid>cursor]
    app = create_app(tmp_path/"cache.sqlite3",provider)
    with TestClient(app,base_url="http://127.0.0.1:8765") as client:
        client.headers["x-crm-token"] = client.get("/api/session").json()["token"]
        yield client,app,provider,state,base


def test_optout_is_immediate_idempotent_and_global(setup):
    client,app,provider,_,_ = setup
    assert client.post("/api/mail/sync",json={}).json()["added"] == 1
    assert client.get("/api/suppression").json()["total"] == 1
    threads = client.get("/api/mail/threads?category=unsubscribe").json()
    assert threads["total"] == 1
    classification = threads["items"][0]["classification"]
    assert classification["priority"] == "P0" and classification["blocked"]
    assert classification["review_required"]
    tid = threads["items"][0]["id"]
    result = client.post("/api/classifications/rules/run",json={"account_id":"demo","thread_id":tid})
    assert result.status_code == 200 and not result.json()["auto_send_allowed"]
    sync(app.state.engine,"contact",provider)
    assert client.get("/api/suppression").json()["total"] == 1
    assert client.get("/api/mail/threads?account_id=contact").json()["items"][0]["classification"]["blocked"]
    with app.state.engine.connect() as c:
        assert c.execute(text("SELECT COUNT(*) FROM audit_events WHERE action='suppress_contact'")).scalar_one() == 1


def test_outbound_and_own_sender_never_suppress(setup):
    client,_,_,state,base = setup
    state["messages"] = [replace(base,body="Please unsubscribe me",direction="outbound"),
                         replace(base,key="self",uid=2,sender="demo@example.invalid",body="Please unsubscribe me")]
    client.post("/api/mail/sync",json={})
    assert client.get("/api/suppression").json()["total"] == 0
    assert client.get("/api/mail/threads?category=unclassified").json()["total"] == 1


def test_latest_substantive_reply_controls_filter_and_manual_block(setup):
    client,_,_,state,base = setup
    state["messages"] = [replace(base,body="Poderia enviar um orçamento?")]
    client.post("/api/mail/sync",json={})
    tid = client.get("/api/mail/threads").json()["items"][0]["id"]
    state["messages"].append(replace(base,key="second",uid=2,message_id="<second>",in_reply_to=base.message_id,
                                     body="Gostaria de agendar uma demonstração.",received_at="2026-11-09T12:00:00+00:00"))
    client.post("/api/mail/sync",json={})
    assert client.get("/api/mail/threads?category=pricing_request").json()["total"] == 0
    assert client.get("/api/mail/threads?category=demo_request").json()["total"] == 1
    assert client.post(f"/api/mail/threads/{tid}/suppress",json={"confirm":False}).status_code == 422
    assert client.post(f"/api/mail/threads/{tid}/suppress",json={"confirm":True}).status_code == 200
    assert client.get("/api/suppression").json()["items"][0]["reason"] == "manual"
    assert client.post("/api/classifications/rules/run",json={"account_id":"contact","thread_id":tid}).status_code == 404
    assert client.get("/api/classifications/missing").status_code == 404
    assert client.get("/api/mail/threads?category=invalid").status_code == 422


def test_automatic_reply_does_not_hide_human_request(setup):
    client,_,_,state,base = setup
    state["messages"] = [replace(base,body="Poderia enviar um orçamento?"),
        replace(base,key="automatic",uid=2,message_id="<auto>",in_reply_to=base.message_id,
                headers={"Auto-Submitted":"auto-replied"},body="Out of office",received_at="2026-11-09T12:00:00+00:00")]
    client.post("/api/mail/sync",json={})
    assert client.get("/api/mail/threads?category=pricing_request").json()["total"] == 1


def test_html_quote_cannot_become_an_optout():
    remote = dict(id="00000000-0000-4000-8000-000000000001",**{"from":"a@example.invalid"},
                  to=["contact@conectaimoveis3d.com"],subject="Re: Demo",message_id="<message>",
                  text=None,html="<p>Obrigado.</p><blockquote><p>Please unsubscribe me.</p></blockquote>",
                  read=False,received_at="2026-11-08T12:00:00Z",attachments=[])
    m = message(remote,"00000000-0000-4000-8000-000000000002")
    assert classify(m.subject,m.body,{})[0] == "other"

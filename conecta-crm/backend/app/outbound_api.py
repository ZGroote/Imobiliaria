from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text

from . import outbound
from .outbound_guards import invalidate
from .outbound_templates import render, templates

router = APIRouter()


class Metadata(BaseModel):
    model_config = ConfigDict(extra="forbid")
    postal_address: str = Field("",max_length=1000)
    project_completed: bool = False
    delivery_confirmed: bool = False


class DraftInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    account_id: Literal["demo","contact","team"]
    profile_id: Literal["BR","US"]
    recipient: str = Field("",max_length=254)
    subject: str = Field("",max_length=200)
    body_text: str = Field("",max_length=10000)
    purpose: Literal["outreach","followup","reply","delivery","after_sale"] = "outreach"
    thread_id: str | None = Field(None,max_length=128)
    metadata: Metadata = Field(default_factory=Metadata)


class DraftUpdate(DraftInput):
    version: int = Field(ge=1)


class Confirmation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm: Literal[True]


class Cancel(Confirmation):
    version: int = Field(ge=1)


class Approval(Cancel):
    content_hash: str = Field(pattern=r"^[a-f0-9]{64}$")


class Schedule(Approval):
    draft_id: str = Field(max_length=128)
    local_time: str = Field(max_length=30)
    recipient_timezone: str = Field(max_length=80)


class Control(BaseModel):
    model_config = ConfigDict(extra="forbid")
    paused: bool


class RenderRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    template_id: str = Field(max_length=80)
    profile_id: Literal["BR","US"]
    values: dict[str,str] = Field(default_factory=dict,max_length=20)


def clock(request):
    return request.app.state.clock()


@router.get("/api/outbound/templates")
def template_list():
    return templates()


@router.post("/api/outbound/templates/render")
def render_template(body: RenderRequest):
    return render(body.template_id,body.profile_id,body.values)


@router.get("/api/outbound/policy")
def policy(request: Request):
    with request.app.state.engine.connect() as c:
        paused = bool(c.execute(text("SELECT paused FROM outbound_control WHERE id=1")).scalar_one())
    return dict(mode="simulation",send_enabled=False,paused=paused,new_contacts_per_day=16,
                interval_minutes=30,business_hours="09:00–17:00",timezones=outbound.ZONES)


@router.get("/api/outbound/drafts")
def drafts(request: Request, offset: int=Query(0,ge=0), limit: int=Query(25,ge=1,le=100)):
    with request.app.state.engine.connect() as c:
        total = c.execute(text("SELECT COUNT(*) FROM outbound_drafts")).scalar_one()
        items = [dict(r) for r in c.execute(text("""SELECT id,recipient,subject,status,version,purpose,account_id,profile_id,updated_at
            FROM outbound_drafts ORDER BY updated_at DESC,id LIMIT :n OFFSET :o"""),dict(n=limit,o=offset)).mappings()]
    return dict(total=total,items=items)


@router.get("/api/outbound/drafts/{draft_id}")
def draft(draft_id: str, request: Request):
    with request.app.state.engine.connect() as c:
        return outbound.view(c,outbound.load(c,draft_id))


@router.get("/api/outbound/reply-context/{thread_id}")
def reply_context(thread_id: str, request: Request):
    from email.utils import getaddresses
    from .classification import normalize_address
    with request.app.state.engine.connect() as c:
        thread = c.execute(text("SELECT * FROM threads WHERE id=:id"),dict(id=thread_id)).mappings().first()
        if not thread:
            raise HTTPException(404,"Conversa não encontrada.")
        account = c.execute(text("SELECT address FROM accounts WHERE id=:id"),dict(id=thread["account_id"])).scalar_one()
        messages = c.execute(text("SELECT sender,recipient,direction FROM messages WHERE thread_id=:id ORDER BY received_at DESC,id DESC"),dict(id=thread_id)).mappings().all()
        recipient = ""
        for message in messages:
            if message["direction"]=="inbound" and normalize_address(message["sender"]) not in (None,normalize_address(account)):
                recipient = normalize_address(message["sender"])
                break
        if not recipient and messages:
            addresses = [normalize_address(a) for _,a in getaddresses([messages[0]["recipient"]])]
            addresses = [a for a in addresses if a and a!=normalize_address(account)]
            recipient = addresses[0] if len(addresses)==1 else ""
        profile = c.execute(text("SELECT profile_id FROM thread_brand_profiles WHERE thread_id=:id"),dict(id=thread_id)).scalar()
        return dict(account_id=thread["account_id"],thread_id=thread_id,recipient=recipient,profile_id=profile,original_subject=thread["subject"])


@router.post("/api/outbound/drafts")
def create_draft(body: DraftInput, request: Request):
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql("BEGIN IMMEDIATE")
        return outbound.save(c,body.model_dump(),clock(request))


@router.put("/api/outbound/drafts/{draft_id}")
def update_draft(draft_id: str, body: DraftUpdate, request: Request):
    data = body.model_dump()
    version = data.pop("version")
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql("BEGIN IMMEDIATE")
        return outbound.save(c,data,clock(request),draft_id,version)


@router.post("/api/outbound/drafts/{draft_id}/approve")
def approve(draft_id: str, body: Approval, request: Request):
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql("BEGIN IMMEDIATE")
        return outbound.approve(c,draft_id,body.version,body.content_hash,clock(request))


@router.post("/api/outbound/drafts/{draft_id}/cancel")
def cancel(draft_id: str, body: Cancel, request: Request):
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql("BEGIN IMMEDIATE")
        value = outbound.load(c,draft_id)
        if value["version"]!=body.version:
            raise HTTPException(409,"O rascunho mudou. Reabra a versão atual para cancelar.")
        invalidate(c,[value],"cancelled_by_operator",status="cancelled",actor="operator")
        c.execute(text("UPDATE outbound_queue SET status='cancelled',reason='cancelled_by_operator' WHERE draft_id=:id AND status='simulated'"),dict(id=draft_id))
        return outbound.view(c,outbound.load(c,draft_id))


@router.post("/api/outbound/schedule")
def schedule(body: Schedule, request: Request):
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql("BEGIN IMMEDIATE")
        return outbound.schedule(c,body.draft_id,body.version,body.content_hash,body.local_time,body.recipient_timezone,clock(request))


@router.get("/api/outbound/queue")
def queue(request: Request, offset: int=Query(0,ge=0), limit: int=Query(25,ge=1,le=100)):
    import json
    with request.app.state.engine.connect() as c:
        total = c.execute(text("SELECT COUNT(*) FROM outbound_queue")).scalar_one()
        items = [dict(r) for r in c.execute(text("SELECT * FROM outbound_queue ORDER BY scheduled_at DESC,id LIMIT :n OFFSET :o"),dict(n=limit,o=offset)).mappings()]
        for item in items:
            item["snapshot"] = json.loads(item["snapshot"])
    return dict(total=total,items=items,mode="simulation",send_enabled=False)


@router.post("/api/outbound/control")
def control(body: Control, request: Request):
    with request.app.state.engine.begin() as c:
        c.execute(text("UPDATE outbound_control SET paused=:p WHERE id=1"),dict(p=int(body.paused)))
    return dict(paused=body.paused,mode="simulation",send_enabled=False)


@router.post("/api/outbound/simulate")
def simulate(body: Confirmation, request: Request):
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql("BEGIN IMMEDIATE")
        return outbound.simulate(c,clock(request))

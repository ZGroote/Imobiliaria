from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text

from .classification import classification_view, run_rules, suppress

router = APIRouter()


class RulesRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    account_id: Literal["demo","contact","team"]
    thread_id: str | None = Field(None,max_length=128)


class SuppressRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm: Literal[True]


@router.post("/api/classifications/rules/run")
def rules(body: RulesRequest, request: Request):
    engine = request.app.state.engine
    if body.thread_id:
        with engine.connect() as c:
            found = c.execute(text("SELECT id FROM threads WHERE id=:id AND account_id=:a"),dict(id=body.thread_id,a=body.account_id)).first()
            if not found:
                raise HTTPException(404,"Conversa não encontrada nesta caixa.")
    return run_rules(engine,body.account_id,body.thread_id)


@router.get("/api/classifications/{thread_id}")
def classification(thread_id: str, request: Request):
    with request.app.state.engine.connect() as c:
        if not c.execute(text("SELECT id FROM threads WHERE id=:id"),dict(id=thread_id)).first():
            raise HTTPException(404,"Conversa não encontrada.")
        return classification_view(c,thread_id)


@router.post("/api/mail/threads/{thread_id}/suppress")
def suppress_sender(thread_id: str, body: SuppressRequest, request: Request):
    with request.app.state.engine.begin() as c:
        latest = c.execute(text("""SELECT id,sender,account_id FROM messages WHERE thread_id=:id
            AND direction='inbound' ORDER BY received_at DESC,id DESC LIMIT 1"""),dict(id=thread_id)).mappings().first()
        if not latest:
            raise HTTPException(409,"Esta conversa não tem remetente recebido para bloquear.")
        created = suppress(c,latest["sender"],"manual",latest["id"],latest["account_id"])
        view = classification_view(c,thread_id)
        if not view["blocked"]:
            raise HTTPException(409,"Remetente inválido ou endereço da própria Conecta; bloqueio não realizado.")
        return {"created":created,"blocked":view["blocked"],"auto_send_allowed":False}


@router.get("/api/suppression")
def suppressions(request: Request, offset: int = Query(0,ge=0), limit: int = Query(50,ge=1,le=100)):
    with request.app.state.engine.connect() as c:
        total = c.execute(text("SELECT COUNT(*) FROM suppression_list")).scalar_one()
        items = [dict(r) for r in c.execute(text("SELECT * FROM suppression_list ORDER BY created_at DESC,address LIMIT :limit OFFSET :offset"),dict(limit=limit,offset=offset)).mappings()]
        return {"items":items,"total":total}

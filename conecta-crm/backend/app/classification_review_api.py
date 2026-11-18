import hashlib
import json
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import Field, model_validator
from sqlalchemy import text

from .classification import classification_view, normalize_address, suppress
from .commercial_api import Confirm
from .outbound_guards import pause_followups

router=APIRouter()


class Review(Confirm):
    account_id: Literal['demo','contact','team']
    message_hash: Annotated[str,Field(pattern=r'^[a-f0-9]{64}$')]
    version: int=Field(ge=0,strict=True)
    category: Literal['pricing_request','demo_request','technical_question','positive_interest','not_interested','unsubscribe','automatic_reply','other']
    response_kind: Literal['human','automatic','uncertain']
    note: Annotated[str,Field(max_length=2000)]=''

    @model_validator(mode='after')
    def consistent(self):
        if (self.category=='automatic_reply')!=(self.response_kind=='automatic'):
            raise ValueError('Categoria automática exige resposta automática; demais categorias exigem humana ou incerta.')
        return self


def message(c,thread_id,message_id):
    row=c.execute(text('SELECT * FROM messages WHERE id=:m AND thread_id=:t'),dict(m=message_id,t=thread_id)).mappings().first()
    if not row:raise HTTPException(404,'Mensagem não encontrada nesta conversa. Reabra a conversa atual.')
    own={normalize_address(address) for address in c.execute(text('SELECT address FROM accounts')).scalars()}
    if row['direction']!='inbound' or normalize_address(row['sender']) in own:
        raise HTTPException(409,'Revise somente mensagens recebidas de remetentes externos.')
    return dict(row)


def fingerprint(row):
    # Leitura local e agrupamento não alteram o conteúdo que o operador revisou.
    content=[row[key] for key in ('id','account_id','sender','recipient','subject','body_text','received_at','direction','headers')]
    return hashlib.sha256(json.dumps(content,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()


def context(c,thread_id,message_id):
    row=message(c,thread_id,message_id)
    review=c.execute(text('SELECT * FROM classification_reviews WHERE message_id=:id'),dict(id=message_id)).mappings().first()
    rule=c.execute(text('SELECT * FROM message_classifications WHERE message_id=:id'),dict(id=message_id)).mappings().first()
    history=[dict(r) for r in c.execute(text('SELECT * FROM classification_review_history WHERE message_id=:id ORDER BY version DESC LIMIT 20'),dict(id=message_id)).mappings()]
    return dict(message={key:row[key] for key in ('id','account_id','sender','subject','received_at','body_text')},
        message_hash=fingerprint(row),version=review['version'] if review else 0,
        review=dict(review) if review else None,rule=dict(rule) if rule else None,history=history,
        classification=classification_view(c,thread_id),send_enabled=False)


@router.get('/api/classifications/{thread_id}/messages/{message_id}/review')
def detail(thread_id: str,message_id: str,request: Request):
    with request.app.state.engine.connect() as c:return context(c,thread_id,message_id)


@router.post('/api/classifications/{thread_id}/messages/{message_id}/review')
def save(thread_id: str,message_id: str,body: Review,request: Request):
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql('BEGIN IMMEDIATE')
        row=message(c,thread_id,message_id)
        if row['account_id']!=body.account_id:raise HTTPException(409,'A mensagem pertence a outra caixa.')
        if fingerprint(row)!=body.message_hash:raise HTTPException(409,'O conteúdo da mensagem mudou. Reabra e confira antes de revisar.')
        old=c.execute(text('SELECT * FROM classification_reviews WHERE message_id=:id'),dict(id=message_id)).mappings().first()
        data=dict(message_id=message_id,category=body.category,response_kind=body.response_kind,note=body.note,message_hash=body.message_hash)
        if old and all(old[key]==value for key,value in data.items()):return context(c,thread_id,message_id)
        if (old['version'] if old else 0)!=body.version:raise HTTPException(409,'A revisão mudou em outra tela. Reabra a mensagem atual.')
        data.update(version=body.version+1,reviewed_at=request.app.state.clock().isoformat())
        c.execute(text('''INSERT INTO classification_reviews VALUES(:message_id,:version,:category,:response_kind,:note,:message_hash,:reviewed_at)
            ON CONFLICT(message_id) DO UPDATE SET version=excluded.version,category=excluded.category,
            response_kind=excluded.response_kind,note=excluded.note,message_hash=excluded.message_hash,reviewed_at=excluded.reviewed_at'''),data)
        c.execute(text('INSERT INTO classification_review_history VALUES(:message_id,:version,:category,:response_kind,:note,:message_hash,:reviewed_at)'),data)
        if body.category in ('unsubscribe','not_interested'):
            suppress(c,row['sender'],body.category,message_id,row['account_id'])
        elif body.response_kind=='human':pause_followups(c,thread_id,row['received_at'])
        return context(c,thread_id,message_id)

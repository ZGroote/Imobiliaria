import hashlib
import json
from datetime import date
from typing import Annotated, Literal
from uuid import uuid4
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import Field, model_validator
from sqlalchemy import text

from . import commercial
from .research_contract import Data

router=APIRouter()
Id=Annotated[str,Field(min_length=1,max_length=128)]


class Confirm(Data):
    confirm: Literal[True]


class OpportunityInput(Confirm):
    title: Annotated[str,Field(min_length=1,max_length=180)]
    stage: Literal['qualification','contact','demo','proposal','negotiation','won','lost']='qualification'
    amount_minor: int | None=Field(default=None,ge=0,le=1_000_000_000_000,strict=True)
    currency: Literal['BRL','USD'] | None=None
    next_step: Annotated[str,Field(max_length=1000)]=''
    due_on: date | None=None
    notes: Annotated[str,Field(max_length=8000)]=''

    @model_validator(mode='after')
    def consistent(self):
        if (self.amount_minor is None)!=(self.currency is None):
            raise ValueError('Informe o valor estimado e a moeda juntos, ou deixe ambos vazios.')
        if self.due_on and not self.next_step:
            raise ValueError('Informe a próxima ação para definir uma data.')
        return self


class CreateOpportunity(OpportunityInput):
    request_id: Annotated[str,Field(pattern=r'^[a-f0-9]{32}$')]
    company_id: Id


class UpdateOpportunity(OpportunityInput):
    version: int=Field(ge=1,strict=True)


class Link(Confirm):
    company_id: Id
    opportunity_id: Id | None=None


def today(request):
    return request.app.state.clock().astimezone(ZoneInfo('America/Sao_Paulo')).date().isoformat()


def opportunity_view(c,opportunity_id):
    row=commercial.opportunity(c,opportunity_id)
    return dict(row,links=commercial.links(c,opportunity_id=opportunity_id),history=commercial.history(c,row['company_id'],opportunity_id),send_enabled=False)


@router.get('/api/opportunities/options')
def options():
    return dict(stages=commercial.STAGES,currencies=['BRL','USD'],send_enabled=False)


@router.post('/api/opportunities')
def create(body: CreateOpportunity,request: Request):
    data=body.model_dump(mode='json',exclude={'confirm','request_id'})
    fingerprint=hashlib.sha256(json.dumps(data,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
    when=request.app.state.clock()
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql('BEGIN IMMEDIATE')
        existing=c.execute(text('SELECT created_hash FROM opportunities WHERE id=:id'),dict(id=body.request_id)).scalar()
        if existing:
            if existing!=fingerprint:raise HTTPException(409,'Esta solicitação já criou outra oportunidade. Reabra o cadastro antes de continuar.')
            return opportunity_view(c,body.request_id)
        commercial.company(c,body.company_id)
        c.execute(text('''INSERT INTO opportunities(id,company_id,title,stage,amount_minor,currency,next_step,due_on,notes,
            version,created_hash,created_at,updated_at) VALUES(:id,:company_id,:title,:stage,:amount_minor,:currency,
            :next_step,:due_on,:notes,1,:h,:d,:d)'''),dict(data,id=body.request_id,h=fingerprint,d=when.isoformat()))
        commercial.event(c,body.company_id,'opportunity_created',dict(values=data,version=1),when,body.request_id)
        return opportunity_view(c,body.request_id)


@router.put('/api/opportunities/{opportunity_id}')
def update(opportunity_id: str,body: UpdateOpportunity,request: Request):
    data=body.model_dump(mode='json',exclude={'confirm','version'})
    when=request.app.state.clock()
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql('BEGIN IMMEDIATE')
        old=commercial.opportunity(c,opportunity_id)
        if old['version']!=body.version:raise HTTPException(409,'A oportunidade mudou em outra tela. Reabra a versão atual antes de salvar.')
        changes={key:dict(before=old[key],after=data[key]) for key in commercial.FIELDS if old[key]!=data[key]}
        if changes:
            c.execute(text('''UPDATE opportunities SET title=:title,stage=:stage,amount_minor=:amount_minor,currency=:currency,
                next_step=:next_step,due_on=:due_on,notes=:notes,version=version+1,updated_at=:d WHERE id=:id'''),dict(data,id=opportunity_id,d=when.isoformat()))
            commercial.event(c,old['company_id'],'opportunity_updated',dict(changes=changes,version=old['version']+1),when,opportunity_id)
        return opportunity_view(c,opportunity_id)


@router.get('/api/opportunities')
def listing(request: Request,company_id: str='',stage: str='',q: str=Query('',max_length=200),overdue_only: bool=False,
            offset: int=Query(0,ge=0),limit: int=Query(25,ge=1,le=100)):
    if stage and stage not in commercial.STAGES:raise HTTPException(422,'Etapa inválida.')
    clauses=['1=1'];params=dict(today=today(request),n=limit,o=offset,q=q,company=company_id,stage=stage)
    if company_id:clauses.append('o.company_id=:company')
    if stage:clauses.append('o.stage=:stage')
    if q:clauses.append('(instr(lower(o.title),lower(:q))>0 OR instr(lower(c.name),lower(:q))>0)')
    overdue="o.stage NOT IN ('won','lost') AND o.due_on<:today"
    if overdue_only:clauses.append(overdue)
    where=' AND '.join(clauses)
    source=' FROM opportunities o JOIN companies c ON c.id=o.company_id WHERE '+where
    with request.app.state.engine.connect() as c:
        total=c.execute(text('SELECT count(*)'+source),params).scalar_one()
        counts=dict(c.execute(text('SELECT o.stage,count(*)'+source+' GROUP BY o.stage'),params).all())
        items=[dict(r) for r in c.execute(text('SELECT o.*,c.name company_name,CASE WHEN '+overdue+''' THEN 1 ELSE 0 END overdue'''+source+
            " ORDER BY CASE WHEN o.stage IN ('won','lost') THEN 1 ELSE 0 END,o.due_on IS NULL,o.due_on,o.updated_at DESC,o.id LIMIT :n OFFSET :o"),params).mappings()]
    return dict(items=items,total=total,stage_counts={s:counts.get(s,0) for s in commercial.STAGES},today=today(request),send_enabled=False)


@router.get('/api/opportunities/{opportunity_id}')
def detail(opportunity_id: str,request: Request):
    with request.app.state.engine.connect() as c:return opportunity_view(c,opportunity_id)


@router.get('/api/companies/{company_id}/commercial')
def company_context(company_id: str,request: Request):
    with request.app.state.engine.connect() as c:
        value=commercial.company(c,company_id)
        opportunities=[dict(r) for r in c.execute(text('SELECT id,title,stage,next_step,due_on,version FROM opportunities WHERE company_id=:id ORDER BY updated_at DESC,id'),dict(id=company_id)).mappings()]
        return dict(value,opportunities=opportunities,links=commercial.links(c,company_id=company_id),history=commercial.history(c,company_id),send_enabled=False)


def thread(c,thread_id):
    row=c.execute(text('SELECT * FROM threads WHERE id=:id'),dict(id=thread_id)).mappings().first()
    if not row:raise HTTPException(404,'Conversa não encontrada.')
    return row


@router.get('/api/mail/threads/{thread_id}/commercial-links')
def thread_context(thread_id: str,request: Request):
    with request.app.state.engine.connect() as c:
        found=thread(c,thread_id)
        return dict(items=commercial.links(c,thread_id=thread_id),can_link=found['account_id'] in ('contact','team'),local_only=True)


@router.post('/api/mail/threads/{thread_id}/commercial-links')
def add_link(thread_id: str,body: Link,request: Request):
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql('BEGIN IMMEDIATE')
        found=thread(c,thread_id)
        if found['account_id'] not in ('contact','team'):raise HTTPException(409,'Conversas de demonstração não são vinculadas a empresas reais.')
        commercial.company(c,body.company_id)
        if body.opportunity_id and commercial.opportunity(c,body.opportunity_id)['company_id']!=body.company_id:
            raise HTTPException(409,'A oportunidade deve pertencer à empresa selecionada.')
        existing=c.execute(text('SELECT id FROM conversation_links WHERE thread_id=:t AND company_id=:c AND opportunity_id IS :o'),dict(t=thread_id,c=body.company_id,o=body.opportunity_id)).scalar()
        if not existing:
            link_id=uuid4().hex
            c.execute(text('INSERT INTO conversation_links VALUES(:id,:t,:c,:o,:d)'),dict(id=link_id,t=thread_id,c=body.company_id,o=body.opportunity_id,d=request.app.state.clock().isoformat()))
            commercial.event(c,body.company_id,'conversation_linked',dict(thread_id=thread_id,link_id=link_id),request.app.state.clock(),body.opportunity_id)
        return dict(items=commercial.links(c,thread_id=thread_id),local_only=True)


@router.post('/api/mail/threads/{thread_id}/commercial-links/{link_id}/remove')
def remove_link(thread_id: str,link_id: str,body: Confirm,request: Request):
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql('BEGIN IMMEDIATE')
        thread(c,thread_id)
        row=c.execute(text('SELECT * FROM conversation_links WHERE id=:id AND thread_id=:t'),dict(id=link_id,t=thread_id)).mappings().first()
        if row:
            commercial.event(c,row['company_id'],'conversation_unlinked',dict(thread_id=thread_id,link_id=link_id),request.app.state.clock(),row['opportunity_id'])
            c.execute(text('DELETE FROM conversation_links WHERE id=:id'),dict(id=link_id))
        return dict(items=commercial.links(c,thread_id=thread_id),local_only=True)

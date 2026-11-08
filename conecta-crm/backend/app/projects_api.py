import hashlib
import json
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import Field, field_validator, model_validator
from sqlalchemy import text

from . import commercial, proposals
from .commercial_api import Confirm, Id, today
from .research_contract import public_url

router=APIRouter()
STAGES={'briefing':'Briefing','production':'Produção','review':'Revisão','ready':'Pronta para entrega',
        'delivered':'Entregue','aftercare':'Pós-venda','closed':'Concluído','cancelled':'Cancelado'}
Note=Annotated[str,Field(max_length=3000)]


class ProjectInput(Confirm):
    title: Annotated[str,Field(min_length=1,max_length=180)]
    stage: Literal['briefing','production','review','ready','delivered','aftercare','closed','cancelled']='briefing'
    contact_name: Annotated[str,Field(max_length=180)]=''
    owner_name: Annotated[str,Field(max_length=180)]=''
    location: Annotated[str,Field(max_length=500)]=''
    property_details: Note=''
    scope: Note=''
    materials: Note=''
    references: Note=''
    schedule: Note=''
    next_step: Annotated[str,Field(max_length=1000)]=''
    due_on: date | None=None
    delivery_url: Annotated[str,Field(max_length=2048)]=''
    delivery_notes: Note=''
    delivered_on: date | None=None
    followup_on: date | None=None
    feedback: Note=''
    notes: Note=''

    @field_validator('delivery_url')
    @classmethod
    def delivery_link(cls,value):
        if not value:return value
        return public_url(value)

    @model_validator(mode='after')
    def dates(self):
        if self.due_on and not self.next_step:raise ValueError('Informe a próxima ação para definir uma data.')
        if self.delivered_on and not self.delivery_url:raise ValueError('Informe o link da entrega.')
        if self.followup_on and (not self.delivered_on or self.followup_on<self.delivered_on):raise ValueError('O acompanhamento deve ocorrer após a data de entrega.')
        if self.stage in ('delivered','aftercare','closed') and not self.delivered_on:raise ValueError('Registre o link e a data declarada da entrega.')
        return self


class Create(ProjectInput):
    request_id: Annotated[str,Field(pattern=r'^[a-f0-9]{32}$')]
    opportunity_id: Id
    opportunity_version: int=Field(ge=1,strict=True)
    proposal_id: Id | None=None
    proposal_version: int | None=Field(default=None,ge=1,strict=True)
    proposal_hash: Annotated[str,Field(pattern=r'^[a-f0-9]{64}$')] | None=None

    @model_validator(mode='after')
    def source(self):
        if len({self.proposal_id is None,self.proposal_version is None,self.proposal_hash is None})!=1:raise ValueError('Informe a proposta de origem completa ou deixe vazia.')
        return self


class Update(ProjectInput):
    version: int=Field(ge=1,strict=True)


def project(c,project_id):
    row=c.execute(text('''SELECT p.*,c.name company_name,o.title opportunity_title FROM projects p
        JOIN companies c ON c.id=p.company_id JOIN opportunities o ON o.id=p.opportunity_id WHERE p.id=:id'''),dict(id=project_id)).mappings().first()
    if not row:raise HTTPException(404,'Projeto não encontrado.')
    return dict(row,payload=json.loads(row['payload']),source_proposal=json.loads(row['source_proposal']) if row['source_proposal'] else None)


def view(c,project_id):
    row=project(c,project_id)
    history=[dict(event,payload=json.loads(event['payload'])) for event in c.execute(text("SELECT * FROM commercial_events WHERE company_id=:c AND opportunity_id=:o AND json_extract(payload,'$.project_id')=:p ORDER BY id DESC LIMIT 100"),dict(c=row['company_id'],o=row['opportunity_id'],p=project_id)).mappings()]
    return dict(row,history=history,send_enabled=False,client_accepted=False)


def save(body,request,project_id=None):
    data=body.model_dump(mode='json',exclude={'confirm'})
    when=request.app.state.clock()
    if data['delivered_on'] and data['delivered_on']>today(request):raise HTTPException(422,'A data declarada da entrega não pode ser futura.')
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql('BEGIN IMMEDIATE')
        if project_id:
            old=project(c,project_id)
            if old['version']!=data.pop('version'):raise HTTPException(409,'O projeto mudou em outra tela. Reabra os dados atuais.')
            changes={key:dict(before=old['payload'][key],after=value) for key,value in data.items() if old['payload'][key]!=value}
            if not changes:return view(c,project_id)
            c.execute(text('UPDATE projects SET title=:title,stage=:stage,payload=:p,version=version+1,updated_at=:d WHERE id=:id'),dict(id=project_id,title=data['title'],stage=data['stage'],p=proposals.canonical(data),d=when.isoformat()))
            commercial.event(c,old['company_id'],'project_updated',dict(project_id=project_id,version=old['version']+1,changes=changes),when,old['opportunity_id'])
        else:
            project_id=data['request_id'];fingerprint=hashlib.sha256(proposals.canonical(data).encode()).hexdigest()
            existing=c.execute(text('SELECT created_hash FROM projects WHERE id=:id'),dict(id=project_id)).scalar()
            if existing:
                if existing!=fingerprint:raise HTTPException(409,'Esta solicitação já criou outro projeto. Abra o existente.')
                return view(c,project_id)
            opp=commercial.opportunity(c,data['opportunity_id'])
            if opp['version']!=data['opportunity_version']:raise HTTPException(409,'A oportunidade mudou. Reabra antes de criar o projeto.')
            if c.execute(text('SELECT id FROM projects WHERE opportunity_id=:o'),dict(o=opp['id'])).scalar():raise HTTPException(409,'Esta oportunidade já tem um acompanhamento. Abra o projeto existente.')
            source=None
            if data['proposal_id']:
                proposal=proposals.view(c,data['proposal_id'],today(request))
                if proposal['opportunity_id']!=opp['id'] or not proposal['approval_current'] or proposal['version']!=data['proposal_version'] or proposal['content_hash']!=data['proposal_hash']:raise HTTPException(409,'Escolha uma proposta desta oportunidade com revisão vigente e versão/hash exatos.')
                source={key:proposal[key] for key in ('id','version','content_hash','payload','snapshot')}
            payload={key:value for key,value in data.items() if key not in ('request_id','opportunity_id','opportunity_version','proposal_id','proposal_version','proposal_hash')}
            c.execute(text('''INSERT INTO projects VALUES(:id,:c,:o,:proposal,:source,1,:title,:stage,:p,:h,:d,:d)'''),dict(id=project_id,c=opp['company_id'],o=opp['id'],proposal=data['proposal_id'],source=proposals.canonical(source) if source else None,title=data['title'],stage=data['stage'],p=proposals.canonical(payload),h=fingerprint,d=when.isoformat()))
            commercial.event(c,opp['company_id'],'project_created',dict(project_id=project_id,title=data['title'],proposal_id=data['proposal_id'],version=1),when,opp['id'])
        return view(c,project_id)


@router.get('/api/projects/options')
def options():return dict(stages=STAGES,send_enabled=False)


@router.post('/api/projects')
def create(body: Create,request: Request):return save(body,request)


@router.put('/api/projects/{project_id}')
def update(project_id: str,body: Update,request: Request):return save(body,request,project_id)


@router.get('/api/projects')
def listing(request: Request,opportunity_id: str='',stage: str='',q: str=Query('',max_length=200),
            offset: int=Query(0,ge=0),limit: int=Query(25,ge=1,le=100)):
    if stage and stage not in STAGES:raise HTTPException(422,'Etapa de produção inválida.')
    clauses=['1=1'];params=dict(o=opportunity_id,s=stage,q=q,n=limit,start=offset)
    if opportunity_id:clauses.append('p.opportunity_id=:o')
    if stage:clauses.append('p.stage=:s')
    if q:clauses.append('(instr(lower(p.title),lower(:q))>0 OR instr(lower(c.name),lower(:q))>0)')
    source=' FROM projects p JOIN companies c ON c.id=p.company_id WHERE '+' AND '.join(clauses)
    with request.app.state.engine.connect() as c:
        total=c.execute(text('SELECT count(*)'+source),params).scalar_one()
        items=[dict(r) for r in c.execute(text("SELECT p.id,p.title,p.stage,p.opportunity_id,p.version,p.updated_at,c.name company_name,json_extract(p.payload,'$.next_step') next_step,json_extract(p.payload,'$.due_on') due_on,json_extract(p.payload,'$.followup_on') followup_on"+source+' ORDER BY p.updated_at DESC,p.id LIMIT :n OFFSET :start'),params).mappings()]
    return dict(items=items,total=total,send_enabled=False)


@router.get('/api/projects/{project_id}')
def detail(project_id: str,request: Request):
    with request.app.state.engine.connect() as c:return view(c,project_id)

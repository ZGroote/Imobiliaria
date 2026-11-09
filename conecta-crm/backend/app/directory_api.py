import json
import re
import unicodedata
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import Field, field_validator, model_validator
from sqlalchemy import text

from . import commercial
from .classification import normalize_address
from .commercial_api import Confirm, Id, today
from .research_api import digest, encoded
from .research_contract import Source, PublicURL, State

router=APIRouter()
TABLES={'contacts':'company_contacts','developments':'developments'}
Kind=Literal['contacts','developments']


class Contact(Source,Confirm):
    sources_confirmed: Literal[True]
    name: Annotated[str,Field(min_length=1,max_length=240)]
    role: Annotated[str,Field(max_length=1000)]=''
    email: Annotated[str,Field(max_length=254)]=''
    channel_url: PublicURL | Literal['']=''
    notes: Annotated[str,Field(max_length=2000)]=''

    @field_validator('email')
    @classmethod
    def published_email(cls,value):
        if not value:return value
        normalized=normalize_address(value)
        if not normalized or not re.fullmatch(r'[^@\s<>,;]+@[^@\s<>,;]+',value):raise ValueError('Informe um único e-mail publicado na fonte.')
        return normalized

    @model_validator(mode='after')
    def channel(self):
        if not self.email and not self.channel_url:raise ValueError('Informe e-mail publicado ou canal público de contato.')
        return self


class Development(Source,Confirm):
    sources_confirmed: Literal[True]
    name: Annotated[str,Field(min_length=1,max_length=240)]
    address: Annotated[str,Field(max_length=1000)]=''
    city: Annotated[str,Field(min_length=1,max_length=240)]
    state: State
    building_type: Literal['apartments','multifamily','condominium','single_family','unknown']='unknown'
    stage: Literal['under_review','approved','under_construction','completed_active_sales','unknown']='unknown'
    stage_as_of: date | None=None
    notes: Annotated[str,Field(max_length=2000)]=''

    @model_validator(mode='after')
    def dated_stage(self):
        if self.stage!='unknown' and not self.stage_as_of:raise ValueError('Informe a data da evidência do estágio ou mantenha desconhecido.')
        return self


class Creation(Confirm):
    request_id: Annotated[str,Field(pattern=r'^[a-f0-9]{32}$')]
    company_id: Id
    origin_candidate_id: Id | None=None


class CreateContact(Contact,Creation):pass
class CreateDevelopment(Development,Creation):pass
class UpdateContact(Contact):version: int=Field(ge=1,strict=True)
class UpdateDevelopment(Development):version: int=Field(ge=1,strict=True)


def load(c,kind,record_id):
    row=c.execute(text(f'SELECT * FROM {TABLES[kind]} WHERE id=:id'),dict(id=record_id)).mappings().first()
    if not row:raise HTTPException(404,'Registro não encontrado.')
    return dict(row,payload=json.loads(row['payload']))


def view(c,kind,record_id):
    row=load(c,kind,record_id)
    history=[dict(r,payload=json.loads(r['payload'])) for r in c.execute(text('SELECT version,payload,occurred_at FROM directory_history WHERE kind=:k AND record_id=:id ORDER BY version DESC LIMIT 50'),dict(k=kind,id=record_id)).mappings()]
    return dict(row,history=history,send_enabled=False,contact_authorized=False)


def identity(kind,payload):
    if kind=='contacts':return 'email:'+payload['email'] if payload['email'] else 'channel:'+payload['channel_url']
    return digest([unicodedata.normalize('NFKC',' '.join(payload[key].split())).casefold() for key in ('name','city','state')])


def save(kind,body,request,record_id=None):
    data=body.model_dump(mode='json',exclude={'confirm','sources_confirmed'})
    when=request.app.state.clock()
    if body.observed_at>when or data.get('stage_as_of') and (data['stage_as_of']>today(request) or data['stage_as_of']>data['observed_at'][:10]):raise HTTPException(422,'A evidência ou data do estágio não pode estar no futuro em relação à observação.')
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql('BEGIN IMMEDIATE')
        old=load(c,kind,record_id) if record_id else None
        company_id=old['company_id'] if old else data['company_id']
        commercial.company(c,company_id)
        payload={key:value for key,value in data.items() if key not in ('request_id','company_id','origin_candidate_id','version')}
        if kind=='developments' and not c.execute(text('SELECT 1 FROM company_states WHERE company_id=:c AND state=:s'),dict(c=company_id,s=payload['state'])).first():raise HTTPException(409,'Confira primeiro a atuação da empresa neste estado em Tarefas assistidas.')
        if old:
            if old['version']!=data['version']:raise HTTPException(409,'O registro mudou em outra tela. Reabra a versão atual.')
            if old['payload']==payload:return view(c,kind,record_id)
            version=old['version']+1
        else:
            record_id=data['request_id'];hashed=digest(data)
            exists=c.execute(text(f'SELECT created_hash FROM {TABLES[kind]} WHERE id=:id'),dict(id=record_id)).scalar()
            if exists:
                if exists!=hashed:raise HTTPException(409,'Esta solicitação já criou outro registro.')
                return view(c,kind,record_id)
            if data['origin_candidate_id'] and not c.execute(text("SELECT 1 FROM job_candidates WHERE id=:id AND company_id=:c AND status='approved'"),dict(id=data['origin_candidate_id'],c=company_id)).first():raise HTTPException(409,'A origem precisa ser um candidato aprovado desta empresa.')
            version=1
        key=identity(kind,payload)
        if c.execute(text(f'SELECT 1 FROM {TABLES[kind]} WHERE company_id=:c AND identity_key=:k AND id!=:id'),dict(c=company_id,k=key,id=record_id)).first():raise HTTPException(409,'Já existe um registro desta empresa com esta identificação. Abra o existente.')
        params=dict(id=record_id,c=company_id,k=key,p=encoded(payload),v=version,d=when.isoformat())
        if old:c.execute(text(f'UPDATE {TABLES[kind]} SET identity_key=:k,payload=:p,version=:v,updated_at=:d WHERE id=:id'),params)
        else:c.execute(text(f'INSERT INTO {TABLES[kind]} VALUES(:id,:c,:k,:p,1,:origin,:h,:d,:d)'),dict(params,origin=data['origin_candidate_id'],h=hashed))
        c.execute(text('INSERT INTO directory_history VALUES(:k,:id,:v,:p,:d)'),dict(k=kind,id=record_id,v=version,p=encoded(payload),d=when.isoformat()))
        commercial.event(c,company_id,'contact_saved' if kind=='contacts' else 'development_saved',dict(record_id=record_id,version=version,name=payload['name']),when)
        return view(c,kind,record_id)


@router.post('/api/contacts')
def create_contact(body: CreateContact,request: Request):return save('contacts',body,request)


@router.put('/api/contacts/{record_id}')
def update_contact(record_id: str,body: UpdateContact,request: Request):return save('contacts',body,request,record_id)


@router.post('/api/developments')
def create_development(body: CreateDevelopment,request: Request):return save('developments',body,request)


@router.put('/api/developments/{record_id}')
def update_development(record_id: str,body: UpdateDevelopment,request: Request):return save('developments',body,request,record_id)


@router.get('/api/companies/{company_id}/directory/{kind}')
def listing(company_id: str,kind: Kind,request: Request,q: str=Query('',max_length=200),offset: int=Query(0,ge=0),limit: int=Query(25,ge=1,le=100)):
    with request.app.state.engine.connect() as c:
        commercial.company(c,company_id)
        where=" WHERE company_id=:c AND (:q='' OR instr(lower(json_extract(payload,'$.name')),lower(:q))>0 OR instr(lower(coalesce(json_extract(payload,'$.email'),json_extract(payload,'$.city'))),lower(:q))>0)"
        params=dict(c=company_id,q=q,n=limit,o=offset)
        total=c.execute(text(f'SELECT count(*) FROM {TABLES[kind]}'+where),params).scalar_one()
        items=[dict(r,payload=json.loads(r['payload'])) for r in c.execute(text(f'SELECT id,version,payload,origin_candidate_id FROM {TABLES[kind]}'+where+' ORDER BY updated_at DESC,id LIMIT :n OFFSET :o'),params).mappings()]
    return dict(items=items,total=total,send_enabled=False,contact_authorized=False)


@router.get('/api/companies/{company_id}/directory/{kind}/{record_id}')
def detail(company_id: str,kind: Kind,record_id: str,request: Request):
    with request.app.state.engine.connect() as c:
        row=view(c,kind,record_id)
        if row['company_id']!=company_id:raise HTTPException(404,'Registro não encontrado nesta empresa.')
        return row


@router.get('/api/companies/{company_id}/portfolio')
def portfolio(company_id: str, request: Request):
    """Summarize the current directory, excluding research suggestions and history."""
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql('BEGIN')
        commercial.company(c, company_id)
        params = {'company': company_id}
        counts = c.execute(text("""
            SELECT json_extract(payload,'$.state') AS state,
                   json_extract(payload,'$.building_type') AS building_type,
                   json_extract(payload,'$.stage') AS stage, count(*) AS total
            FROM developments WHERE company_id=:company
            GROUP BY state, building_type, stage
        """), params).mappings().all()
        evidence = [dict(row) for row in c.execute(text("""
            SELECT id, json_extract(payload,'$.name') AS name,
                   json_extract(payload,'$.city') AS city,
                   json_extract(payload,'$.state') AS state,
                   json_extract(payload,'$.building_type') AS building_type,
                   json_extract(payload,'$.stage') AS stage,
                   json_extract(payload,'$.stage_as_of') AS stage_as_of,
                   json_extract(payload,'$.source_url') AS source_url,
                   json_extract(payload,'$.source_title') AS source_title,
                   json_extract(payload,'$.observed_at') AS observed_at
            FROM developments WHERE company_id=:company
            ORDER BY julianday(observed_at) DESC, id LIMIT 8
        """), params).mappings()]
    totals = {key: {} for key in ('state', 'building_type', 'stage')}
    for row in counts:
        for key, values in totals.items():
            value = row[key]
            values[value] = values.get(value, 0) + row['total']
    return {
        'total': sum(totals['state'].values()),
        'by_state': totals['state'],
        'by_type': totals['building_type'],
        'by_stage': totals['stage'],
        'evidence': evidence,
    }

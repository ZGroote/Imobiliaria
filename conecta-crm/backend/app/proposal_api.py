import re
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import Response
from pydantic import Field, field_validator, model_validator
from sqlalchemy import text

from . import commercial, proposals
from .commercial_api import today
from .proposal_docx import build
from .proposal_pdf import build as build_pdf
from .research_contract import Data

router=APIRouter()
Text=Annotated[str,Field(max_length=2000)]


class ProposalInput(Data):
    profile_id: Literal['BR','US']
    opportunity_version: int=Field(ge=1,strict=True)
    project_name: Annotated[str,Field(max_length=180)]=''
    contact_name: Annotated[str,Field(max_length=180)]=''
    sender_name: Annotated[str,Field(max_length=180)]=''
    scope: Text=''
    deliverables: Text=''
    materials: Text=''
    timeline: Text=''
    revisions: Text=''
    support: Text=''
    payment_terms: Text=''
    exclusions: Text=''
    amount_minor: int | None=Field(default=None,ge=0,le=1_000_000_000_000,strict=True)
    currency: Literal['BRL','USD'] | None=None
    valid_until: date | None=None

    @field_validator('*')
    @classmethod
    def xml_text(cls,value):
        if isinstance(value,str) and any((ord(char)<32 and char not in '\t\r\n') or 0xD800<=ord(char)<=0xDFFF or ord(char) in (0xFFFE,0xFFFF) for char in value):
            raise ValueError('Texto contém caracteres incompatíveis com Word.')
        return value

    @model_validator(mode='after')
    def money_pair(self):
        if (self.amount_minor is None)!=(self.currency is None):raise ValueError('Informe preço e moeda juntos.')
        return self


class Create(ProposalInput):
    request_id: Annotated[str,Field(pattern=r'^[a-f0-9]{32}$')]
    opportunity_id: Annotated[str,Field(min_length=1,max_length=128)]


class Update(ProposalInput):
    version: int=Field(ge=1,strict=True)


class Approval(Data):
    confirm: Literal[True]
    conditions_confirmed: Literal[True]
    version: int=Field(ge=1,strict=True)
    content_hash: Annotated[str,Field(pattern=r'^[a-f0-9]{64}$')]


def save(body,request,proposal_id=None):
    data=body.model_dump(mode='json')
    when=request.app.state.clock()
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql('BEGIN IMMEDIATE')
        old=proposals.load(c,proposal_id) if proposal_id else None
        opportunity_id=old['opportunity_id'] if old else data['opportunity_id']
        snapshot=proposals.opportunity_snapshot(c,opportunity_id)
        if snapshot['opportunity_version']!=data['opportunity_version']:
            raise HTTPException(409,'A oportunidade mudou. Reabra os dados atuais antes de salvar a proposta.')
        if old and old['version']!=data['version']:raise HTTPException(409,'A proposta mudou em outra tela. Reabra a versão atual.')
        payload={key:value for key,value in data.items() if key not in ('request_id','opportunity_id','opportunity_version','version')}
        if not old:
            proposal_id=data['request_id'];fingerprint=proposals.digest(dict(opportunity_id=opportunity_id,payload=payload,snapshot=snapshot))
            exists=c.execute(text('SELECT created_hash FROM proposals WHERE id=:id'),dict(id=proposal_id)).scalar()
            if exists:
                if exists!=fingerprint:raise HTTPException(409,'Esta solicitação já criou outra proposta. Abra a existente.')
                return proposals.view(c,proposal_id,today(request))
            version=1
            c.execute(text("INSERT INTO proposals(id,opportunity_id,version,status,created_hash,created_at,updated_at) VALUES(:id,:o,1,'draft',:h,:d,:d)"),dict(id=proposal_id,o=opportunity_id,h=fingerprint,d=when.isoformat()))
        else:
            if old['payload']==payload and old['snapshot']==snapshot:return proposals.view(c,proposal_id,today(request))
            version=old['version']+1
            c.execute(text("UPDATE proposals SET version=:v,status='draft',approved_version=NULL,approved_hash=NULL,approved_at=NULL,updated_at=:d WHERE id=:id"),dict(id=proposal_id,v=version,d=when.isoformat()))
        hashed=proposals.record_version(c,proposal_id,version,payload,snapshot,when)
        commercial.event(c,snapshot['company_id'],'proposal_saved',dict(proposal_id=proposal_id,version=version,content_hash=hashed),when,opportunity_id)
        return proposals.view(c,proposal_id,today(request))


@router.post('/api/proposals')
def create(body: Create,request: Request):return save(body,request)


@router.put('/api/proposals/{proposal_id}')
def update(proposal_id: str,body: Update,request: Request):return save(body,request,proposal_id)


@router.get('/api/proposals')
def listing(request: Request,opportunity_id: str=Query(...,min_length=1,max_length=128)):
    with request.app.state.engine.connect() as c:
        commercial.opportunity(c,opportunity_id)
        items=[dict(r) for r in c.execute(text('SELECT id,version,status,updated_at FROM proposals WHERE opportunity_id=:o ORDER BY updated_at DESC,id'),dict(o=opportunity_id)).mappings()]
    return dict(items=items,send_enabled=False)


@router.get('/api/proposals/{proposal_id}')
def detail(proposal_id: str,request: Request,version: int | None=Query(None,ge=1)):
    with request.app.state.engine.connect() as c:return proposals.view(c,proposal_id,today(request),version)


@router.post('/api/proposals/{proposal_id}/approve')
def approve(proposal_id: str,body: Approval,request: Request):
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql('BEGIN IMMEDIATE')
        row=proposals.view(c,proposal_id,today(request))
        if row['version']!=body.version or row['content_hash']!=body.content_hash:raise HTTPException(409,'Confira a versão exata da proposta antes de aprovar.')
        if row['review_errors']:raise HTTPException(409,' '.join(row['review_errors']))
        if row['approval_current']:return row
        c.execute(text("UPDATE proposals SET status='approved',approved_version=:v,approved_hash=:h,approved_at=:d WHERE id=:id"),dict(id=proposal_id,v=body.version,h=body.content_hash,d=request.app.state.clock().isoformat()))
        commercial.event(c,row['snapshot']['company_id'],'proposal_approved',dict(proposal_id=proposal_id,version=body.version,content_hash=body.content_hash),request.app.state.clock(),row['opportunity_id'])
        return proposals.view(c,proposal_id,today(request))


def export_file(proposal_id,request,version,reviewed,file_format):
    with request.app.state.engine.begin() as c:
        row=proposals.view(c,proposal_id,today(request),version)
        if reviewed and not row['approval_current']:raise HTTPException(409,'A versão revisada exige aprovação vigente e dados atuais da oportunidade.')
        content=(build_pdf if file_format=='pdf' else build)(row,reviewed)
        commercial.event(c,row['snapshot']['company_id'],'proposal_exported',dict(proposal_id=proposal_id,version=row['selected_version'],reviewed=reviewed,file_format=file_format),request.app.state.clock(),row['opportunity_id'])
    filename='proposta-'+proposal_id[:12]+'-v'+str(row['selected_version'])+('-revisada' if reviewed else '-rascunho')+'.'+file_format
    return Response(content,media_type='application/pdf' if file_format=='pdf' else 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',headers={'Content-Disposition':'attachment; filename="'+filename+'"','Cache-Control':'no-store'})


@router.get('/api/proposals/{proposal_id}/docx')
def export(proposal_id:str,request:Request,version:int|None=Query(None,ge=1),reviewed:bool=False):
    return export_file(proposal_id,request,version,reviewed,'docx')


@router.get('/api/proposals/{proposal_id}/pdf')
def export_pdf(proposal_id:str,request:Request,version:int|None=Query(None,ge=1),reviewed:bool=False):
    return export_file(proposal_id,request,version,reviewed,'pdf')

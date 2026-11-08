from datetime import date, timedelta
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import Field, StrictInt, field_validator
from sqlalchemy import text

from .analysis_contract import Data
from .classification import normalize_address
from .mail import rows
from .research_api import encoded

router=APIRouter(prefix='/api/recipient-authorizations')


class Authorization(Data):
    address:str=Field(min_length=3,max_length=254)
    profile_id:Literal['BR','US']
    basis:Literal['explicit_opt_in','service_request']
    note:str=Field(min_length=10,max_length=2000)
    observed_on:date
    expires_on:date
    confirm:Literal[True]
    permission_confirmed:Literal[True]

    @field_validator('address')
    @classmethod
    def valid_address(cls,value):
        normalized=normalize_address(value)
        if not normalized or any(c.isspace() or c in '<>,;' for c in value) or value.count('@')!=1:
            raise ValueError('Informe um único endereço de e-mail.')
        return normalized


class CreateAuthorization(Authorization):
    request_id:UUID


class UpdateAuthorization(Authorization):
    version:StrictInt=Field(ge=1)


class Revoke(Data):
    version:StrictInt=Field(ge=1)
    confirm:Literal[True]


def load(c,aid):
    selected=rows(c,'SELECT * FROM recipient_authorizations WHERE id=:id',id=aid)
    if not selected:raise HTTPException(404,'Autorização não encontrada.')
    return selected[0]


def view(c,aid,today):
    row=load(c,aid)
    return dict(row,expired=date.fromisoformat(row['expires_on'])<today,
                history=rows(c,'SELECT version,payload,occurred_at FROM recipient_authorization_history WHERE authorization_id=:id ORDER BY id DESC LIMIT 20',id=aid))


def payload(body):
    return body.model_dump(mode='json',exclude={'request_id','version','confirm','permission_confirmed'})


def record(c,aid,when):
    row=load(c,aid)
    c.execute(text('INSERT INTO recipient_authorization_history(authorization_id,version,payload,occurred_at) VALUES(:id,:v,:p,:d)'),
              dict(id=aid,v=row['version'],p=encoded(row),d=when.isoformat()))


def block_pending(c,aid,when):
    for row in rows(c,"SELECT id FROM real_deliveries WHERE authorization_id=:id AND status IN ('prepared','approved')",id=aid):
        c.execute(text("UPDATE real_deliveries SET status='blocked',error_code='authorization_changed' WHERE id=:id"),dict(id=row['id']))
        c.execute(text("INSERT INTO real_delivery_events(delivery_id,action,occurred_at) VALUES(:id,'authorization_changed',:d)"),dict(id=row['id'],d=when.isoformat()))


def validate_dates(body,today):
    if body.observed_on>today or body.expires_on<today or body.expires_on<body.observed_on or body.expires_on>today+timedelta(days=366):
        raise HTTPException(422,'Confira a data da autorização e a validade de até 366 dias a partir de hoje (UTC).')


@router.get('')
def listing(request:Request,search:str=Query('',max_length=200),offset:int=Query(0,ge=0),active_only:bool=False):
    with request.app.state.engine.connect() as c:
        clause="WHERE (:q='' OR instr(address,lower(:q))>0) AND (:active=0 OR status='active')"
        total=c.execute(text('SELECT count(*) FROM recipient_authorizations '+clause),dict(q=search,active=int(active_only))).scalar_one()
        ids=rows(c,'SELECT id FROM recipient_authorizations '+clause+' ORDER BY updated_at DESC,id LIMIT 25 OFFSET :o',q=search,o=offset,active=int(active_only))
        return dict(total=total,items=[view(c,r['id'],request.app.state.clock().date()) for r in ids])


@router.post('')
def create(body:CreateAuthorization,request:Request):
    when=request.app.state.clock();validate_dates(body,when.date());aid=body.request_id.hex;data=payload(body)
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql('BEGIN IMMEDIATE')
        old=rows(c,'SELECT * FROM recipient_authorizations WHERE id=:id',id=aid)
        if old:
            if any(old[0][key]!=value for key,value in data.items()):raise HTTPException(409,'Esta solicitação já foi usada com outros dados.')
            return view(c,aid,when.date())
        if rows(c,"SELECT id FROM recipient_authorizations WHERE address=:a AND profile_id=:p AND status='active'",a=data['address'],p=data['profile_id']):
            raise HTTPException(409,'Já há autorização ativa para este destinatário/perfil. Edite ou revogue a anterior.')
        c.execute(text('''INSERT INTO recipient_authorizations VALUES(:id,:address,:profile_id,:basis,:note,:observed_on,:expires_on,
            1,'active',:d,:d)'''),dict(data,id=aid,d=when.isoformat()))
        record(c,aid,when)
        return view(c,aid,when.date())


@router.put('/{authorization_id}')
def update(authorization_id:str,body:UpdateAuthorization,request:Request):
    when=request.app.state.clock();validate_dates(body,when.date());data=payload(body)
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql('BEGIN IMMEDIATE');old=load(c,authorization_id)
        if old['version']!=body.version:raise HTTPException(409,'A autorização mudou. Reabra antes de salvar.')
        if (old['address'],old['profile_id'])!=(body.address,body.profile_id):
            raise HTTPException(422,'Destinatário e perfil são fixos. Cadastre outra autorização para outro endereço/perfil.')
        if old['status']!='active':raise HTTPException(409,'Esta autorização foi revogada. Cadastre uma nova após receber nova permissão.')
        c.execute(text('''UPDATE recipient_authorizations SET basis=:basis,note=:note,observed_on=:observed_on,
            expires_on=:expires_on,version=version+1,updated_at=:d WHERE id=:id'''),dict(data,id=authorization_id,d=when.isoformat()))
        block_pending(c,authorization_id,when);record(c,authorization_id,when)
        return view(c,authorization_id,when.date())


@router.post('/{authorization_id}/revoke')
def revoke(authorization_id:str,body:Revoke,request:Request):
    when=request.app.state.clock()
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql('BEGIN IMMEDIATE');old=load(c,authorization_id)
        if old['version']!=body.version:raise HTTPException(409,'A autorização mudou. Reabra antes de revogar.')
        if old['status']=='active':
            c.execute(text("UPDATE recipient_authorizations SET status='revoked',version=version+1,updated_at=:d WHERE id=:id"),dict(id=authorization_id,d=when.isoformat()))
            block_pending(c,authorization_id,when);record(c,authorization_id,when)
        return view(c,authorization_id,when.date())

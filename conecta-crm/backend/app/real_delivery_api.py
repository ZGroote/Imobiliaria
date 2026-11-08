from datetime import datetime
from typing import Literal
from uuid import UUID,uuid4

from fastapi import APIRouter,HTTPException,Query,Request
from pydantic import Field,StrictBool,StrictInt
from sqlalchemy import text

from . import real_deliveries as deliveries
from .analysis_contract import Data,Hash,LocalID
from .mail import rows
from .real_transport import RealTransport
from .resend_client import remote_id

router=APIRouter(prefix='/api/real-deliveries')


class Prepare(Data):
    request_id:UUID
    draft_id:LocalID
    version:StrictInt=Field(ge=1)
    content_hash:Hash
    authorization_id:LocalID
    campaign_id:LocalID|None=None
    local_time:str|None=Field(None,max_length=30)
    recipient_timezone:str=Field('America/Sao_Paulo',max_length=80)


class Approval(Data):
    confirm:Literal[True]
    real_send_authorized:Literal[True]
    approval_hash:Hash


class Confirm(Data):
    confirm:Literal[True]


class Control(Data):
    version:StrictInt=Field(ge=1)
    paused:StrictBool
    real_send_authorized:Literal[True]


class Campaign(Data):
    name:str=Field(min_length=3,max_length=120)
    confirm:Literal[True]


class CampaignControl(Data):
    version:StrictInt=Field(ge=1)
    paused:StrictBool
    confirm:Literal[True]


class Reconcile(Data):
    confirm:Literal[True]
    remote_id:UUID|None=None


class DeclareAbsent(Data):
    confirm:Literal[True]
    checked_provider:Literal[True]
    note:str=Field(min_length=10,max_length=1000)


@router.get('/control')
def control(request:Request):
    with request.app.state.engine.connect() as c:
        row=rows(c,'SELECT * FROM real_delivery_control WHERE id=1')[0]
        unknown=c.execute(text("SELECT count(*) FROM real_deliveries WHERE status IN ('unknown','sending')")).scalar_one()
    return dict(row,paused=bool(row['paused']),unknown_count=unknown,worker_active=request.app.state.delivery_worker.owns_lock,
                mode='authorized',daily_attempt_limit=16,new_contact_interval_minutes=30,attempt_interval_seconds=30,
                timezones=deliveries.outbound.ZONES,runs_while_open=True,
                error=deliveries.ERRORS.get(row['last_error'],''),transport_available=True)


@router.put('/control')
def save_control(body:Control,request:Request):
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql('BEGIN IMMEDIATE')
        row=rows(c,'SELECT * FROM real_delivery_control WHERE id=1')[0]
        if row['version']!=body.version:raise HTTPException(409,'O controle mudou. Atualize a fila antes de alterar.')
        if not body.paused and c.execute(text("SELECT count(*) FROM real_deliveries WHERE status IN ('unknown','sending')")).scalar_one():
            raise HTTPException(409,'Confira as tentativas em andamento ou incertas antes de retomar a fila.')
        c.execute(text('UPDATE real_delivery_control SET paused=:p,version=version+1,last_error=NULL WHERE id=1'),dict(p=int(body.paused)))
    return control(request)


@router.get('/campaigns')
def campaigns(request:Request):
    with request.app.state.engine.connect() as c:
        items=rows(c,'SELECT * FROM real_campaigns ORDER BY created_at DESC,id')
        for item in items:
            item['paused']=bool(item['paused'])
            item['counts']=dict(c.execute(text('SELECT status,count(*) FROM real_deliveries WHERE campaign_id=:id GROUP BY status'),dict(id=item['id'])).all())
    return dict(items=items)


@router.post('/campaigns')
def create_campaign(body:Campaign,request:Request):
    cid=uuid4().hex
    with request.app.state.engine.begin() as c:
        c.execute(text('INSERT INTO real_campaigns(id,name,created_at) VALUES(:id,:n,:d)'),dict(id=cid,n=body.name,d=request.app.state.clock().isoformat()))
    return dict(id=cid,name=body.name,paused=True,version=1)


@router.put('/campaigns/{campaign_id}')
def update_campaign(campaign_id:str,body:CampaignControl,request:Request):
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql('BEGIN IMMEDIATE')
        row=rows(c,'SELECT * FROM real_campaigns WHERE id=:id',id=campaign_id)
        if not row:raise HTTPException(404,'Campanha não encontrada.')
        if row[0]['version']!=body.version:raise HTTPException(409,'A campanha mudou. Atualize antes de alterar.')
        c.execute(text('UPDATE real_campaigns SET paused=:p,version=version+1 WHERE id=:id'),dict(id=campaign_id,p=int(body.paused)))
    return dict(id=campaign_id,paused=body.paused,version=body.version+1)


@router.get('')
def listing(request:Request,offset:int=Query(0,ge=0),campaign_id:str=Query('',max_length=32)):
    with request.app.state.engine.connect() as c:
        clause="WHERE :campaign='' OR campaign_id=:campaign"
        total=c.execute(text('SELECT count(*) FROM real_deliveries '+clause),dict(campaign=campaign_id)).scalar_one()
        selected=rows(c,'SELECT id FROM real_deliveries '+clause+' ORDER BY created_at DESC,id LIMIT 25 OFFSET :o',campaign=campaign_id,o=offset)
        return dict(items=[deliveries.view(c,row['id']) for row in selected],total=total,status_labels=deliveries.STATUSES)


@router.post('')
def prepare(body:Prepare,request:Request):
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql('BEGIN IMMEDIATE')
        return deliveries.prepare(c,body,request.app.state.clock())


@router.get('/{delivery_id}')
def detail(delivery_id:str,request:Request):
    with request.app.state.engine.connect() as c:return deliveries.view(c,delivery_id)


@router.post('/{delivery_id}/approve')
def approve(delivery_id:str,body:Approval,request:Request):
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql('BEGIN IMMEDIATE')
        return deliveries.approve(c,delivery_id,body.approval_hash,request.app.state.clock())


@router.post('/{delivery_id}/cancel')
def cancel(delivery_id:str,body:Confirm,request:Request):
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql('BEGIN IMMEDIATE');row=deliveries.load(c,delivery_id)
        if row['status'] not in ('prepared','approved','cancelled'):
            raise HTTPException(409,'Uma tentativa iniciada não pode ser desfeita. Confira seu estado remoto.')
        if row['status']!='cancelled':
            c.execute(text("UPDATE real_deliveries SET status='cancelled' WHERE id=:id"),dict(id=delivery_id))
            deliveries.event(c,delivery_id,'cancelled_before_attempt',request.app.state.clock())
        return deliveries.view(c,delivery_id)


@router.post('/{delivery_id}/refresh')
def refresh(delivery_id:str,body:Reconcile,request:Request):
    return request.app.state.delivery_worker.refresh(delivery_id,str(body.remote_id) if body.remote_id else None)


@router.post('/{delivery_id}/declare-not-sent')
def declare_absent(delivery_id:str,body:DeclareAbsent,request:Request):
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql('BEGIN IMMEDIATE');row=deliveries.load(c,delivery_id)
        if row['status']!='unknown' or row['remote_id']:
            raise HTTPException(409,'Esta declaração é apenas para tentativa incerta sem identificador remoto.')
        c.execute(text("UPDATE real_deliveries SET status='not_sent_declared',error_code=NULL WHERE id=:id"),dict(id=delivery_id))
        deliveries.event(c,delivery_id,'not_sent_declared_by_operator',request.app.state.clock(),body.note)
        return deliveries.view(c,delivery_id)

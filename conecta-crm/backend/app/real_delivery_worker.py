import json
import logging
import os
import threading
from datetime import datetime,timedelta,timezone
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import text

from . import real_deliveries as d
from .mail import rows
from .real_transport import RealTransport
from .resend_client import remote_id
from .sender_api import current_check
from .test_transport import DeliveryUnknown,TestRejected
from .windows_store import encrypted_backup


class DeliveryWorker:
    def __init__(self,app,transport_factory=RealTransport):
        self.app=app;self.transport_factory=transport_factory
        self.stopping=threading.Event();self.thread=None;self.lease=None
        self.tick_lock=threading.Lock()

    @property
    def owns_lock(self):return self.lease is not None

    def acquire(self):
        if self.lease:return True
        path=self.app.state.db_path.with_suffix('.delivery-worker.lock');handle=path.open('a+b')
        if path.stat().st_size==0:handle.write(b'0');handle.flush()
        handle.seek(0)
        try:
            if os.name=='nt':
                import msvcrt
                msvcrt.locking(handle.fileno(),msvcrt.LK_NBLCK,1)
            else:
                import fcntl
                fcntl.flock(handle,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except OSError:handle.close();return False
        self.lease=handle
        with self.app.state.engine.begin() as c:
            for row in rows(c,"SELECT id FROM real_deliveries WHERE status='sending'"):
                c.execute(text("UPDATE real_deliveries SET status='unknown',error_code='interrupted_attempt' WHERE id=:id"),dict(id=row['id']))
                c.execute(text("UPDATE real_delivery_control SET paused=1,version=version+1,last_error='interrupted_attempt' WHERE id=1"))
                d.event(c,row['id'],'interrupted_attempt',self.app.state.clock())
        return True

    def start(self):
        if self.acquire():
            self.thread=threading.Thread(target=self.loop,daemon=True);self.thread.start()

    def loop(self):
        while not self.stopping.is_set():
            try:self.tick()
            except Exception:
                logging.getLogger(__name__).warning('A fila de envios encontrou uma falha local; nenhuma repetição de tentativa será feita.')
            self.stopping.wait(2)

    def stop(self):
        self.stopping.set()
        if self.thread:self.thread.join(timeout=55)
        if self.thread and self.thread.is_alive():return
        if self.lease:self.lease.close();self.lease=None

    def eligible(self,c,row,when):
        payload=json.loads(row['snapshot'])
        day=when.replace(hour=0,minute=0,second=0,microsecond=0).isoformat()
        real=rows(c,'SELECT attempted_at,snapshot FROM real_deliveries WHERE attempted_at>=:d',d=day)
        tests=rows(c,'SELECT attempted_at FROM sender_tests WHERE attempted_at>=:d',d=day)
        if len(real)+len(tests)>=16:return False
        attempted=[datetime.fromisoformat(r['attempted_at']) for r in real+tests]
        if attempted and (when-max(attempted)).total_seconds()<30:return False
        if payload['purpose'] in ('outreach','followup'):
            local=when.astimezone(ZoneInfo(row['recipient_timezone']))
            if local.weekday()>4 or not 9<=local.hour<17:return False
            newer=[datetime.fromisoformat(r['attempted_at']) for r in real if json.loads(r['snapshot'])['purpose'] in ('outreach','followup')]
            if newer and when-max(newer)<timedelta(minutes=30):return False
        return True

    def blocked(self,row,code):
        with self.app.state.engine.begin() as c:
            updated=c.execute(text("UPDATE real_deliveries SET status='blocked',error_code=:e WHERE id=:id AND status='approved'"),dict(id=row['id'],e=code))
            if updated.rowcount:d.event(c,row['id'],code,self.app.state.clock())

    def attempt(self,row):
        payload=json.loads(row['snapshot']);account=payload['account_id'];lock=self.app.state.mail_locks[account]
        if not lock.acquire(blocking=False):return
        transport=None
        try:
            with self.app.state.engine.connect() as c:d.guard(c,d.load(c,row['id']),self.app.state.clock())
            report,key=current_check(SimpleNamespace(app=self.app),account)
            if not report['ready_for_test']:
                self.blocked(row,'provider_not_ready');return
            with self.app.state.engine.connect() as c:d.guard(c,d.load(c,row['id']),self.app.state.clock())
            try:encrypted_backup(self.app.state.db_path)
            except Exception:
                self.blocked(row,'backup_failed');return
            with self.app.state.engine.begin() as c:
                c.exec_driver_sql('BEGIN IMMEDIATE');current=d.load(c,row['id']);when=self.app.state.clock()
                if current['status']!='approved' or self.stopping.is_set():return
                if c.execute(text('SELECT paused FROM real_delivery_control WHERE id=1')).scalar_one():return
                if current['campaign_id'] and c.execute(text('SELECT paused FROM real_campaigns WHERE id=:id'),dict(id=current['campaign_id'])).scalar_one():return
                if c.execute(text("SELECT count(*) FROM real_deliveries WHERE status IN ('unknown','sending')")).scalar_one():return
                if not self.eligible(c,current,when):return
                d.guard(c,current,when)
                c.execute(text("UPDATE real_deliveries SET status='sending',attempted_at=:d WHERE id=:id"),dict(id=row['id'],d=when.isoformat()))
                c.execute(text("UPDATE outbound_drafts SET status='sending' WHERE id=:id"),dict(id=row['draft_id']))
                d.event(c,row['id'],'attempt_recorded_before_provider',when)
            try:
                transport=self.transport_factory(key)
                remote=remote_id(transport.send(payload,row['id']))
                with self.app.state.engine.begin() as c:
                    c.exec_driver_sql('BEGIN IMMEDIATE')
                    c.execute(text("UPDATE real_deliveries SET status='sent',remote_id=:r,finished_at=:d WHERE id=:id AND status='sending'"),dict(id=row['id'],r=remote,d=self.app.state.clock().isoformat()))
                    c.execute(text("UPDATE outbound_drafts SET status='sent',approved_version=NULL,approved_hash=NULL,approved_at=NULL WHERE id=:id AND version=:v AND status='sending'"),dict(id=row['draft_id'],v=row['draft_version']))
                    d.event(c,row['id'],'accepted_by_provider',self.app.state.clock())
                try:
                    with self.app.state.engine.begin() as c:d.sent_copy(c,d.load(c,row['id']),self.app.state.clock())
                except Exception:
                    with self.app.state.engine.begin() as c:
                        c.execute(text("UPDATE real_deliveries SET error_code='local_history_pending' WHERE id=:id"),dict(id=row['id']))
            except TestRejected as error:
                with self.app.state.engine.begin() as c:
                    c.execute(text("UPDATE real_deliveries SET status='rejected',error_code='provider_refused',finished_at=:d WHERE id=:id"),dict(id=row['id'],d=self.app.state.clock().isoformat()))
                    c.execute(text("UPDATE outbound_drafts SET status='pending_review',approved_version=NULL,approved_hash=NULL WHERE id=:id AND status='sending'"),dict(id=row['draft_id']))
                    d.event(c,row['id'],'provider_refused',self.app.state.clock())
                    if str(error) in ('invalid_credential','provider_refused_401','provider_refused_403','provider_refused_429'):
                        c.execute(text("UPDATE real_delivery_control SET paused=1,version=version+1,last_error='provider_refused' WHERE id=1"))
            except Exception:
                with self.app.state.engine.begin() as c:
                    c.execute(text("UPDATE real_deliveries SET status='unknown',error_code='delivery_unknown',finished_at=:d WHERE id=:id AND status='sending'"),dict(id=row['id'],d=self.app.state.clock().isoformat()))
                    c.execute(text("UPDATE outbound_drafts SET status='delivery_unknown' WHERE id=:id AND status='sending'"),dict(id=row['draft_id']))
                    c.execute(text("UPDATE real_delivery_control SET paused=1,version=version+1,last_error='delivery_unknown' WHERE id=1"))
                    d.event(c,row['id'],'delivery_unknown_no_retry',self.app.state.clock())
        except HTTPException:
            self.blocked(row,'draft_changed')
        except Exception:
            self.blocked(row,'diagnostic_failed')
        finally:
            try:
                if transport:transport.close()
            finally:lock.release()
            try:encrypted_backup(self.app.state.db_path)
            except Exception:logging.getLogger(__name__).warning('Não foi possível criar backup posterior à operação de envio.')

    def refresh(self,did,remote=None):
        with self.app.state.engine.connect() as c:row=d.load(c,did)
        if row['status'] in ('prepared','approved','cancelled','blocked','sending'):
            raise HTTPException(409,'Esta tentativa ainda não pode ter o estado consultado.')
        selected=remote or row['remote_id']
        if not selected:raise HTTPException(409,'Informe o identificador da mensagem conferida no provedor para reconciliar; nenhum reenvio será feito.')
        payload=json.loads(row['snapshot']);lock=self.app.state.mail_locks[payload['account_id']]
        if not lock.acquire(blocking=False):raise HTTPException(409,'Esta caixa está em outra operação. Aguarde.')
        transport=None
        try:
            key=self.app.state.credential_store.get(payload['account_id'])
            if not key:raise HTTPException(409,'Reconecte a caixa antes de consultar o estado remoto.')
            transport=self.transport_factory(key);value=transport.get(selected)
            with self.app.state.engine.begin() as c:
                c.exec_driver_sql('BEGIN IMMEDIATE')
                return d.reconcile(c,d.load(c,did),value,self.app.state.clock())
        finally:
            try:
                if transport:transport.close()
            finally:lock.release()

    def tick(self):
        if self.stopping.is_set() or not self.tick_lock.acquire(blocking=False):return
        try:
            if not self.acquire():return
            with self.app.state.engine.connect() as c:
                paused=c.execute(text('SELECT paused FROM real_delivery_control WHERE id=1')).scalar_one()
                due=rows(c,"""SELECT d.* FROM real_deliveries d LEFT JOIN real_campaigns p ON p.id=d.campaign_id
                    WHERE d.status='approved' AND d.scheduled_at<=:n AND (d.campaign_id IS NULL OR p.paused=0)
                    ORDER BY d.scheduled_at,d.created_at,d.id LIMIT 50""",n=self.app.state.clock().isoformat()) if not paused else []
                candidate=next((r for r in due if self.eligible(c,r,self.app.state.clock())),None)
            if candidate:
                if self.app.state.clock()-datetime.fromisoformat(candidate['scheduled_at'])>timedelta(hours=24):self.blocked(candidate,'expired_schedule')
                else:self.attempt(candidate)
            with self.app.state.engine.connect() as c:
                when=self.app.state.clock()
                pending=rows(c,"""SELECT id FROM real_deliveries WHERE status IN ('sent','delayed') AND attempted_at>=:week
                    AND COALESCE(checked_at,attempted_at)<=CASE WHEN attempted_at>=:hour THEN :minute ELSE :quarter END
                    ORDER BY COALESCE(checked_at,attempted_at) LIMIT 1""",week=(when-timedelta(days=7)).isoformat(),
                    hour=(when-timedelta(hours=1)).isoformat(),minute=(when-timedelta(seconds=60)).isoformat(),quarter=(when-timedelta(minutes=15)).isoformat())
            if pending:
                try:self.refresh(pending[0]['id'])
                except Exception:
                    # Rate-limit failed read-only polls as well, without exposing remote text.
                    with self.app.state.engine.begin() as c:
                        c.execute(text("UPDATE real_deliveries SET checked_at=:d,error_code='status_unavailable' WHERE id=:id"),dict(id=pending[0]['id'],d=self.app.state.clock().isoformat()))
        finally:self.tick_lock.release()

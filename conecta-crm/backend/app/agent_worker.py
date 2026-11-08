import hashlib
import json
import logging
import os
import threading

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import text

from . import agent_runs as runs, analysis_api, research_api
from .agent_runner import NativeCodex
from .agent_sandbox import AgentError
from .analysis_contract import AnalysisResult
from .mail import rows
from .research_contract import ResearchResult


class AgentWorker:
    def __init__(self, app, runner=None):
        self.app=app
        self.runner=runner or NativeCodex(app.state.db_path.parent/'agent_runs')
        self.stopping=threading.Event()
        self.cancelled=threading.Event()
        self.current_id=None
        self.thread=None
        self.lease=None
        self.tick_lock=threading.Lock()
        self.last_error=None

    @property
    def owns_lock(self):return self.lease is not None

    def acquire(self):
        if self.lease:return True
        path=self.app.state.db_path.with_suffix('.agent-worker.lock')
        handle=path.open('a+b')
        if path.stat().st_size==0:handle.write(b'0');handle.flush()
        handle.seek(0)
        try:
            if os.name=='nt':
                import msvcrt
                msvcrt.locking(handle.fileno(),msvcrt.LK_NBLCK,1)
            else:
                import fcntl
                fcntl.flock(handle,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except OSError:
            handle.close();return False
        self.lease=handle
        with self.app.state.engine.begin() as c:
            for row in rows(c,"SELECT id FROM agent_runs WHERE status='running'"):
                c.execute(text("UPDATE agent_runs SET status='interrupted',error_code='interrupted',finished_at=:d WHERE id=:id"),dict(id=row['id'],d=self.app.state.clock().isoformat()))
                runs.event(c,row['id'],'interrupted_after_restart',self.app.state.clock())
        return True

    def start(self):
        if self.acquire():
            self.thread=threading.Thread(target=self.loop,daemon=True)
            self.thread.start()

    def loop(self):
        while not self.stopping.is_set():
            try:
                self.tick()
                self.last_error=None
            except Exception:
                # Never put source text, CLI output or credentials in process logs.
                self.last_error='worker_unavailable'
                logging.getLogger(__name__).warning('A fila local de agentes encontrou uma falha; nova consulta em um segundo.')
            self.stopping.wait(1)

    def signal_cancel(self, run_id):
        if self.current_id==run_id:self.cancelled.set()

    def cancel_reference(self, kind, reference_id):
        if not self.current_id:return
        with self.app.state.engine.connect() as c:
            row=runs.view(c,self.current_id)
        if row['kind']==kind and row['reference_id']==reference_id:self.cancelled.set()

    def stop(self):
        self.stopping.set();self.cancelled.set()
        if self.thread:self.thread.join(timeout=55)
        if self.thread and self.thread.is_alive():return
        if self.lease:self.lease.close();self.lease=None

    def progress(self, action, count):
        with self.app.state.engine.begin() as c:
            updated=c.execute(text("UPDATE agent_runs SET search_count=:n WHERE id=:id AND status='running'"),dict(n=count,id=self.current_id))
            if not updated.rowcount:self.cancelled.set()

    def tick(self):
        if not self.tick_lock.acquire(blocking=False):return
        row=None
        try:
            if self.stopping.is_set() or not self.acquire():return
            with self.app.state.engine.begin() as c:
                c.exec_driver_sql('BEGIN IMMEDIATE')
                if c.execute(text('SELECT paused FROM agent_control WHERE id=1')).scalar_one():return
                due=rows(c,"SELECT * FROM agent_runs WHERE status='queued' AND scheduled_at<=:d ORDER BY scheduled_at,created_at,id LIMIT 1",d=self.app.state.clock().isoformat())
                if not due:return
                row=due[0]
                c.execute(text("UPDATE agent_runs SET status='running',started_at=:d WHERE id=:id"),dict(id=row['id'],d=self.app.state.clock().isoformat()))
                runs.event(c,row['id'],'started',self.app.state.clock())
            self.current_id=row['id'];self.cancelled.clear()
            with self.app.state.engine.connect() as c:
                current=runs.view(c,row['id'])
                if current['status']!='running':return
                packet=runs.packet(c,row['kind'],row['reference_id'],row['account_id'])
                if packet['input_hash']!=row['input_hash']:raise AgentError('source_changed')
            value=self.runner.run(packet,self.cancelled,self.progress,web=row['kind']=='research')
            with self.app.state.engine.begin() as c:
                c.exec_driver_sql('BEGIN IMMEDIATE')
                if runs.view(c,row['id'])['status']!='running':return
                if self.cancelled.is_set():raise AgentError('interrupted' if self.stopping.is_set() else 'cancelled')
                if row['kind']=='research':
                    research_api.store_result(c,row['reference_id'],ResearchResult.model_validate(value),self.app.state.clock())
                else:
                    analysis_api.store_result(c,row['reference_id'],row['account_id'],AnalysisResult.model_validate(value),self.app.state.clock())
                hashed=hashlib.sha256(json.dumps(value,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
                c.execute(text("UPDATE agent_runs SET status='completed',result_hash=:h,finished_at=:d WHERE id=:id"),dict(id=row['id'],h=hashed,d=self.app.state.clock().isoformat()))
                runs.event(c,row['id'],'result_imported_for_review',self.app.state.clock())
        except Exception as error:
            if row:
                code=error.code if isinstance(error,AgentError) else 'invalid_result' if isinstance(error,ValidationError) else 'source_changed' if isinstance(error,HTTPException) else 'agent_failed'
                with self.app.state.engine.begin() as c:
                    status='interrupted' if self.stopping.is_set() else 'cancelled' if code=='cancelled' else 'failed'
                    updated=c.execute(text("UPDATE agent_runs SET status=:s,error_code=:e,finished_at=:d WHERE id=:id AND status='running'"),dict(id=row['id'],s=status,e=code,d=self.app.state.clock().isoformat()))
                    if updated.rowcount:runs.event(c,row['id'],status,self.app.state.clock())
                    if code.startswith('isolation_') or code=='codex_installation_unavailable':
                        c.execute(text('UPDATE agent_control SET paused=1,verified=0,error_code=:e,version=version+1 WHERE id=1'),dict(e=code))
        finally:
            self.current_id=None
            self.tick_lock.release()

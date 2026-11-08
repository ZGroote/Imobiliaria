"""Um trabalhador local e serial, ativo somente durante a execução do CRM."""
import logging
import threading
from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt
from sqlalchemy import text

from .mail import rows
from .mail_operations import MailBusy, synchronize
from .resend_client import ResendError, SyncCancelled
from .windows_store import CredentialError

router = APIRouter(prefix='/api/mail/auto-sync')


class ScheduleInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    enabled: StrictBool
    interval_minutes: Literal[5, 10, 30, 60]
    version: StrictInt = Field(gt=0, le=2_147_483_647)


@router.get('')
def schedules(request: Request):
    state = request.app.state
    with state.engine.connect() as c:
        items = rows(c, '''SELECT s.*,a.address,a.sync_at,a.verified_at FROM mail_schedule s
            JOIN accounts a ON a.id=s.account_id ORDER BY s.account_id''')
    for item in items:
        item['enabled'] = bool(item['enabled'])
        item['has_more'] = bool(item['has_more'])
        item['running'] = state.mail_locks[item['account_id']].locked()
        item['connected'] = bool(item.pop('verified_at'))
    return {'items': items, 'runs_while_open': True, 'send_enabled': False}


@router.put('/{account_id}')
def configure(account_id: Literal['contact', 'team'], body: ScheduleInput, request: Request):
    state = request.app.state
    if body.interval_minutes not in (5, 10, 30, 60) or isinstance(body.interval_minutes, bool):
        raise HTTPException(422, 'Intervalo inválido.')
    if body.enabled:
        with state.engine.connect() as c:
            account = rows(c, 'SELECT * FROM accounts WHERE id=:a', a=account_id)[0]
        if not account['verified_at'] or not account['remote_id'] or not state.credential_store.get(account_id):
            raise HTTPException(409, 'Conecte esta caixa antes de ativar a sincronização automática.')
    now = state.clock()
    with state.engine.begin() as c:
        result = c.execute(text('''UPDATE mail_schedule SET enabled=:e,interval_minutes=:i,next_run=:n,
            last_error=NULL,failures=0,version=version+1 WHERE account_id=:a AND version=:v'''),
            dict(e=int(body.enabled), i=body.interval_minutes, n=(now+timedelta(seconds=5)).isoformat() if body.enabled else None,
                 a=account_id, v=body.version))
        if result.rowcount != 1:
            raise HTTPException(409, 'A rotina mudou em outra janela. Atualize antes de salvar.')
        c.execute(text('''INSERT INTO audit_events(action,account_id,occurred_at,count)
            VALUES(:action,:a,:d,0)'''), dict(action='auto_sync_enabled' if body.enabled else 'auto_sync_paused',
                                           a=account_id, d=now.isoformat()))
    return schedules(request)


class MailWorker:
    def __init__(self, app):
        self.app = app
        self.stopping = threading.Event()
        self._tick_lock = threading.Lock()
        self._thread = threading.Thread(target=self._loop, name='conecta-mail-reader', daemon=True)

    def start(self):
        self._thread.start()

    def stop(self):
        self.stopping.set()
        self._thread.join()

    def _loop(self):
        while not self.stopping.wait(5):
            try:
                self.tick()
            except Exception:
                # Não registrar exceções externas, que podem conter URLs ou credenciais.
                logging.getLogger(__name__).error('Não foi possível atualizar o estado da rotina de leitura.')

    def tick(self):
        if self.stopping.is_set() or not self._tick_lock.acquire(blocking=False):
            return
        try:
            state = self.app.state
            with state.engine.connect() as c:
                due = rows(c, '''SELECT * FROM mail_schedule WHERE enabled=1 AND next_run<=:n
                    ORDER BY next_run,account_id''', n=state.clock().isoformat())
            for schedule in due:
                if self.stopping.is_set():
                    return
                account = schedule['account_id']
                if state.mail_locks[account].locked():
                    continue
                with state.engine.begin() as c:
                    started = c.execute(text('''UPDATE mail_schedule SET last_attempt=:n
                        WHERE account_id=:a AND enabled=1 AND version=:v'''),
                        dict(n=state.clock().isoformat(), a=account, v=schedule['version']))
                    if started.rowcount != 1:
                        continue
                error = None
                result = None
                try:
                    result = synchronize(self.app, account, automatic=True)
                except (MailBusy, SyncCancelled):
                    continue
                except Exception as exc:
                    error = ('Limite do Resend atingido. Nova consulta será tentada mais tarde.'
                             if isinstance(exc, ResendError) and exc.status == 429 else
                             'Revise a conexão da caixa em Contas e identidades.'
                             if isinstance(exc, (CredentialError, HTTPException)) else
                             'Não foi possível concluir a leitura. O histórico local foi preservado.')
                now = state.clock()
                if error:
                    failures = min(schedule['failures']+1, 10)
                    delay = min(schedule['interval_minutes'] * 60 * 2**(failures-1), 3600)
                    values = dict(e=error, f=failures, n=(now+timedelta(seconds=delay)).isoformat())
                    update = 'last_error=:e,failures=:f,next_run=:n'
                else:
                    delay = 60 if result['has_more'] else schedule['interval_minutes']*60
                    values = dict(n=(now+timedelta(seconds=delay)).isoformat(), s=now.isoformat(),
                                  added=result['added'], more=int(result['has_more']))
                    update = 'last_error=NULL,failures=0,next_run=:n,last_success=:s,last_added=:added,has_more=:more'
                with state.engine.begin() as c:
                    c.execute(text(f'''UPDATE mail_schedule SET {update}
                        WHERE account_id=:a AND enabled=1 AND version=:v'''),
                        dict(values, a=account, v=schedule['version']))
        finally:
            self._tick_lock.release()

"""Mesma operação de leitura para o botão e a rotina local."""
from fastapi import HTTPException

from .mail import rows, sync
from .resend_sync import sync_resend
from .windows_store import encrypted_backup


class MailBusy(HTTPException):
    def __init__(self):
        super().__init__(409, "Sincronização já em andamento nesta caixa.")


def synchronize(app, account_id, *, automatic=False):
    state = app.state
    if account_id not in state.mail_locks:
        raise HTTPException(409, "Esta conta não está habilitada para leitura.")
    lock = state.mail_locks[account_id]
    if not lock.acquire(blocking=False):
        raise MailBusy()
    client = None
    changed = False

    def before_change():
        nonlocal changed
        if not changed:
            encrypted_backup(state.db_path)
            changed = True

    try:
        if account_id == "demo":
            return sync(state.engine, account_id, state.mail_provider)
        with state.engine.connect() as c:
            account = rows(c, "SELECT * FROM accounts WHERE id=:a", a=account_id)[0]
        if not account["verified_at"] or not account["remote_id"]:
            raise HTTPException(409, "Conecte esta caixa em Contas e identidades antes de sincronizar.")
        key = state.credential_store.get(account_id)
        if not key:
            raise HTTPException(409, "A credencial não está disponível no Windows. Reconecte a caixa.")
        client = state.mail_client_factory(key)
        if automatic:
            client.cancelled = state.mail_worker.stopping.is_set
        if client.find_inbox(account["address"]) != account["remote_id"]:
            raise HTTPException(409, "A caixa não corresponde à conexão validada.")
        if not automatic:
            before_change()
        result = sync_resend(state.engine, account_id, account["remote_id"], client, before_change=before_change)
        return result
    except (OSError, TimeoutError):
        raise HTTPException(503, "Falha de leitura. O cache local foi preservado.") from None
    finally:
        try:
            if changed:
                # Também protege conversas completas salvas antes de uma falha parcial.
                backup = encrypted_backup(state.db_path)
                if "result" in locals():
                    result["backup"] = backup
        finally:
            try:
                if client:
                    client.close()
            finally:
                lock.release()

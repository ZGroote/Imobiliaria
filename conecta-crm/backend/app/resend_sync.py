import hashlib
import json
from datetime import datetime, timezone

from sqlalchemy import text

from .mail import identifier, rows, save_message
from .resend_client import ResendError

FOLDERS = {"inbox":"Entrada", "archive":"Arquivados", "sent":"Enviados", "spam":"Spam", "trash":"Lixeira"}


def sync_resend(engine, account_id, inbox_id, client, before_change=lambda: None):
    with engine.connect() as c:
        state = rows(c,"SELECT after_id FROM sync_state WHERE account_id=:a",a=account_id)
        after = state[0]["after_id"] if state else None
    threads, more = client.threads(inbox_id, after)
    if more and (not threads or threads[-1].id == after):
        raise ResendError("O Resend repetiu o cursor da sincronização.")
    added = 0
    for thread in threads:
        if thread.folder not in FOLDERS:
            raise ResendError("Pasta desconhecida no Resend. A sincronização foi interrompida.")
        fingerprint = hashlib.sha256(json.dumps([thread.email_count,thread.received_at.isoformat(),thread.folder]).encode()).hexdigest()
        with engine.connect() as c:
            cached = rows(c,"SELECT fingerprint FROM remote_threads WHERE account_id=:a AND remote_id=:r",a=account_id,r=thread.id)
        if cached and cached[0]["fingerprint"] == fingerprint:
            continue
        messages = client.messages(inbox_id, thread.id)
        if len(messages) != thread.email_count or len({m.key for m in messages}) != len(messages):
            raise ResendError("A conversa mudou durante a leitura. Tente novamente para importar o histórico completo.")
        before_change()
        # Só entra no banco depois de ler a conversa completa, sem manter lock durante a rede.
        with engine.begin() as c:
            c.exec_driver_sql("BEGIN IMMEDIATE")
            folder_id = identifier(account_id,FOLDERS[thread.folder])
            validity = "resend:"+inbox_id
            c.execute(text("""INSERT INTO folders(id,account_id,name,uidvalidity) VALUES(:id,:a,:n,:v)
                ON CONFLICT(id) DO NOTHING"""),dict(id=folder_id,a=account_id,n=FOLDERS[thread.folder],v=validity))
            tid = identifier(account_id,"resend:"+thread.id)
            for m in messages:
                mid, inserted = save_message(c,account_id,m)
                added += inserted
                # A localização usa o rowid local: a API Resend não possui UID/UIDVALIDITY de IMAP.
                uid = c.execute(text("SELECT rowid FROM messages WHERE id=:id"),dict(id=mid)).scalar_one()
                c.execute(text("DELETE FROM locations WHERE message_id=:m"),dict(m=mid))
                c.execute(text("INSERT INTO locations VALUES(:f,:v,:uid,:m)"),dict(f=folder_id,v=validity,uid=uid,m=mid))
            # Se o provedor removeu mensagens, o histórico local continua preservado como cache.
            c.execute(text("""UPDATE threads SET subject=:s WHERE id=:id"""),dict(s=thread.subject or "(Sem assunto)",id=tid))
            c.execute(text("""INSERT INTO remote_threads VALUES(:a,:r,:f)
                ON CONFLICT(account_id,remote_id) DO UPDATE SET fingerprint=excluded.fingerprint"""),dict(a=account_id,r=thread.id,f=fingerprint))
    now = datetime.now(timezone.utc).isoformat()
    with engine.begin() as c:
        c.execute(text("""INSERT INTO sync_state VALUES(:a,:after)
            ON CONFLICT(account_id) DO UPDATE SET after_id=excluded.after_id"""),dict(a=account_id,after=threads[-1].id if more else None))
        c.execute(text("UPDATE accounts SET sync_at=:now WHERE id=:a"),dict(now=now,a=account_id))
        c.execute(text("INSERT INTO audit_events(action,account_id,occurred_at,count) VALUES('sync_resend',:a,:d,:n)"),dict(a=account_id,d=now,n=added))
    return {"added":added,"mode":"resend","send_enabled":False,"has_more":more,"processed_threads":len(threads)}

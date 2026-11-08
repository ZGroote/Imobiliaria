import hashlib
import json
from datetime import datetime, timezone

from sqlalchemy import text

from .provider import ReadProvider
from .classification import classify_message
from .commercial import merge_links


def identifier(*parts):
    return hashlib.sha256("\0".join(parts).encode()).hexdigest()[:32]


def rows(connection, sql, **params):
    return [dict(row) for row in connection.execute(text(sql), params).mappings()]


def save_message(c, account_id, m):
    mid = identifier(account_id, m.key)
    if rows(c, "SELECT id FROM messages WHERE id=:id", id=mid):
        return mid, False
    refs = (*m.references, m.in_reply_to)
    related = []
    if not m.thread_key:
        for ref in (*refs, m.message_id):
            if ref:
                related.extend(rows(c, """SELECT DISTINCT thread_id FROM messages
                    WHERE account_id=:a AND (message_id=:ref OR in_reply_to=:ref)""", a=account_id, ref=ref))
    root = next((ref for ref in refs if ref), m.message_id or m.key)
    tid = (identifier(account_id, m.thread_key) if m.thread_key else
           related[0]["thread_id"] if related else identifier(account_id, root))
    c.execute(text("INSERT INTO threads VALUES(:id,:a,:s,:d) ON CONFLICT(id) DO NOTHING"),
              dict(id=tid,a=account_id,s=m.subject,d=m.received_at))
    for previous in {r["thread_id"] for r in related} - {tid}:
        merge_links(c,tid,previous)
        c.execute(text("UPDATE messages SET thread_id=:id WHERE thread_id=:old"), dict(id=tid,old=previous))
        c.execute(text("DELETE FROM threads WHERE id=:id"), dict(id=previous))
    c.execute(text("""INSERT INTO messages(id,account_id,provider_key,message_id,in_reply_to,
        thread_id,sender,recipient,subject,body_text,received_at,attachments,is_read,direction,headers)
        VALUES(:id,:a,:key,:mid,:reply,:tid,:sender,:recipient,:subject,:body,:date,:attachments,:read,:direction,:headers)"""),
        dict(id=mid,a=account_id,key=m.key,mid=m.message_id,reply=m.in_reply_to,tid=tid,
             sender=m.sender,recipient=m.recipient,subject=m.subject,body=m.body,
             date=m.received_at,attachments=json.dumps(m.attachments),read=int(m.is_read),direction=m.direction,headers=json.dumps(m.headers)))
    classify_message(c,mid)
    c.execute(text("""UPDATE threads SET last_at=(SELECT MAX(received_at) FROM messages
        WHERE thread_id=:id) WHERE id=:id"""), dict(id=tid))
    return mid, True


def sync(engine, account_id: str, provider: ReadProvider):
    added = 0
    with engine.begin() as c:
        c.exec_driver_sql("BEGIN IMMEDIATE")
        for name, validity in provider.folders():
            folder_id = identifier(account_id, name)
            c.execute(text("""INSERT INTO folders(id,account_id,name,uidvalidity) VALUES(:id,:a,:n,:v)
                ON CONFLICT(id) DO NOTHING"""), dict(id=folder_id,a=account_id,n=name,v=validity))
            folder = rows(c, "SELECT * FROM folders WHERE id=:id", id=folder_id)[0]
            cursor = folder["cursor"] if folder["uidvalidity"] == validity else 0
            batch = provider.messages(name, cursor)
            for m in batch:
                mid, inserted = save_message(c, account_id, m)
                added += inserted
                c.execute(text("""INSERT INTO locations VALUES(:f,:v,:uid,:m)
                    ON CONFLICT(folder_id,uidvalidity,uid) DO NOTHING"""), dict(f=folder_id,v=validity,uid=m.uid,m=mid))
            c.execute(text("UPDATE folders SET uidvalidity=:v,cursor=:cur WHERE id=:id"),
                      dict(v=validity,cur=max([cursor]+[m.uid for m in batch]),id=folder_id))
        now = datetime.now(timezone.utc).isoformat()
        c.execute(text("UPDATE accounts SET sync_at=:now WHERE id=:id"), dict(now=now,id=account_id))
        c.execute(text("INSERT INTO audit_events(action,account_id,occurred_at,count) VALUES('sync',:a,:d,:n)"),
                  dict(a=account_id,d=now,n=added))
    return {"added": added, "mode": "mock", "send_enabled": False}

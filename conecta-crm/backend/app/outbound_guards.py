from datetime import datetime, timezone

from sqlalchemy import text


def invalidate(c, drafts, reason, status="blocked", actor="rules"):
    for draft in drafts:
        c.execute(text("""UPDATE outbound_drafts SET status=:status,approved_version=NULL,approved_hash=NULL,approved_at=NULL
            WHERE id=:id"""),dict(status=status,id=draft["id"]))
        c.execute(text("UPDATE outbound_queue SET status=:status,reason=:r WHERE draft_id=:id AND status='scheduled'"),
                  dict(status="cancelled" if status=="pending_review" else status,r=reason,id=draft["id"]))
        c.execute(text("INSERT INTO outbound_history(draft_id,version,action,actor,occurred_at) VALUES(:id,:v,:r,:actor,:d)"),
                  dict(id=draft["id"],v=draft["version"],r=reason,actor=actor,d=datetime.now(timezone.utc).isoformat()))


def block_recipient(c, address):
    drafts = c.execute(text("""SELECT id,version FROM outbound_drafts WHERE recipient=:a
        AND status IN ('draft','pending_review','approved','scheduled')"""),dict(a=address)).mappings().all()
    invalidate(c,drafts,"contact_suppressed")


def pause_followups(c, thread_id, received_at):
    drafts = c.execute(text("""SELECT id,version,created_at FROM outbound_drafts WHERE thread_id=:t AND purpose='followup'
        AND status IN ('approved','scheduled')"""),dict(t=thread_id)).mappings().all()
    newer = [d for d in drafts if datetime.fromisoformat(received_at)>datetime.fromisoformat(d["created_at"])]
    invalidate(c,newer,"response_received",status="pending_review")

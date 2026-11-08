"""Rascunhos versionados e fila estritamente simulada."""
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = depends_on = None


def upgrade():
    op.execute("""CREATE TABLE outbound_drafts (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
        profile_id TEXT NOT NULL REFERENCES brand_profiles(id), recipient TEXT NOT NULL,
        subject TEXT NOT NULL, body_text TEXT NOT NULL, purpose TEXT NOT NULL,
        thread_id TEXT REFERENCES threads(id) ON DELETE SET NULL, context_hash TEXT NOT NULL, metadata TEXT NOT NULL,
        version INTEGER NOT NULL CHECK(version>0), status TEXT NOT NULL,
        approved_version INTEGER, approved_hash TEXT, approved_at TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL)""")
    op.execute("CREATE INDEX drafts_updated ON outbound_drafts(updated_at)")
    op.execute("""CREATE TABLE outbound_queue (id TEXT PRIMARY KEY, draft_id TEXT NOT NULL REFERENCES outbound_drafts(id),
        version INTEGER NOT NULL, snapshot_hash TEXT NOT NULL, snapshot TEXT NOT NULL,
        recipient TEXT NOT NULL, purpose TEXT NOT NULL, scheduled_at TEXT NOT NULL,
        recipient_timezone TEXT NOT NULL, status TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL, processed_at TEXT, UNIQUE(draft_id,version))""")
    op.execute("CREATE INDEX queue_due ON outbound_queue(status,scheduled_at)")
    op.execute("""CREATE TABLE outbound_history (id INTEGER PRIMARY KEY, draft_id TEXT NOT NULL REFERENCES outbound_drafts(id),
        version INTEGER NOT NULL, action TEXT NOT NULL, actor TEXT NOT NULL, occurred_at TEXT NOT NULL)""")
    op.execute("CREATE TABLE outbound_control (id INTEGER PRIMARY KEY CHECK(id=1), paused INTEGER NOT NULL CHECK(paused IN (0,1)))")
    op.execute("INSERT INTO outbound_control VALUES(1,1)")
    op.execute("CREATE TABLE thread_brand_profiles (thread_id TEXT PRIMARY KEY REFERENCES threads(id) ON DELETE CASCADE, profile_id TEXT NOT NULL REFERENCES brand_profiles(id))")


def downgrade():
    raise RuntimeError("Restaure um backup para reverter; downgrade destrutivo desabilitado.")

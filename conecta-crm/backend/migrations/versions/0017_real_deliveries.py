"""Fila real separada, autorização por destinatário e tentativas imutáveis."""
from alembic import op

revision = '0017'
down_revision = '0016'
branch_labels = depends_on = None


def upgrade():
    op.execute('''CREATE TABLE real_delivery_control(id INTEGER PRIMARY KEY CHECK(id=1),
        paused INTEGER NOT NULL DEFAULT 1,version INTEGER NOT NULL DEFAULT 1,last_error TEXT)''')
    op.execute('INSERT INTO real_delivery_control(id) VALUES(1)')
    op.execute('''CREATE TABLE recipient_authorizations(id TEXT PRIMARY KEY,address TEXT NOT NULL,
        profile_id TEXT NOT NULL REFERENCES brand_profiles(id),basis TEXT NOT NULL,
        note TEXT NOT NULL,observed_on TEXT NOT NULL,expires_on TEXT NOT NULL,
        version INTEGER NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)''')
    op.execute("CREATE UNIQUE INDEX active_recipient_authorization ON recipient_authorizations(address,profile_id) WHERE status='active'")
    op.execute('''CREATE TABLE recipient_authorization_history(id INTEGER PRIMARY KEY,authorization_id TEXT NOT NULL REFERENCES recipient_authorizations(id),
        version INTEGER NOT NULL,payload TEXT NOT NULL,occurred_at TEXT NOT NULL)''')
    op.execute('''CREATE TABLE real_campaigns(id TEXT PRIMARY KEY,name TEXT NOT NULL,paused INTEGER NOT NULL DEFAULT 1,
        version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL)''')
    op.execute('''CREATE TABLE real_deliveries(id TEXT PRIMARY KEY,request_hash TEXT NOT NULL,
        draft_id TEXT NOT NULL REFERENCES outbound_drafts(id),draft_version INTEGER NOT NULL,content_hash TEXT NOT NULL,
        authorization_id TEXT NOT NULL REFERENCES recipient_authorizations(id),authorization_version INTEGER NOT NULL,
        campaign_id TEXT REFERENCES real_campaigns(id),snapshot TEXT NOT NULL,approval_hash TEXT NOT NULL,
        scheduled_at TEXT NOT NULL,recipient_timezone TEXT NOT NULL,status TEXT NOT NULL,
        created_at TEXT NOT NULL,approved_at TEXT,attempted_at TEXT,finished_at TEXT,checked_at TEXT,
        remote_id TEXT UNIQUE,remote_message_id TEXT,remote_event TEXT,error_code TEXT,
        UNIQUE(draft_id,draft_version))''')
    op.execute("CREATE UNIQUE INDEX real_delivery_content ON real_deliveries(content_hash) WHERE status IN ('prepared','approved','sending','unknown')")
    op.execute('CREATE INDEX real_delivery_due ON real_deliveries(status,scheduled_at)')
    op.execute('''CREATE TABLE real_delivery_events(id INTEGER PRIMARY KEY,delivery_id TEXT NOT NULL REFERENCES real_deliveries(id),
        action TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',occurred_at TEXT NOT NULL)''')


def downgrade():
    raise RuntimeError('Restaure um backup para reverter; downgrade destrutivo desabilitado.')

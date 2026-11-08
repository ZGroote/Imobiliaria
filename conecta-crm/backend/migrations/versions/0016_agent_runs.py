"""Execuções e agenda explícita de agentes, inicialmente pausadas."""
from alembic import op

revision = '0016'
down_revision = '0015'
branch_labels = depends_on = None


def upgrade():
    op.execute('''CREATE TABLE agent_control(id INTEGER PRIMARY KEY CHECK(id=1),
        paused INTEGER NOT NULL DEFAULT 1,version INTEGER NOT NULL DEFAULT 1,
        verified INTEGER NOT NULL DEFAULT 0,checked_at TEXT,error_code TEXT)''')
    op.execute('INSERT INTO agent_control(id) VALUES(1)')
    op.execute('''CREATE TABLE agent_runs(id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('research','analysis')),
        reference_id TEXT NOT NULL,account_id TEXT,input_hash TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('queued','running','completed','failed','cancelled','interrupted')),
        scheduled_at TEXT NOT NULL,created_at TEXT NOT NULL,started_at TEXT,finished_at TEXT,
        search_count INTEGER NOT NULL DEFAULT 0,error_code TEXT,result_hash TEXT)''')
    op.execute("CREATE UNIQUE INDEX agent_active_reference ON agent_runs(kind,reference_id) WHERE status IN ('queued','running')")
    op.execute('CREATE INDEX agent_due ON agent_runs(status,scheduled_at,created_at)')
    op.execute('''CREATE TABLE agent_run_events(id INTEGER PRIMARY KEY,run_id TEXT NOT NULL REFERENCES agent_runs(id),
        action TEXT NOT NULL,occurred_at TEXT NOT NULL)''')


def downgrade():
    raise RuntimeError('Restaure um backup para reverter; downgrade destrutivo desabilitado.')

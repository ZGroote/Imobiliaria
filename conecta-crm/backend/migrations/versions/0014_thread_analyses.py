"""Pacotes locais de análise assistida e sugestões separadas da triagem humana."""
from alembic import op

revision = '0014'
down_revision = '0013'
branch_labels = depends_on = None


def upgrade():
    op.execute('''CREATE TABLE thread_analyses(
        id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id),
        request_id TEXT NOT NULL UNIQUE,request_hash TEXT NOT NULL,source_hash TEXT NOT NULL,
        input_hash TEXT NOT NULL,input TEXT NOT NULL,
        agent TEXT NOT NULL CHECK(agent IN ('codex_assisted','claude_assisted')),
        status TEXT NOT NULL CHECK(status IN ('prepared','imported')),
        result TEXT,result_hash TEXT,created_at TEXT NOT NULL,imported_at TEXT)''')
    op.execute('''CREATE TABLE analysis_messages(
        analysis_id TEXT NOT NULL REFERENCES thread_analyses(id),alias TEXT NOT NULL,
        message_id TEXT NOT NULL REFERENCES messages(id),
        PRIMARY KEY(analysis_id,alias),UNIQUE(analysis_id,message_id))''')
    op.execute('CREATE INDEX analysis_message_origin ON analysis_messages(message_id,analysis_id)')
    op.execute('''CREATE TABLE analysis_events(id INTEGER PRIMARY KEY,analysis_id TEXT NOT NULL
        REFERENCES thread_analyses(id),action TEXT NOT NULL,occurred_at TEXT NOT NULL)''')


def downgrade():
    raise RuntimeError('Restaure um backup para reverter; downgrade destrutivo desabilitado.')

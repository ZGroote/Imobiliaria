"""Oportunidades e vínculos comerciais locais."""
from alembic import op

revision = '0007'
down_revision = '0006'
branch_labels = depends_on = None


def upgrade():
    op.execute('''CREATE TABLE opportunities(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),
        title TEXT NOT NULL,stage TEXT NOT NULL,amount_minor INTEGER,currency TEXT,
        next_step TEXT NOT NULL,due_on TEXT,notes TEXT NOT NULL,version INTEGER NOT NULL CHECK(version>0),
        created_hash TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
        CHECK((amount_minor IS NULL AND currency IS NULL) OR
            (amount_minor IS NOT NULL AND amount_minor>=0 AND currency IS NOT NULL AND currency IN ('BRL','USD'))))''')
    op.execute('CREATE INDEX opportunity_company ON opportunities(company_id,updated_at)')
    op.execute('CREATE INDEX opportunity_due ON opportunities(stage,due_on)')
    op.execute('''CREATE TABLE conversation_links(id TEXT PRIMARY KEY,thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        company_id TEXT NOT NULL REFERENCES companies(id),opportunity_id TEXT REFERENCES opportunities(id),created_at TEXT NOT NULL)''')
    op.execute("CREATE UNIQUE INDEX conversation_context ON conversation_links(thread_id,company_id,ifnull(opportunity_id,''))")
    op.execute('CREATE INDEX linked_company ON conversation_links(company_id,thread_id)')
    op.execute('''CREATE TABLE commercial_events(id INTEGER PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),
        opportunity_id TEXT REFERENCES opportunities(id),action TEXT NOT NULL,payload TEXT NOT NULL,
        actor TEXT NOT NULL,occurred_at TEXT NOT NULL)''')
    op.execute('CREATE INDEX commercial_company ON commercial_events(company_id,id)')


def downgrade():
    raise RuntimeError('Restaure um backup para reverter; downgrade destrutivo desabilitado.')

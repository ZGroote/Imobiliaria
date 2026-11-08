"""Acompanhamento local de produção, entrega e pós-venda."""
from alembic import op

revision='0009'
down_revision='0008'
branch_labels=depends_on=None


def upgrade():
    op.execute('''CREATE TABLE projects(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),
        opportunity_id TEXT NOT NULL UNIQUE REFERENCES opportunities(id),proposal_id TEXT REFERENCES proposals(id),
        source_proposal TEXT,version INTEGER NOT NULL CHECK(version>0),title TEXT NOT NULL,stage TEXT NOT NULL,
        payload TEXT NOT NULL,created_hash TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)''')
    op.execute('CREATE INDEX project_stage ON projects(stage,updated_at)')


def downgrade():
    raise RuntimeError('Restaure um backup para reverter; downgrade destrutivo desabilitado.')

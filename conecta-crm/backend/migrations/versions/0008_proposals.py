"""Propostas comerciais versionadas e revisão interna."""
from alembic import op

revision='0008'
down_revision='0007'
branch_labels=depends_on=None


def upgrade():
    op.execute('''CREATE TABLE proposals(id TEXT PRIMARY KEY,opportunity_id TEXT NOT NULL REFERENCES opportunities(id),
        version INTEGER NOT NULL CHECK(version>0),status TEXT NOT NULL,created_hash TEXT NOT NULL,
        approved_version INTEGER,approved_hash TEXT,approved_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)''')
    op.execute('CREATE INDEX proposal_opportunity ON proposals(opportunity_id,updated_at)')
    op.execute('''CREATE TABLE proposal_versions(proposal_id TEXT NOT NULL REFERENCES proposals(id),version INTEGER NOT NULL,
        payload TEXT NOT NULL,snapshot TEXT NOT NULL,content_hash TEXT NOT NULL,created_at TEXT NOT NULL,
        PRIMARY KEY(proposal_id,version))''')


def downgrade():
    raise RuntimeError('Restaure um backup para reverter; downgrade destrutivo desabilitado.')

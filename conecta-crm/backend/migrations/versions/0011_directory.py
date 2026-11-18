"""Contatos e empreendimentos com fontes e revisões preservadas."""
from alembic import op

revision='0011'
down_revision='0010'
branch_labels=depends_on=None


def upgrade():
    for table in ('company_contacts','developments'):
        op.execute(f'''CREATE TABLE {table}(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),
            identity_key TEXT NOT NULL,payload TEXT NOT NULL,version INTEGER NOT NULL CHECK(version>0),
            origin_candidate_id TEXT REFERENCES job_candidates(id),created_hash TEXT NOT NULL,
            created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(company_id,identity_key))''')
    op.execute('''CREATE TABLE directory_history(kind TEXT NOT NULL,record_id TEXT NOT NULL,version INTEGER NOT NULL,
        payload TEXT NOT NULL,occurred_at TEXT NOT NULL,PRIMARY KEY(kind,record_id,version))''')


def downgrade():
    raise RuntimeError('Restaure um backup para reverter; downgrade destrutivo desabilitado.')

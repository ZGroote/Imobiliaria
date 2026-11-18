"""Pesquisa assistida, candidatos e empresas revisadas pelo operador."""
from alembic import op

revision = '0006'
down_revision = '0005'
branch_labels = depends_on = None


def upgrade():
    op.execute('''CREATE TABLE research_jobs(id TEXT PRIMARY KEY, state TEXT NOT NULL,
        target_count INTEGER NOT NULL CHECK(target_count BETWEEN 1 AND 50), size_tier TEXT NOT NULL,
        agent TEXT NOT NULL, status TEXT NOT NULL, prompt TEXT NOT NULL, input_hash TEXT NOT NULL,
        result_hash TEXT, warnings TEXT NOT NULL DEFAULT '[]', generated_at TEXT,
        created_at TEXT NOT NULL, imported_at TEXT)''')
    op.execute('''CREATE TABLE companies(id TEXT PRIMARY KEY, name TEXT NOT NULL, domain TEXT NOT NULL UNIQUE,
        website TEXT NOT NULL, created_at TEXT NOT NULL)''')
    op.execute('''CREATE TABLE job_candidates(id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES research_jobs(id),
        domain TEXT NOT NULL, payload TEXT NOT NULL, content_hash TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending', review_note TEXT NOT NULL DEFAULT '', reviewed_at TEXT,
        company_id TEXT REFERENCES companies(id), UNIQUE(job_id,domain))''')
    op.execute('CREATE INDEX candidate_job ON job_candidates(job_id,status)')
    op.execute('''CREATE TABLE company_states(company_id TEXT NOT NULL REFERENCES companies(id), state TEXT NOT NULL,
        PRIMARY KEY(company_id,state))''')
    op.execute('''CREATE TABLE research_events(id INTEGER PRIMARY KEY,job_id TEXT NOT NULL REFERENCES research_jobs(id),
        candidate_id TEXT REFERENCES job_candidates(id),action TEXT NOT NULL,occurred_at TEXT NOT NULL)''')


def downgrade():
    raise RuntimeError('Restaure um backup para reverter; downgrade destrutivo desabilitado.')

"""Critérios versionados e avaliações manuais baseadas em fontes cadastradas."""
from alembic import op
from sqlalchemy import text

revision = '0015'
down_revision = '0014'
branch_labels = depends_on = None


def upgrade():
    op.execute('''CREATE TABLE qualification_policy_history(version INTEGER PRIMARY KEY,
        weights TEXT NOT NULL,note TEXT NOT NULL,changed_at TEXT NOT NULL)''')
    op.get_bind().execute(text('''INSERT INTO qualification_policy_history VALUES(1,:weights,
        'Modelo inicial baseado no plano do CRM.',strftime('%Y-%m-%dT%H:%M:%f+00:00','now'))'''),
        dict(weights='{"relevance":25,"stage":20,"recurrence":20,"evidence":20,"demo":15}'))
    op.execute('''CREATE TABLE company_qualifications(company_id TEXT PRIMARY KEY REFERENCES companies(id),
        version INTEGER NOT NULL CHECK(version>0),payload TEXT NOT NULL,updated_at TEXT NOT NULL)''')
    op.execute('''CREATE TABLE qualification_history(company_id TEXT NOT NULL REFERENCES companies(id),
        version INTEGER NOT NULL CHECK(version>0),payload TEXT NOT NULL,occurred_at TEXT NOT NULL,
        PRIMARY KEY(company_id,version))''')


def downgrade():
    raise RuntimeError('Restaure um backup para reverter; downgrade destrutivo desabilitado.')

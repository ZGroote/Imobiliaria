"""Rotina local de leitura; nenhuma conta é ativada pela migração."""
from alembic import op

revision = '0012'
down_revision = '0011'
branch_labels = depends_on = None


def upgrade():
    op.execute('''CREATE TABLE mail_schedule(
        account_id TEXT PRIMARY KEY REFERENCES accounts(id) CHECK(account_id IN ('contact','team')),
        enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
        interval_minutes INTEGER NOT NULL DEFAULT 30 CHECK(interval_minutes IN (5,10,30,60)),
        next_run TEXT, last_attempt TEXT, last_success TEXT, last_error TEXT,
        failures INTEGER NOT NULL DEFAULT 0 CHECK(failures>=0),
        last_added INTEGER NOT NULL DEFAULT 0 CHECK(last_added>=0),
        has_more INTEGER NOT NULL DEFAULT 0 CHECK(has_more IN (0,1)),
        version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
        CHECK(enabled=0 OR next_run IS NOT NULL))''')


def downgrade():
    raise RuntimeError('Restaure um backup para reverter; downgrade destrutivo desabilitado.')

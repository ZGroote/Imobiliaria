"""Diagnóstico de remetentes e teste real individual com aprovação específica."""
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = depends_on = None


def upgrade():
    op.execute("""CREATE TABLE sender_diagnostics(account_id TEXT PRIMARY KEY REFERENCES accounts(id),
        checked_at TEXT NOT NULL, report TEXT NOT NULL)""")
    op.execute("""CREATE TABLE sender_tests(id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id),
        payload TEXT NOT NULL,content_hash TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,
        attempted_at TEXT,provider_id TEXT,provider_event TEXT,received_at TEXT,error_code TEXT NOT NULL DEFAULT '')""")
    op.execute("CREATE INDEX sender_test_time ON sender_tests(attempted_at)")


def downgrade():
    raise RuntimeError("Restaure um backup para reverter; downgrade destrutivo desabilitado.")

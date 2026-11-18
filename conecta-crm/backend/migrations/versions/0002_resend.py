"""Conexão verificada e cursor de varredura das Inboxes."""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = depends_on = None


def upgrade():
    op.execute("ALTER TABLE accounts ADD COLUMN remote_id TEXT")
    op.execute("ALTER TABLE accounts ADD COLUMN verified_at TEXT")
    op.execute("""CREATE TABLE remote_threads (account_id TEXT NOT NULL REFERENCES accounts(id),
        remote_id TEXT NOT NULL, fingerprint TEXT NOT NULL, PRIMARY KEY(account_id,remote_id))""")
    op.execute("""CREATE TABLE sync_state (account_id TEXT PRIMARY KEY REFERENCES accounts(id),
        after_id TEXT)""")


def downgrade():
    raise RuntimeError("Restaure um backup para reverter; downgrade destrutivo desabilitado.")

"""Triagem determinística e bloqueios locais auditáveis."""
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = depends_on = None


def upgrade():
    op.execute("ALTER TABLE messages ADD COLUMN direction TEXT NOT NULL DEFAULT 'inbound'")
    op.execute("ALTER TABLE messages ADD COLUMN headers TEXT NOT NULL DEFAULT '{}'")
    op.execute("""UPDATE messages SET direction='outbound' WHERE EXISTS(SELECT 1 FROM accounts a
        WHERE a.id=messages.account_id AND (lower(trim(messages.sender))=lower(a.address)
        OR lower(messages.sender) LIKE '%<' || lower(a.address) || '>'))""")
    op.execute("""CREATE TABLE message_classifications (
        message_id TEXT PRIMARY KEY REFERENCES messages(id), category TEXT NOT NULL,
        confidence REAL NOT NULL CHECK(confidence>=0 AND confidence<=1),
        reason TEXT NOT NULL, evidence TEXT NOT NULL, rule_version TEXT NOT NULL,
        classified_at TEXT NOT NULL)""")
    op.execute("""CREATE TABLE suppression_list (address TEXT PRIMARY KEY, reason TEXT NOT NULL,
        source_message_id TEXT REFERENCES messages(id), created_at TEXT NOT NULL)""")


def downgrade():
    raise RuntimeError("Restaure um backup para reverter; downgrade destrutivo desabilitado.")

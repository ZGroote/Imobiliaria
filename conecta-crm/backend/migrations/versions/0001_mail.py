"""Cache local de correio, perfis e auditoria. Não contém transporte de envio."""
from alembic import op

revision = "0001"
down_revision = None
branch_labels = depends_on = None

SCHEMA = [
    """CREATE TABLE accounts (id TEXT PRIMARY KEY, address TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL, role TEXT NOT NULL, sync_at TEXT)""",
    """CREATE TABLE folders (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
    name TEXT NOT NULL, uidvalidity TEXT NOT NULL, cursor INTEGER NOT NULL DEFAULT 0,
    UNIQUE(account_id, name))""",
    """CREATE TABLE threads (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
    subject TEXT NOT NULL, last_at TEXT NOT NULL)""",
    """CREATE TABLE messages (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
    provider_key TEXT NOT NULL, message_id TEXT NOT NULL, in_reply_to TEXT NOT NULL,
    thread_id TEXT NOT NULL REFERENCES threads(id), sender TEXT NOT NULL, recipient TEXT NOT NULL,
    subject TEXT NOT NULL, body_text TEXT NOT NULL, received_at TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0, attachments TEXT NOT NULL DEFAULT '[]',
    UNIQUE(account_id, provider_key))""",
    "CREATE INDEX message_headers ON messages(account_id, message_id)",
    "CREATE INDEX message_thread ON messages(thread_id, received_at)",
    """CREATE TABLE locations (folder_id TEXT NOT NULL REFERENCES folders(id),
    uidvalidity TEXT NOT NULL, uid INTEGER NOT NULL, message_id TEXT NOT NULL REFERENCES messages(id),
    PRIMARY KEY(folder_id, uidvalidity, uid))""",
    """CREATE TABLE brand_profiles (id TEXT PRIMARY KEY, locale TEXT NOT NULL,
    website TEXT NOT NULL, tagline TEXT NOT NULL)""",
    """INSERT INTO brand_profiles VALUES
    ('BR','pt-BR','https://conectaimoveis3d.com.br','Uma nova perspectiva.'),
    ('US','en-US','https://conectaimoveis3d.com','A new perspective.')""",
    """CREATE TABLE audit_events (id INTEGER PRIMARY KEY, action TEXT NOT NULL,
    account_id TEXT NOT NULL REFERENCES accounts(id), occurred_at TEXT NOT NULL, count INTEGER NOT NULL)""",
    "CREATE VIRTUAL TABLE mail_search USING fts5(message_key UNINDEXED, sender, subject, body_text)",
    """CREATE TRIGGER search_insert AFTER INSERT ON messages BEGIN
    INSERT INTO mail_search VALUES(new.id, new.sender, new.subject, new.body_text); END""",
    """CREATE TRIGGER search_delete AFTER DELETE ON messages BEGIN
    DELETE FROM mail_search WHERE message_key=old.id; END""",
]


def upgrade():
    for statement in SCHEMA:
        op.execute(statement)


def downgrade():
    raise RuntimeError("Restaure um backup para reverter; downgrade destrutivo desabilitado.")

"""Auditoria local de arquivos preparados para download, sem guardar URLs ou conteúdo."""
from alembic import op

revision = '0013'
down_revision = '0012'
branch_labels = depends_on = None


def upgrade():
    op.execute('''CREATE TABLE attachment_transfers(
        id TEXT PRIMARY KEY,message_id TEXT NOT NULL REFERENCES messages(id),
        attachment_id TEXT NOT NULL,filename TEXT NOT NULL,
        size INTEGER NOT NULL CHECK(size BETWEEN 0 AND 20971520),
        sha256 TEXT NOT NULL CHECK(length(sha256)=64),prepared_at TEXT NOT NULL)''')
    op.execute('CREATE INDEX attachment_transfer_message ON attachment_transfers(message_id,prepared_at)')


def downgrade():
    raise RuntimeError('Restaure um backup para reverter; downgrade destrutivo desabilitado.')

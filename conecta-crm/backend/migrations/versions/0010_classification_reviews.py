"""Revisões humanas da triagem, vinculadas à mensagem."""
from alembic import op

revision='0010'
down_revision='0009'
branch_labels=depends_on=None


def upgrade():
    op.execute('''CREATE TABLE classification_reviews(message_id TEXT PRIMARY KEY REFERENCES messages(id),
        version INTEGER NOT NULL CHECK(version>0),category TEXT NOT NULL,response_kind TEXT NOT NULL,
        note TEXT NOT NULL,message_hash TEXT NOT NULL,reviewed_at TEXT NOT NULL)''')
    op.execute('''CREATE TABLE classification_review_history(message_id TEXT NOT NULL REFERENCES messages(id),
        version INTEGER NOT NULL,category TEXT NOT NULL,response_kind TEXT NOT NULL,note TEXT NOT NULL,
        message_hash TEXT NOT NULL,reviewed_at TEXT NOT NULL,PRIMARY KEY(message_id,version))''')
    op.execute('''CREATE VIEW effective_classifications AS SELECT m.id message_id,
        coalesce(r.category,mc.category) category,
        CASE WHEN r.message_id IS NULL THEN mc.confidence ELSE NULL END confidence,
        CASE WHEN r.message_id IS NULL THEN mc.reason WHEN r.note='' THEN 'Categoria confirmada pelo operador.' ELSE r.note END reason,
        CASE WHEN r.message_id IS NULL THEN mc.evidence ELSE substr(m.body_text,1,180) END evidence,
        mc.rule_version,coalesce(r.reviewed_at,mc.classified_at) classified_at,
        CASE WHEN r.message_id IS NULL THEN 'rules' ELSE 'operator' END source,
        coalesce(r.version,0) review_version,r.response_kind
        FROM messages m LEFT JOIN message_classifications mc ON mc.message_id=m.id
        LEFT JOIN classification_reviews r ON r.message_id=m.id
        WHERE mc.message_id IS NOT NULL OR r.message_id IS NOT NULL''')


def downgrade():
    raise RuntimeError('Restaure um backup para reverter; downgrade destrutivo desabilitado.')

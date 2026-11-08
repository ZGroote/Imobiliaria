"""Revisões humanas de materiais derivados por hash, separadas dos originais."""
from alembic import op
revision='0018'
down_revision='0017'
branch_labels=depends_on=None


def upgrade():
    op.execute('''CREATE TABLE brand_material_reviews(id INTEGER PRIMARY KEY,
        profile_id TEXT NOT NULL REFERENCES brand_profiles(id),kind TEXT NOT NULL CHECK(kind IN ('letterhead','signature')),
        content_hash TEXT NOT NULL,approved INTEGER NOT NULL CHECK(approved IN (0,1)),occurred_at TEXT NOT NULL)''')
    op.execute('CREATE INDEX brand_material_history ON brand_material_reviews(profile_id,kind,id)')


def downgrade():
    raise RuntimeError('Restaure um backup para reverter; downgrade destrutivo desabilitado.')

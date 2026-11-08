"""Alvo público opcional da pesquisa; tarefas antigas permanecem sem alvo."""
from alembic import op
revision='0019'
down_revision='0018'
branch_labels=depends_on=None


def upgrade():
    op.execute('ALTER TABLE research_jobs ADD COLUMN target_company_id TEXT REFERENCES companies(id)')
    op.execute('ALTER TABLE research_jobs ADD COLUMN target_snapshot TEXT')


def downgrade():
    raise RuntimeError('Restaure um backup para reverter; downgrade destrutivo desabilitado.')

"""player sessions

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-24 23:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def _exists(name: str) -> bool:
    if op.get_context().as_sql:
        return False
    return sa.inspect(op.get_bind()).has_table(name)


def upgrade() -> None:
    if _exists('player_sessions'):
        return
    op.create_table('player_sessions',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('player_id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('last_seen_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['player_id'], ['players.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_player_sessions_player_id', 'player_sessions', ['player_id'], unique=False)
    op.create_index('ix_player_sessions_created_at', 'player_sessions', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_player_sessions_created_at', table_name='player_sessions')
    op.drop_index('ix_player_sessions_player_id', table_name='player_sessions')
    op.drop_table('player_sessions')

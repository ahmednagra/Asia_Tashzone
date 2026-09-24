"""session device name

Revision ID: 0005
Revises: 0004
Create Date: 2026-09-25 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def _has_column(table: str, column: str) -> bool:
    if op.get_context().as_sql:
        return False
    return any(c['name'] == column for c in sa.inspect(op.get_bind()).get_columns(table))


def upgrade() -> None:
    if not _has_column('player_sessions', 'device_name'):
        op.add_column('player_sessions', sa.Column('device_name', sa.String(length=60), nullable=True))


def downgrade() -> None:
    op.drop_column('player_sessions', 'device_name')

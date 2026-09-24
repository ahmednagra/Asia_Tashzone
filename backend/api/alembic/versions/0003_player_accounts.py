"""player accounts and auth codes

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-24 21:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def _exists(name: str) -> bool:
    if op.get_context().as_sql:
        return False
    return sa.inspect(op.get_bind()).has_table(name)


def upgrade() -> None:
    if not _exists('player_accounts'):
        op.create_table('player_accounts',
        sa.Column('player_id', sa.String(length=36), nullable=False),
        sa.Column('email', sa.String(length=254), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=True),
        sa.Column('email_verified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('password_changed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint('email = lower(email)', name='ck_player_accounts_email_lower'),
        sa.CheckConstraint('length(email) BETWEEN 3 AND 254', name='ck_player_accounts_email_length'),
        sa.ForeignKeyConstraint(['player_id'], ['players.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('player_id'),
        sa.UniqueConstraint('email')
        )
    if not _exists('auth_codes'):
        op.create_table('auth_codes',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('purpose', sa.String(length=10), nullable=False),
        sa.Column('email', sa.String(length=254), nullable=False),
        sa.Column('code_hash', sa.String(length=64), nullable=False),
        sa.Column('attempts', sa.SmallInteger(), server_default=sa.text('0'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("purpose IN ('login','reset','signup')", name='ck_auth_codes_purpose'),
        sa.CheckConstraint('attempts >= 0', name='ck_auth_codes_attempts'),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_auth_codes_email_purpose_created', 'auth_codes', ['email', 'purpose', 'created_at'], unique=False)
        op.create_index('ix_auth_codes_expires_at', 'auth_codes', ['expires_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_auth_codes_expires_at', table_name='auth_codes')
    op.drop_index('ix_auth_codes_email_purpose_created', table_name='auth_codes')
    op.drop_table('auth_codes')
    op.drop_table('player_accounts')

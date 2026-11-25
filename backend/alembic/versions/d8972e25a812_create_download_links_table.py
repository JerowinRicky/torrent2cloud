"""create_download_links_table

Revision ID: d8972e25a812
Revises: c104434dbd19
Create Date: 2026-11-25 10:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd8972e25a812'
down_revision: Union[str, None] = 'c104434dbd19'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'download_links',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('file_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('token', sa.Text(), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_revoked', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('download_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('last_downloaded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['file_id'], ['stored_files.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_download_links_user_id'), 'download_links', ['user_id'], unique=False)
    op.create_index(op.f('ix_download_links_file_id'), 'download_links', ['file_id'], unique=False)
    op.create_index(op.f('ix_download_links_token_hash'), 'download_links', ['token_hash'], unique=False)
    op.create_index(op.f('ix_download_links_expires_at'), 'download_links', ['expires_at'], unique=False)
    op.create_index('ix_download_links_user_expires', 'download_links', ['user_id', 'expires_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_download_links_user_expires', table_name='download_links')
    op.drop_index(op.f('ix_download_links_expires_at'), table_name='download_links')
    op.drop_index(op.f('ix_download_links_token_hash'), table_name='download_links')
    op.drop_index(op.f('ix_download_links_file_id'), table_name='download_links')
    op.drop_index(op.f('ix_download_links_user_id'), table_name='download_links')
    op.drop_table('download_links')

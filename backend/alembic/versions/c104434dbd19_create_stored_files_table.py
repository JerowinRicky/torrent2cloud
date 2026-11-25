"""create_stored_files_table

Revision ID: c104434dbd19
Revises: aeebddb299a4
Create Date: 2026-11-25 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c104434dbd19'
down_revision: Union[str, None] = 'aeebddb299a4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'stored_files',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('job_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('torrent_file_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('filename', sa.String(length=512), nullable=False),
        sa.Column('relative_path', sa.String(length=1024), nullable=False),
        sa.Column('file_size', sa.BigInteger(), server_default='0', nullable=False),
        sa.Column('extension', sa.String(length=32), nullable=False),
        sa.Column('mime_type', sa.String(length=128), server_default='application/octet-stream', nullable=False),
        sa.Column('category', sa.String(length=32), server_default='OTHER', nullable=False),
        sa.Column('storage_path', sa.String(length=1024), nullable=False),
        sa.Column('sha256_hash', sa.String(length=64), nullable=True),
        sa.Column('is_available', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['job_id'], ['torrent_jobs.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['torrent_file_id'], ['torrent_files.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_stored_files_user_id'), 'stored_files', ['user_id'], unique=False)
    op.create_index(op.f('ix_stored_files_job_id'), 'stored_files', ['job_id'], unique=False)
    op.create_index(op.f('ix_stored_files_filename'), 'stored_files', ['filename'], unique=False)
    op.create_index(op.f('ix_stored_files_extension'), 'stored_files', ['extension'], unique=False)
    op.create_index(op.f('ix_stored_files_category'), 'stored_files', ['category'], unique=False)
    op.create_index('ix_stored_files_user_category', 'stored_files', ['user_id', 'category'], unique=False)
    op.create_index('ix_stored_files_user_created_at', 'stored_files', ['user_id', 'created_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_stored_files_user_created_at', table_name='stored_files')
    op.drop_index('ix_stored_files_user_category', table_name='stored_files')
    op.drop_index(op.f('ix_stored_files_category'), table_name='stored_files')
    op.drop_index(op.f('ix_stored_files_extension'), table_name='stored_files')
    op.drop_index(op.f('ix_stored_files_filename'), table_name='stored_files')
    op.drop_index(op.f('ix_stored_files_job_id'), table_name='stored_files')
    op.drop_index(op.f('ix_stored_files_user_id'), table_name='stored_files')
    op.drop_table('stored_files')

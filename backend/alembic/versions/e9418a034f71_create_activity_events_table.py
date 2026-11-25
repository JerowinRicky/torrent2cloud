"""create_activity_events_table

Revision ID: e9418a034f71
Revises: d8972e25a812
Create Date: 2026-11-25 11:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e9418a034f71'
down_revision: Union[str, None] = 'd8972e25a812'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'activity_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('event_type', sa.String(length=64), nullable=False),
        sa.Column('severity', sa.String(length=16), server_default='INFO', nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('entity_type', sa.String(length=32), nullable=True),
        sa.Column('entity_id', sa.String(length=64), nullable=True),
        sa.Column('ip_address', sa.String(length=64), nullable=True),
        sa.Column('user_agent', sa.String(length=255), nullable=True),
        sa.Column('meta_data', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_activity_events_user_id'), 'activity_events', ['user_id'], unique=False)
    op.create_index(op.f('ix_activity_events_event_type'), 'activity_events', ['event_type'], unique=False)
    op.create_index(op.f('ix_activity_events_severity'), 'activity_events', ['severity'], unique=False)
    op.create_index(op.f('ix_activity_events_created_at'), 'activity_events', ['created_at'], unique=False)
    op.create_index('ix_activity_events_user_created', 'activity_events', ['user_id', 'created_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_activity_events_user_created', table_name='activity_events')
    op.drop_index(op.f('ix_activity_events_created_at'), table_name='activity_events')
    op.drop_index(op.f('ix_activity_events_severity'), table_name='activity_events')
    op.drop_index(op.f('ix_activity_events_event_type'), table_name='activity_events')
    op.drop_index(op.f('ix_activity_events_user_id'), table_name='activity_events')
    op.drop_table('activity_events')

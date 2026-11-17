"""add github oauth states table

Revision ID: a1b2c3d4e5
Revises: 199ec362e261
Create Date: 2026-11-17 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5'
down_revision: Union[str, Sequence[str], None] = '199ec362e261'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'github_oauth_states',
        sa.Column('state', sa.Uuid(), nullable=False),
        sa.Column('clerk_user_id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('state'),
    )
    op.create_index(
        op.f('ix_github_oauth_states_clerk_user_id'),
        'github_oauth_states',
        ['clerk_user_id'],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_github_oauth_states_clerk_user_id'), table_name='github_oauth_states')
    op.drop_table('github_oauth_states')

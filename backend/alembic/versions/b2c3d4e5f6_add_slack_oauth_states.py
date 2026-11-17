"""add slack oauth states and workspace token columns

Revision ID: b2c3d4e5f6
Revises: a1b2c3d4e5
Create Date: 2026-11-17 09:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'slack_oauth_states',
        sa.Column('state', sa.Uuid(), nullable=False),
        sa.Column('clerk_user_id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('state'),
    )
    op.create_index(
        op.f('ix_slack_oauth_states_clerk_user_id'),
        'slack_oauth_states',
        ['clerk_user_id'],
        unique=False,
    )
    op.add_column('workspaces', sa.Column('slack_token_encrypted', sa.String(), nullable=True))
    op.add_column('workspaces', sa.Column('slack_team_name', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('workspaces', 'slack_team_name')
    op.drop_column('workspaces', 'slack_token_encrypted')
    op.drop_index(op.f('ix_slack_oauth_states_clerk_user_id'), table_name='slack_oauth_states')
    op.drop_table('slack_oauth_states')

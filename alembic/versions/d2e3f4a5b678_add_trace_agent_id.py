"""add trace agent_id and kind columns

Revision ID: d2e3f4a5b678
Revises: b1c3d4e5f678
Create Date: 2026-06-30 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd2e3f4a5b678'
down_revision: Union[str, Sequence[str], None] = 'b1c3d4e5f678'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('traces', sa.Column('agent_id', sa.String(), nullable=True))
    op.add_column('traces', sa.Column('kind', sa.String(), nullable=True))
    op.create_index('ix_traces_agent_id', 'traces', ['agent_id'])


def downgrade() -> None:
    op.drop_index('ix_traces_agent_id', table_name='traces')
    op.drop_column('traces', 'kind')
    op.drop_column('traces', 'agent_id')

"""add_agent_profiles

Revision ID: b1c3d4e5f678
Revises: a0b9b6215dcd
Create Date: 2026-06-30 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision: str = 'b1c3d4e5f678'
down_revision: Union[str, Sequence[str], None] = 'a0b9b6215dcd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('agents', sa.Column('eval_profile', JSONB, nullable=True))
    op.add_column('agents', sa.Column('redteam_profile', JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column('agents', 'redteam_profile')
    op.drop_column('agents', 'eval_profile')

"""merge_bulletins_and_public_education

Revision ID: 2025_01_13_merge_heads
Create Date: 2025-01-13

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '2025_01_13_merge_heads'
down_revision = ('2024_12_21_add_bulletins', '2025_01_13_add_public_education')
branch_labels = None
depends_on = None

def upgrade():
    pass

def downgrade():
    pass 
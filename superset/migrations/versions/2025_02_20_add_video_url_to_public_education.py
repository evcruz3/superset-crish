"""add_video_url_to_public_education

Revision ID: 2025_02_20_add_video_url
Revises: 042a3b592c38
Create Date: 2025-02-20 19:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '2025_02_20_add_video_url'
down_revision = '042a3b592c38'  # Point to the existing head

def upgrade():
    op.add_column('public_education_posts', sa.Column('video_url', sa.String(1000), nullable=True))

def downgrade():
    op.drop_column('public_education_posts', 'video_url') 
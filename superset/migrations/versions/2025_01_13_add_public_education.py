"""add_public_education_tables

Revision ID: 2025_01_13_add_public_education
Create Date: 2025-01-13

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '2025_01_13_add_public_education'
down_revision = '48cbb571fa3a'  # Set to point to the bulletins migration

def upgrade():
    # Create public education posts table
    op.create_table(
        'public_education_posts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('hashtags', sa.String(length=255), nullable=False),
        sa.Column('created_by_fk', sa.Integer(), nullable=False),
        sa.Column('created_on', sa.DateTime(), nullable=False),
        sa.Column('changed_on', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['created_by_fk'], ['ab_user.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create public education attachments table
    op.create_table(
        'public_education_attachments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('post_id', sa.Integer(), nullable=False),
        sa.Column('file_name', sa.String(length=255), nullable=False),
        sa.Column('file_type', sa.String(length=50), nullable=False),
        sa.Column('file_path', sa.String(length=1000), nullable=False),
        sa.Column('created_on', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['post_id'], ['public_education_posts.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

def downgrade():
    op.drop_table('public_education_attachments')
    op.drop_table('public_education_posts') 
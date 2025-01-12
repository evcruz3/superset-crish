"""add_bulletins_table

Revision ID: 2024_12_add_bulletins
Create Date: 2024-12-21

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '2024_12_21_add_bulletins'
down_revision = '48cbb571fa3a'  # Updated with the current head

def upgrade():
    op.create_table(
        'bulletins',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('hashtags', sa.String(length=500), nullable=True),
        sa.Column('chart_id', sa.Integer(), nullable=True),
        sa.Column('created_by_fk', sa.Integer(), nullable=False),
        sa.Column('created_on', sa.DateTime(), nullable=False),
        sa.Column('changed_on', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['chart_id'], ['slices.id'], ),
        sa.ForeignKeyConstraint(['created_by_fk'], ['ab_user.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

def downgrade():
    op.drop_table('bulletins')
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""rename_message_to_advisory_and_add_new_fields

Revision ID: 042a3b592c38
Revises: 2025_01_13_merge_heads
Create Date: 2025-02-14 03:09:58.359380

"""

# revision identifiers, used by Alembic.
revision = '042a3b592c38'
down_revision = '2025_01_13_merge_heads'

from alembic import op
import sqlalchemy as sa


def upgrade():
    # Rename message column to advisory
    with op.batch_alter_table('bulletins') as batch_op:
        batch_op.alter_column('message', new_column_name='advisory')
        
        # Add new columns
        batch_op.add_column(sa.Column('risks', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('safety_tips', sa.Text(), nullable=True))
    
    # Update existing rows to have non-null values for new columns
    op.execute("UPDATE bulletins SET risks = 'No risks specified' WHERE risks IS NULL")
    op.execute("UPDATE bulletins SET safety_tips = 'No safety tips specified' WHERE safety_tips IS NULL")
    
    # Now make the new columns non-nullable
    with op.batch_alter_table('bulletins') as batch_op:
        batch_op.alter_column('risks', nullable=False)
        batch_op.alter_column('safety_tips', nullable=False)


def downgrade():
    with op.batch_alter_table('bulletins') as batch_op:
        # Remove the new columns
        batch_op.drop_column('risks')
        batch_op.drop_column('safety_tips')
        
        # Rename advisory back to message
        batch_op.alter_column('advisory', new_column_name='message')

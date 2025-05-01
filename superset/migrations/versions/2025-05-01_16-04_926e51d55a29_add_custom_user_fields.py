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
"""add_custom_user_fields

Revision ID: 926e51d55a29
Revises: babaeab59ec1
Create Date: 2025-05-01 16:04:39.309595

"""

# revision identifiers, used by Alembic.
revision = '926e51d55a29'
down_revision = 'babaeab59ec1'

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

def upgrade():
    # Add gender and age_range columns to the ab_register_user table
    with op.batch_alter_table('ab_register_user') as batch_op:
        batch_op.add_column(sa.Column('gender', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('age_range', sa.String(length=50), nullable=True))
    
    # Add the same columns to the ab_user table to store them after registration
    with op.batch_alter_table('ab_user') as batch_op:
        batch_op.add_column(sa.Column('gender', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('age_range', sa.String(length=50), nullable=True))

def downgrade():
    # Remove the custom columns when downgrading
    with op.batch_alter_table('ab_register_user') as batch_op:
        batch_op.drop_column('gender')
        batch_op.drop_column('age_range')
    
    with op.batch_alter_table('ab_user') as batch_op:
        batch_op.drop_column('gender')
        batch_op.drop_column('age_range')

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
"""add_slug_to_slices

Revision ID: 01ad031f79d0
Revises: previous_revision_id
Create Date: 2025-02-24 14:07:21.974123

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '01ad031f79d0'
down_revision = '2025_02_20_add_video_url'  # Set this to the other head revision
depends_on = None

def upgrade():
    with op.batch_alter_table('slices') as batch_op:
        batch_op.add_column(sa.Column('slug', sa.String(length=255), nullable=True))
        batch_op.create_unique_constraint('uq_slices_slug', ['slug'])

def downgrade():
    with op.batch_alter_table('slices') as batch_op:
        batch_op.drop_constraint('uq_slices_slug', type_='unique')
        batch_op.drop_column('slug')

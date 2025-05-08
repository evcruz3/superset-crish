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

from sqlalchemy import Column, Date, Integer, Text, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
import sqlalchemy.types
from datetime import datetime

from flask_appbuilder import Model

class DiseaseForecastAlert(Model):
    __tablename__ = "disease_forecast_alerts"  # Must match table from ETL

    id = Column(Integer, primary_key=True, autoincrement=True)
    municipality_code = Column(Text, nullable=True) # Allow null if ISO code not found
    municipality_name = Column(Text, nullable=False)
    forecast_date = Column(Date, nullable=False)  # Represents week_start of the forecast
    disease_type = Column(Text, nullable=False)  # e.g., "Dengue", "Diarrhea"
    alert_level = Column(Text, nullable=False)
    alert_title = Column(Text, nullable=False)
    alert_message = Column(Text, nullable=False)
    predicted_cases = Column(Integer, nullable=False)

    # While 'id' is the primary key, a unique constraint on the logical key
    # can be useful for data integrity if records were to be inserted
    # manually or by other processes outside the ETL's "drop and replace".
    # This also helps if we need to query by these fields to find a record
    # before an update/delete via composite ID.
    __table_args__ = (
        UniqueConstraint(
            "municipality_code", "forecast_date", "disease_type", "municipality_name", 
            name="uq_disease_alert_key"
        ),
    )

    def __repr__(self) -> str:
        return f"<DiseaseForecastAlert {self.municipality_name} ({self.municipality_code}) {self.disease_type} {self.forecast_date}>"

    @property
    def composite_id(self) -> str:
        # Ensure forecast_date is a string. If it's a date object, format it.
        forecast_date_str = self.forecast_date.isoformat() if self.forecast_date else "nodate"
        return f"{self.municipality_code or 'nocode'}_{forecast_date_str}_{self.disease_type}"

class DiseasePipelineRunHistory(Model):
    __tablename__ = "disease_pipeline_run_history" # Must match table from ETL/disease_alert_generator.py

    id = Column(Integer, primary_key=True, autoincrement=True)
    ran_at = Column(sqlalchemy.types.TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)
    pipeline_name = Column(Text, nullable=False)
    status = Column(Text, nullable=False) # e.g., "Success", "Failed", "Partial"
    details = Column(Text, nullable=True)
    municipalities_processed_count = Column(Integer, default=0)
    alerts_generated_count = Column(Integer, default=0)
    bulletins_created_count = Column(Integer, default=0)

    def __repr__(self) -> str:
        return f"<DiseasePipelineRunHistory {self.pipeline_name} ({self.status}) at {self.ran_at}>" 
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
from __future__ import annotations

from datetime import datetime, date
from typing import Any

import sqlalchemy as sa
from flask_appbuilder import Model
from sqlalchemy import Column, Float, ForeignKey, Integer, String, Table, Text, PrimaryKeyConstraint
from sqlalchemy.orm import relationship

from superset import db
from superset.models.helpers import AuditMixinNullable


class WeatherForecastAlert(Model):
    """A model for weather parameter forecast alerts."""

    __tablename__ = "weather_forecast_alerts"
    
    # Define all columns from the database table
    municipality_code = Column(String(10), nullable=False, primary_key=True)
    forecast_date = Column(String(20), nullable=False, primary_key=True)  # Changed to String to match database
    weather_parameter = Column(String(50), nullable=False, primary_key=True)
    municipality_name = Column(String(100), nullable=True)
    alert_level = Column(String(50), nullable=False)
    alert_title = Column(String(100), nullable=False)
    alert_message = Column(Text, nullable=False)
    parameter_value = Column(Float, nullable=False)
    
    # Create a composite primary key
    __table_args__ = (
        PrimaryKeyConstraint('municipality_code', 'forecast_date', 'weather_parameter'),
    )
    
    def __repr__(self) -> str:
        return f"<WeatherForecastAlert {self.municipality_code} {self.forecast_date} {self.weather_parameter}>"
    
    # Property to simulate having an id for compatibility with Flask-AppBuilder
    @property
    def id(self):
        return f"{self.municipality_code}_{self.forecast_date}_{self.weather_parameter}"
    
    @property
    def data(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "municipality_code": self.municipality_code,
            "municipality_name": self.municipality_name,
            "forecast_date": self.forecast_date,  # Don't try to format it as a date
            "weather_parameter": self.weather_parameter,
            "alert_level": self.alert_level,
            "alert_title": self.alert_title,
            "alert_message": self.alert_message,
            "parameter_value": self.parameter_value,
        } 
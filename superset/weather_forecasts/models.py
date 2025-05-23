from sqlalchemy import Column, String, Date, Float, Integer, PrimaryKeyConstraint, TypeDecorator
from flask_appbuilder import Model
from datetime import date as py_date # Alias to avoid conflict with sqlalchemy.Date

# Custom TypeDecorator to store Python date objects as ISO formatted TEXT in SQLite
class DateAsText(TypeDecorator):
    impl = String  # Store as a string in the database
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, py_date):
            return value.isoformat()
        raise ValueError("DateAsText expects a Python datetime.date object or None")

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return py_date.fromisoformat(value)

class BaseWeatherParameterModel(Model):
    """Base model for common weather parameter fields and composite primary key."""
    __abstract__ = True # Ensure this base class doesn't create its own table

    # Composite Primary Key definition will be in subclasses using __table_args__
    forecast_date = Column(DateAsText, nullable=False, primary_key=True)
    day_name = Column(String(20)) # e.g., Monday
    value = Column(Float, nullable=False)
    municipality_code = Column(String(15), nullable=False, primary_key=True) # e.g., TL-DI
    municipality_name = Column(String(100))

    # Ensure specific table args are defined in subclasses
    # __table_args__ = (
    #     PrimaryKeyConstraint('forecast_date', 'municipality_code'),
    # )

    def __repr__(self):
        return f"<{self.__class__.__name__} ({self.municipality_code} on {self.forecast_date}): {self.value}>"

    @property
    def id(self):
        """Provides a composite ID for Flask-AppBuilder compatibility if needed,
           though direct composite key handling in API is preferred for PUT/DELETE."""
        return f"{self.municipality_code}_{self.forecast_date.isoformat()}"


class WindSpeedDailyAvgRegion(BaseWeatherParameterModel):
    __tablename__ = "ws_daily_avg_region"
    __table_args__ = (
        PrimaryKeyConstraint('forecast_date', 'municipality_code', name='pk_ws_daily_avg_region'),
    )

class HeatIndexDailyRegion(BaseWeatherParameterModel):
    __tablename__ = "heat_index_daily_region"
    __table_args__ = (
        PrimaryKeyConstraint('forecast_date', 'municipality_code', name='pk_heat_index_daily_region'),
    )

class RainfallDailyWeightedAverage(BaseWeatherParameterModel):
    __tablename__ = "rainfall_daily_weighted_average"
    __table_args__ = (
        PrimaryKeyConstraint('forecast_date', 'municipality_code', name='pk_rainfall_daily_weighted_average'),
    )

class RhDailyAvgRegion(BaseWeatherParameterModel):
    __tablename__ = "rh_daily_avg_region"
    __table_args__ = (
        PrimaryKeyConstraint('forecast_date', 'municipality_code', name='pk_rh_daily_avg_region'),
    )

class TmaxDailyTmaxRegion(BaseWeatherParameterModel):
    __tablename__ = "tmax_daily_tmax_region"
    __table_args__ = (
        PrimaryKeyConstraint('forecast_date', 'municipality_code', name='pk_tmax_daily_tmax_region'),
    )

class TminDailyTminRegion(BaseWeatherParameterModel):
    __tablename__ = "tmin_daily_tmin_region"
    __table_args__ = (
        PrimaryKeyConstraint('forecast_date', 'municipality_code', name='pk_tmin_daily_tmin_region'),
    )

# A consolidated/denormalized view or table might be more efficient for the API
# For now, we'll assume the API will query these individual tables.
# If a unified table/view 'weather_forecasts' exists or is preferred, 
# the model structure would need to change.

# Example for a consolidated model (if you had a single table for all forecasts)
# class WeatherForecast(Base):
#     __tablename__ = "weather_forecasts" # Assuming a consolidated table
#     id = Column(Integer, primary_key=True)
#     forecast_date = Column(Date, nullable=False, index=True)
#     day_name = Column(String(10))
#     municipality_code = Column(String(10), nullable=False, index=True)
#     municipality_name = Column(String(100))
#     weather_parameter = Column(String(50), nullable=False, index=True) # e.g., 'ws_daily_avg_region', 'heat_index'
#     value = Column(Float)
#
#     __table_args__ = (
#         UniqueConstraint('municipality_code', 'forecast_date', 'weather_parameter', name='_municipality_forecast_parameter_uc'),
#     )
#
#     def __repr__(self):
#         return f"<WeatherForecast {self.municipality_name} {self.forecast_date} - {self.weather_parameter}: {self.value}>"

# For the API, it's often better to have a single, queryable "weather forecast" entity.
# The provided table names suggest separate tables for each parameter.
# We will need a strategy in the API to query across these or assume a unified source.
# For now, let's define a generic WeatherForecast model that the API can use,
# and the data retrieval logic will need to adapt based on the actual database structure.

class WeatherForecast(Model):
    __tablename__ = "weather_forecasts_consolidated" # This is a placeholder name. 
                                                 # The actual source might be a view or union of the above tables.
    
    id = Column(Integer, autoincrement=True)
    forecast_date = Column(Date, nullable=False, index=True)
    day_name = Column(String(50))
    municipality_code = Column(String(50), nullable=False, index=True)
    municipality_name = Column(String(255))
    
    # These fields will store the actual weather parameter values.
    # Using individual columns for each parameter for simplicity in the model.
    # The API will need to handle how these are populated/queried if they come from different tables.
    wind_speed_avg = Column(Float, name="ws_daily_avg_region_value")
    heat_index = Column(Float, name="heat_index_daily_region_value")
    rainfall_avg = Column(Float, name="rainfall_daily_weighted_average_value")
    humidity_avg = Column(Float, name="rh_daily_avg_region_value")
    temp_max = Column(Float, name="tmax_daily_tmax_region_value")
    temp_min = Column(Float, name="tmin_daily_tmin_region_value")

    # If you want to query by a generic "weather_parameter" name and its value,
    # you might need a different structure or advanced querying in the API.
    # For now, this model assumes a somewhat denormalized or joined source.

    __table_args__ = (
        PrimaryKeyConstraint('forecast_date', 'municipality_code', name='pk_weather_forecasts_municipality_date'),
    )

    def __repr__(self) -> str:
        return f"<WeatherForecast {self.municipality_name} ({self.municipality_code}) on {self.forecast_date}>"

    @property
    def meteorological_parameters(self) -> dict:
        return {
            "wind_speed_avg": self.wind_speed_avg,
            "heat_index": self.heat_index,
            "rainfall_avg": self.rainfall_avg,
            "humidity_avg": self.humidity_avg,
            "temp_max": self.temp_max,
            "temp_min": self.temp_min,
        } 
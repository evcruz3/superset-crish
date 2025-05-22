from sqlalchemy import Column, Integer, String, Date, Float, UniqueConstraint
from superset.models.core import Model
from flask_appbuilder import Model


class AirQualityForecast(Model):
    __tablename__ = "air_quality_forecasts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    municipality_code = Column(String(255), nullable=False)
    municipality_name = Column(String(255), nullable=False)
    forecast_date = Column(Date, nullable=False)  # Date of the forecast
    overall_aqi = Column(Integer, nullable=False)  # Overall Air Quality Index
    pm25 = Column(Float, nullable=True)  # Particulate Matter 2.5
    pm10 = Column(Float, nullable=True)  # Particulate Matter 10
    o3 = Column(Float, nullable=True)  # Ozone
    no2 = Column(Float, nullable=True)  # Nitrogen Dioxide
    so2 = Column(Float, nullable=True)  # Sulfur Dioxide
    co = Column(Float, nullable=True)  # Carbon Monoxide
    dominant_pollutant = Column(String(50), nullable=True) # e.g., "PM2.5", "O3"
    health_advisory = Column(String(1000), nullable=True) # Health recommendations

    __table_args__ = (
        UniqueConstraint(
            "municipality_code", "forecast_date", "municipality_name",
            name="uq_air_quality_forecast_key"
        ),
    )

    def __repr__(self) -> str:
        return f"<AirQualityForecast {self.municipality_name} ({self.municipality_code}) {self.forecast_date}>" 
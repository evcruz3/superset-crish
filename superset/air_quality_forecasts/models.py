from sqlalchemy import Column, Integer, String, DateTime, Float, JSON, UniqueConstraint
from superset.models.core import Model
from flask_appbuilder import Model


class AirQualityForecast(Model):
    __tablename__ = "air_quality_forecasts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    station_id = Column(String(50), nullable=True)  # Station ID from API
    station_name = Column(String(255), nullable=False)  # Station name
    city_name = Column(String(255), nullable=False)  # City name
    latitude = Column(String(50), nullable=True)  # Latitude as string
    longitude = Column(String(50), nullable=True)  # Longitude as string
    timestamp = Column(DateTime, nullable=False)  # Timestamp of measurement
    
    # Each pollutant stored as JSON with status, color, and value
    pm1_data = Column(JSON, nullable=True)  # {"status": "Good", "color": "#2ecc40", "value": 4.5}
    pm25_data = Column(JSON, nullable=True)  # {"status": "Good", "color": "#2ecc40", "value": 35}
    pm10_data = Column(JSON, nullable=True)  # {"status": "Good", "color": "#2ecc40", "value": 10}
    co2_data = Column(JSON, nullable=True)  # {"status": "Moderate", "color": "#f3eb12", "value": 402.6}

    __table_args__ = (
        UniqueConstraint(
            "station_name", "timestamp",
            name="uq_air_quality_station_timestamp"
        ),
    )

    def __repr__(self) -> str:
        return f"<AirQualityForecast {self.station_name} - {self.city_name} {self.timestamp}>" 
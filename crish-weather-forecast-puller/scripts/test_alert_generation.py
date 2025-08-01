#!/usr/bin/env python3
"""
Test script for weather alerts generation.
This script creates sample weather data dataframes and verifies the alert generation logic.
"""

import polars as pl
from transform_weather_data import generate_weather_alerts, ingest_to_postgresql
import random
import os
from dotenv import load_dotenv

def create_sample_dataframes():
    """Create sample dataframes for testing alert generation."""
    
    # Create a sample date range
    dates = ["2023-10-01", "2023-10-02", "2023-10-03", "2023-10-04", "2023-10-05"]
    
    # Sample municipalities
    municipalities = [
        ("TL-DI", "Dili"),
        ("TL-BA", "Baucau"),
        ("TL-LI", "Liquica"),
        ("TL-ER", "Ermera"),
        ("TL-AL", "Aileu")
    ]
    
    # Create base dataframe with common fields
    base_rows = []
    for date in dates:
        for code, name in municipalities:
            base_rows.append({
                "forecast_date": date,
                "day_name": "Monday",  # Not important for testing
                "municipality_code": code,
                "municipality_name": name
            })
    
    base_df = pl.DataFrame(base_rows)
    
    # Create heat index dataframe with some dangerous values
    heat_index_rows = []
    for row in base_df.to_dicts():
        # Generate some values that will trigger different alert levels
        value = random.choice([25, 28, 31, 35])  # Normal, Extreme Caution, Danger, Extreme Danger
        heat_index_rows.append({**row, "value": value})
    
    # Create rainfall dataframe with some dangerous values
    rainfall_rows = []
    for row in base_df.to_dicts():
        # Generate some values that will trigger different alert levels
        value = random.choice([10, 20, 30, 70])  # Normal, Extreme Caution, Danger, Extreme Danger
        rainfall_rows.append({**row, "value": value})
    
    # Create wind speed dataframe with some dangerous values
    wind_speed_rows = []
    for row in base_df.to_dicts():
        # Generate some values that will trigger different alert levels
        value = random.choice([30, 45, 65, 85])  # Normal, Extreme Caution, Danger, Extreme Danger
        wind_speed_rows.append({**row, "value": value})
    
    # Convert to polars dataframes
    heat_index_df = pl.DataFrame(heat_index_rows)
    rainfall_df = pl.DataFrame(rainfall_rows)
    wind_speed_df = pl.DataFrame(wind_speed_rows)
    
    # Return a dictionary of dataframes
    return {
        "heat_index_daily_region": heat_index_df,
        "rainfall_daily_weighted_average": rainfall_df,
        "ws_daily_avg_region": wind_speed_df
    }

def test_alert_generation():
    """Test the alert generation functionality."""
    print("Testing weather alert generation...")
    
    # Create sample dataframes
    dataframes = create_sample_dataframes()
    
    # Print sample data for each parameter
    for name, df in dataframes.items():
        print(f"\nSample {name} data:")
        print(df.head(3))
    
    # Generate alerts
    alerts_df = generate_weather_alerts(dataframes)
    
    if alerts_df is None:
        print("\nAlert generation failed!")
        return
    
    # Print alert results
    print("\nGenerated alerts:")
    print(f"Total alerts: {len(alerts_df)}")
    
    # Group and count by weather parameter and alert level
    alerts_by_param = alerts_df.group_by(["weather_parameter", "alert_level"]).agg(
        pl.count().alias("count")
    )
    print("\nAlerts by parameter and level:")
    print(alerts_by_param)
    
    # Show some sample alerts
    print("\nSample alerts:")
    print(alerts_df.head(10))
    
    print("\nAlert generation test completed successfully!")

def test_bulletin_creation():
    """Test bulletin creation from weather alerts."""
    load_dotenv()
    
    print("Testing bulletin creation from weather alerts...")
    
    # Make sure database credentials are available
    db_credentials = {
        'DATABASE_USER': os.getenv('DATABASE_USER', 'superset'),
        'DATABASE_PASSWORD': os.getenv('DATABASE_PASSWORD', 'superset'),
        'DATABASE_HOST': os.getenv('DATABASE_HOST', 'db'),
        'DATABASE_PORT': os.getenv('DATABASE_PORT', '5432'),
        'DATABASE_DB': os.getenv('DATABASE_DB', 'superset')
    }
    
    print("Database credentials loaded:")
    for key, value in db_credentials.items():
        if 'PASSWORD' in key:
            print(f"{key}: {'SET' if value else 'NOT SET'}")
        else:
            print(f"{key}: {value}")
    
    # Create sample dataframes
    dataframes = create_sample_dataframes()
    
    # Generate alerts
    alerts_df = generate_weather_alerts(dataframes)
    
    if alerts_df is None:
        print("\nAlert generation failed!")
        return
    
    # Add alerts to dataframes dictionary for ingestion
    dataframes['weather_forecast_alerts'] = alerts_df
    
    # Test ingestion with bulletin creation
    try:
        ingest_to_postgresql(dataframes)
        print("\nBulletin creation test completed successfully!")
    except Exception as e:
        print(f"\nBulletin creation test failed: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # test_alert_generation()
    test_bulletin_creation() 
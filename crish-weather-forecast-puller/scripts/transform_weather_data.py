import json
from datetime import datetime
from pathlib import Path
import os
import polars as pl
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import execute_values

# Load environment variables
load_dotenv()

def get_day_name(date_str):
    """Convert ISO date string to day name."""
    dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    return dt.strftime('%A')

def get_table_name(json_file):
    """Extract table name from JSON filename."""
    # Remove _data.json and return the base name
    return os.path.basename(json_file).replace('_data.json', '')

def calculate_heat_index(tmax_df, rh_df):
    """Calculate heat index using temperature and relative humidity data."""
    # Merge temperature and humidity data
    merged_df = tmax_df.join(
        rh_df,
        on=['forecast_date', 'municipality_code'],
        how='inner',
        suffix='_rh'
    )
    
    # Calculate heat index using the formula
    heat_index_df = merged_df.with_columns([
        # Convert Celsius to Fahrenheit for the formula
        (pl.col('value') * 9 / 5 + 32).alias('t_fahrenheit'),
        pl.col('value_rh').alias('rh_value')
    ]).with_columns([
        # Heat Index formula
        (-42.379 +
         2.04901523 * pl.col('t_fahrenheit') +
         10.14333127 * pl.col('rh_value') -
         0.22475541 * pl.col('t_fahrenheit') * pl.col('rh_value') -
         0.00683783 * pl.col('t_fahrenheit').pow(2) -
         0.05481717 * pl.col('rh_value').pow(2) +
         0.00122874 * pl.col('t_fahrenheit').pow(2) * pl.col('rh_value') +
         0.00085282 * pl.col('t_fahrenheit') * pl.col('rh_value').pow(2) -
         0.00000199 * pl.col('t_fahrenheit').pow(2) * pl.col('rh_value').pow(2)
        ).alias('heat_index_f')
    ]).with_columns([
        # Convert back to Celsius
        ((pl.col('heat_index_f') - 32) * 5 / 9).alias('value')
    ])
    
    # Select and rename columns to match schema
    return heat_index_df.select([
        'forecast_date',
        'day_name',
        'value',
        'municipality_code',
        'municipality_name'
    ])

def transform_weather_data(input_file):
    """Transform weather JSON data into database-friendly format using Polars."""
    # Read JSON file
    with open(input_file, 'r') as f:
        data = json.load(f)
    
    # Municipality codes mapping
    municipality_codes = {
        'Atauro': 'TL-AT',
        'Aileu': 'TL-AL',
        'Ainaro': 'TL-AN',
        'Baucau': 'TL-BA',
        'Bobonaro': 'TL-BO',
        'Covalima': 'TL-CO',
        'Dili': 'TL-DI',
        'Ermera': 'TL-ER',
        'Lautém': 'TL-LA',
        'Liquiçá': 'TL-LI',
        'Manatuto': 'TL-MT',
        'Manufahi': 'TL-MF',
        'Oecusse': 'TL-OE',
        'Viqueque': 'TL-VI'
    }

    # Create lists to store the data
    rows = []
    for municipality_name, data_obj in data['r_data'].items():
        for time_period, value in zip(data_obj['time'], data_obj['value']):
            forecast_date = time_period[0]  # Using start date of the period
            rows.append({
                'forecast_date': forecast_date,
                'day_name': get_day_name(forecast_date),
                'value': value,
                'municipality_code': municipality_codes.get(municipality_name, ''),
                'municipality_name': municipality_name
            })
    
    # Create Polars DataFrame
    df = pl.DataFrame(rows)
    
    # Transform the date format to remove time component
    df = df.with_columns([
        pl.col('forecast_date').str.slice(0, 10).alias('forecast_date')
    ])
    
    return df

def process_weather_files():
    """Process all weather parameter files in the data directory using Polars."""
    data_dir = Path(__file__).parent.parent / 'data'
    weather_files = [
        'rainfall_daily_weighted_average_data.json',
        'rh_daily_avg_region_data.json',
        'tmax_daily_tmax_region_data.json',
        'ws_daily_avg_region_data.json',
        'tmin_daily_tmin_region_data.json'
    ]
    
    dataframes = {}  # Store DataFrames for each weather parameter
    
    for filename in weather_files:
        input_file = data_dir / filename
        if input_file.exists():
            # Transform the data
            df = transform_weather_data(input_file)
            table_name = get_table_name(filename)
            dataframes[table_name] = df
    
    # Calculate heat index if we have both temperature and humidity data
    if 'tmax_daily_tmax_region' in dataframes and 'rh_daily_avg_region' in dataframes:
        heat_index_df = calculate_heat_index(
            dataframes['tmax_daily_tmax_region'],
            dataframes['rh_daily_avg_region']
        )
        dataframes['heat_index_daily_region'] = heat_index_df
    
    return dataframes

def ingest_to_postgresql(dataframes):
    """Ingest dataframes into PostgreSQL database using Polars write_database with ADBC."""
    # Construct PostgreSQL connection URI from environment variables with fallbacks
    db_uri = (
        f"postgresql://{os.getenv('DATABASE_USER', 'superset')}:{os.getenv('DATABASE_PASSWORD', 'superset')}"
        f"@{os.getenv('DATABASE_HOST', 'db')}:{os.getenv('DATABASE_PORT', '5432')}"
        f"/{os.getenv('DATABASE_DB', 'superset')}"
    )
    
    try:
        for table_name, df in dataframes.items():
            print(f"Ingesting data to PostgreSQL for table: {table_name}")
            # Write DataFrame to database using Polars native method with ADBC
            rows_affected = df.write_database(
                table_name=table_name,
                connection=db_uri,
                if_table_exists='replace',  # This will create new or replace existing table
                engine='adbc'  # Using ADBC engine instead of SQLAlchemy
            )
            
            print(f"Successfully inserted/updated {rows_affected} rows into {table_name}")
        
        print("All data successfully ingested to PostgreSQL")
        
    except Exception as e:
        print(f"Error ingesting data to PostgreSQL: {str(e)}")

def main():
    # Process all weather files and get DataFrames
    dataframes = process_weather_files()
    
    # Print DataFrame information
    for table_name, df in dataframes.items():
        print(f"\nDataFrame for {table_name}:")
        print(df.head())
        print(f"Shape: {df.shape}")
        print(f"Schema:\n{df.schema}")
    
    # Ingest data to PostgreSQL
    ingest_to_postgresql(dataframes)

if __name__ == '__main__':
    main() 
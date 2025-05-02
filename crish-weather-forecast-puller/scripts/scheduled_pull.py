from dotenv import load_dotenv
import schedule
import time
import logging
import subprocess
import sys
import signal
import os
import json
import psycopg2
from pathlib import Path
from transform_weather_data import process_weather_files, ingest_to_postgresql
from datetime import datetime

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)

def record_pull_history(parameters_pulled, status="Success", details=None):
    """Record a pull history directly to the database."""
    try:
        # Load environment variables
        load_dotenv()
        
        # Get database connection details - use the same DB as for weather data
        db_host = os.getenv('DATABASE_HOST', 'db')
        db_port = os.getenv('DATABASE_PORT', '5432')
        db_name = os.getenv('DATABASE_DB', 'superset')
        db_user = os.getenv('DATABASE_USER', 'superset')
        db_password = os.getenv('DATABASE_PASSWORD', 'superset')
        
        # Connect to the database
        db_uri = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
        logging.info(f"Connecting to database at {db_host}:{db_port} to record pull history")
        
        # Insert record directly into the database
        with psycopg2.connect(db_uri) as conn:
            with conn.cursor() as cur:
                # First, check if the table exists and create it if it doesn't
                cur.execute("""
                SELECT EXISTS (
                   SELECT FROM information_schema.tables 
                   WHERE table_name = 'weather_data_pull_history'
                );
                """)
                table_exists = cur.fetchone()[0]
                
                if not table_exists:
                    logging.info("Creating weather_data_pull_history table")
                    # Create the table based on the model definition
                    cur.execute("""
                    CREATE TABLE weather_data_pull_history (
                        id SERIAL PRIMARY KEY,
                        pulled_at TIMESTAMP NOT NULL DEFAULT NOW(),
                        parameters_pulled VARCHAR(255) NOT NULL,
                        pull_status VARCHAR(50) NOT NULL DEFAULT 'Success',
                        details TEXT
                    );
                    """)
                    conn.commit()
                    logging.info("Table created successfully")
                
                # Insert into weather_data_pull_history table
                sql = """
                INSERT INTO weather_data_pull_history 
                (pulled_at, parameters_pulled, pull_status, details)
                VALUES (%s, %s, %s, %s)
                """
                cur.execute(sql, (
                    datetime.now(),
                    parameters_pulled,
                    status,
                    details or ""
                ))
                conn.commit()
                
            logging.info(f"Successfully recorded pull history: {parameters_pulled}")
            
    except Exception as e:
        logging.error(f"Failed to record pull history: {str(e)}")
        logging.exception("Full error traceback:")

def pull_data():
    try:
        # Load environment variables
        load_dotenv()
        
        # Determine data directory based on environment
        if os.getenv('DOCKER_ENV'):
            # When running in Docker
            data_dir = Path('/app/data').resolve()
        else:
            # When running locally
            data_dir = Path('./data').resolve()
            
        data_dir.mkdir(parents=True, exist_ok=True)
        logging.info(f"Using data directory: {data_dir}")
        
        # Log all relevant environment variables (without sensitive values)
        env_vars = {
            'DATAEX_USERNAME': os.getenv('DATAEX_USERNAME'),
            'DATAEX_PASSWORD': bool(os.getenv('DATAEX_PASSWORD')),  # Just log if it exists
            'DATABASE_HOST': os.getenv('DATABASE_HOST', 'db'),
            'DATABASE_PORT': os.getenv('DATABASE_PORT', '5432'),
            'DATABASE_DB': os.getenv('DATABASE_DB', 'superset'),
            'DATABASE_USER': os.getenv('DATABASE_USER', 'superset'),
            'DATABASE_PASSWORD': bool(os.getenv('DATABASE_PASSWORD'))  # Just log if it exists
        }
        
        logging.info("Starting data pull...")
        logging.info(f"Current working directory: {os.getcwd()}")
        logging.info("Environment variables status:")
        for key, value in env_vars.items():
            if key.endswith('PASSWORD'):
                logging.info(f"{key}: {'SET' if value else 'NOT SET'}")
            else:
                logging.info(f"{key}: {value if value else 'NOT SET'}")
        
        # Parameters to pull
        parameters = [
            'tmax_daily_tmax_region',
            'rainfall_daily_weighted_average',
            'rh_daily_avg_region',
            'ws_daily_avg_region',
            'tmin_daily_tmin_region'
        ]
        
        pull_success = True  # Track if all pulls are successful
        pull_details = []  # Store details about the pull
        
        for param in parameters:
            output_file = data_dir / f'{param}_data.json'
            logging.info(f"Pulling data for parameter: {param}")
            
            # Construct command as a string
            if os.getenv('DOCKER_ENV'):
                base_dir = '/app'
            else:
                base_dir = os.getcwd()
                
            cmd = f"dataex_region_data_analysis.py -mt ecmwf_hres -r {param} -ai 9b4f37e1-00f4-4296-8c3a-914ee19989a6 -uf ADM1 -of json -o {output_file.absolute()}"
            logging.info(f"Running command: {cmd}")
            
            # Run with shell=True and capture all output
            result = subprocess.run(
                cmd,
                shell=True,
                capture_output=True,
                text=True,
                cwd=base_dir  # Use appropriate working directory
            )
            
            logging.info(f"Command exit code: {result.returncode}")
            logging.info(f"Command stdout: {result.stdout}")
            
            if result.stderr:
                logging.warning(f"Command stderr: {result.stderr}")
            
            if result.returncode == 0:
                # Wait briefly and check if file exists
                time.sleep(1)  # Give filesystem time to sync
                if output_file.exists():
                    file_size = output_file.stat().st_size
                    logging.info(f"Output file size: {file_size} bytes")
                    if file_size == 0:
                        logging.warning(f"Output file exists but is empty: {output_file}")
                        pull_success = False
                        pull_details.append(f"{param}: File empty")
                    else:
                        pull_details.append(f"{param}: Success ({file_size} bytes)")
                else:
                    logging.error(f"Output file was not created: {output_file}")
                    logging.error(f"Directory contents: {list(data_dir.glob('*'))}")
                    pull_success = False
                    pull_details.append(f"{param}: File not created")
            else:
                logging.error(f"Command failed with exit code {result.returncode}")
                pull_success = False
                pull_details.append(f"{param}: Failed with code {result.returncode}")
        
        # Record the pull attempt
        pull_status = "Success" if pull_success else "Partial" if any("Success" in detail for detail in pull_details) else "Failed"
        record_pull_history(','.join(parameters), pull_status, '; '.join(pull_details))
        
        # If all data pulls were successful, process and ingest the data
        if pull_success:
            logging.info("Starting data transformation and ingestion process...")
            try:
                dataframes = process_weather_files()
                ingest_to_postgresql(dataframes)
                logging.info("Data transformation and ingestion completed successfully")
            except Exception as e:
                logging.error(f"Error during data transformation/ingestion: {str(e)}")
                logging.exception("Full error traceback:")
            
    except Exception as e:
        logging.error(f"Failed to pull data: {str(e)}")
        logging.exception("Full error traceback:")
        # Record the failed pull
        record_pull_history("all", "Failed", str(e))

def main():
    # Handle graceful shutdown
    signal.signal(signal.SIGINT, lambda s, f: sys.exit(0))
    signal.signal(signal.SIGTERM, lambda s, f: sys.exit(0))
    
    logging.info("Starting scheduled data puller...")
    
    # Schedule job for midnight
    schedule.every().day.at("08:00").do(pull_data)
    logging.info("Scheduled daily pull at midnight")
    
    # Run once at startup
    pull_data()
    
    while True:
        schedule.run_pending()
        time.sleep(60)

if __name__ == "__main__":
    main() 
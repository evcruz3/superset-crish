from dotenv import load_dotenv
import schedule
import time
import logging
import subprocess
import sys
import signal
import os
from pathlib import Path
from transform_weather_data import process_weather_files, ingest_to_postgresql

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)

def pull_data():
    try:
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
            'ws_daily_avg_region'
        ]
        
        pull_success = True  # Track if all pulls are successful
        
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
                else:
                    logging.error(f"Output file was not created: {output_file}")
                    logging.error(f"Directory contents: {list(data_dir.glob('*'))}")
                    pull_success = False
            else:
                logging.error(f"Command failed with exit code {result.returncode}")
                pull_success = False
        
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

# Load environment variables
load_dotenv()

# Handle graceful shutdown
signal.signal(signal.SIGINT, lambda s, f: sys.exit(0))
signal.signal(signal.SIGTERM, lambda s, f: sys.exit(0))

logging.info("Starting scheduled data puller...")
logging.info(f"Running as user: {os.getuid()}:{os.getgid()}")
logging.info(f"Current working directory: {os.getcwd()}")
logging.info(f"Directory contents: {os.listdir('.')}")

# Schedule job for midnight
schedule.every().day.at("08:00").do(pull_data)
logging.info("Scheduled daily pull at midnight")

# Run once at startup
pull_data()

logging.info("Entering main loop...")
while True:
    try:
        schedule.run_pending()
        time.sleep(60)
        logging.debug("Main loop iteration completed")
    except Exception as e:
        logging.error(f"Error in main loop: {str(e)}")
        logging.exception("Full error traceback:")
        time.sleep(60)  # Still sleep to prevent rapid error loops 
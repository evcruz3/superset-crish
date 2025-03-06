#!/usr/bin/env python3

import os
from dotenv import load_dotenv
import schedule
import time
from datetime import datetime
import subprocess
import logging

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('pipeline.log'),
        logging.StreamHandler()
    ]
)

class PredictionPipeline:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.frequency = os.getenv('DISEASE_PREDICTION_PIPELINE_FREQUENCY', 'weekly')
        self.run_time = os.getenv('DISEASE_PREDICTION_PIPELINE_RUN_TIME', '01:00')
        self.run_immediate = os.getenv('DISEASE_PREDICTION_PIPELINE_RUN_IMMEDIATE', 'false').lower() == 'true'
        self.scripts = [
            'visual_crossing_puller.py',
            'dengue_predictor.py',
            'diarrhea_predictor.py',
            'upload_predictions.py'
        ]

    def run_script(self, script_name):
        """Run a Python script and log its output."""
        try:
            self.logger.info(f"Running {script_name}")
            result = subprocess.run(
                ['python3', script_name],
                capture_output=True,
                text=True,
                check=True
            )
            self.logger.info(f"{script_name} output:\n{result.stdout}")
            if result.stderr:
                self.logger.warning(f"{script_name} warnings:\n{result.stderr}")
            return True
        except subprocess.CalledProcessError as e:
            self.logger.error(f"Error running {script_name}:\n{e.stderr}")
            return False

    def run_pipeline(self):
        """Run the complete prediction pipeline."""
        self.logger.info("Starting disease prediction pipeline (current week + next week forecasts)")
        start_time = time.time()

        for script in self.scripts:
            if not self.run_script(script):
                self.logger.error(f"Pipeline failed at {script}")
                return False
            time.sleep(1)  # Small delay between scripts

        end_time = time.time()
        duration = end_time - start_time
        self.logger.info(f"Pipeline completed successfully in {duration:.2f} seconds")
        self.logger.info("Predictions include current week and next week forecasts")
        return True

    def schedule_pipeline(self):
        """Schedule the pipeline based on the configured frequency."""
        if self.frequency == 'daily':
            # Run daily at configured time
            schedule.every().day.at(self.run_time).do(self.run_pipeline)
            self.logger.info(f"Pipeline scheduled to run daily at {self.run_time}")
        
        elif self.frequency == 'weekly':
            # Run weekly on Monday at configured time
            schedule.every().monday.at(self.run_time).do(self.run_pipeline)
            self.logger.info(f"Pipeline scheduled to run weekly on Monday at {self.run_time}")
        
        elif self.frequency == 'monthly':
            # Run monthly on the 1st at configured time
            schedule.every().month.at(self.run_time).do(self.run_pipeline)
            self.logger.info(f"Pipeline scheduled to run monthly on the 1st at {self.run_time}")
        
        else:
            self.logger.error(f"Invalid frequency: {self.frequency}")
            return False

        # Log next run time
        next_run = schedule.next_run()
        if next_run:
            self.logger.info(f"Next pipeline run scheduled for: {next_run}")
        
        return True

def main():
    pipeline = PredictionPipeline()
    
    # Schedule the pipeline
    if not pipeline.schedule_pipeline():
        return

    # Run immediately if configured to do so
    if pipeline.run_immediate:
        pipeline.logger.info("Running pipeline immediately as configured")
        pipeline.run_pipeline()
    else:
        pipeline.logger.info("Skipping immediate run, waiting for scheduled time")
    
    # Keep the script running to maintain the schedule
    while True:
        schedule.run_pending()
        time.sleep(60)  # Check schedule every minute

if __name__ == "__main__":
    main() 
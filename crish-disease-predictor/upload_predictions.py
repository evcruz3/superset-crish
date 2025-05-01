#!/usr/bin/env python3

import os
from dotenv import load_dotenv
import psycopg2
import json
from datetime import datetime, timedelta
import isoweek

# Load environment variables
load_dotenv()

class PredictionUploader:
    def __init__(self):
        self.predictions_dir = os.getenv('PREDICTIONS_DIR', 'predictions')
        self.db_params = {
            'dbname': os.getenv('DATABASE_DB'),
            'user': os.getenv('DATABASE_USER'),
            'password': os.getenv('DATABASE_PASSWORD'),
            'host': os.getenv('DATABASE_HOST'),
            #  If os.getenv('DB_PORT') is not set, use 5432
            'port': os.getenv('DATABASE_PORT', '5432')
        }
        self.conn = None
        self.cursor = None
        
        # Municipality to ISO code mapping
        self.municipality_iso_codes = {
            'Aileu': 'TL-AL',
            'Ainaro': 'TL-AN',
            'Atauro': 'TL-AT',  # Custom code for Atauro
            'Baucau': 'TL-BA',
            'Bobonaro': 'TL-BO',
            'Covalima': 'TL-CO',
            'Dili': 'TL-DI',
            'Ermera': 'TL-ER',
            'Lautem': 'TL-LA',
            'Liquica': 'TL-LI',
            'Liquiça': 'TL-LI',
            'Manatuto': 'TL-MT',
            'Manufahi': 'TL-MF',
            'Raeoa': 'TL-OE',
            'Viqueque': 'TL-VI'
        }

    def connect(self):
        """Connect to the PostgreSQL database."""
        try:
            self.conn = psycopg2.connect(**self.db_params)
            self.cursor = self.conn.cursor()
            print("Connected to the database successfully")
        except Exception as e:
            print(f"Error connecting to the database: {str(e)}")
            raise

    def disconnect(self):
        """Close database connection."""
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()
            print("Database connection closed")

    def create_table_if_not_exists(self):
        """Create the disease_forecast table if it doesn't exist."""
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS disease_forecast (
            year INTEGER CHECK (year >= 2000),
            week_number INTEGER CHECK (week_number BETWEEN 1 AND 53),
            disease VARCHAR(50) NOT NULL,
            municipality_code CHAR(5) NOT NULL,
            municipality_name VARCHAR(50) NOT NULL,
            predicted_cases INTEGER CHECK (predicted_cases >= 0),
            forecast_date TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (year, week_number, disease, municipality_code)
        );
        
        -- Add forecast_date column if it doesn't exist
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'disease_forecast' AND column_name = 'forecast_date'
            ) THEN
                ALTER TABLE disease_forecast ADD COLUMN forecast_date TIMESTAMP;
            END IF;
        END $$;
        
        -- Create index for faster queries
        CREATE INDEX IF NOT EXISTS idx_disease_forecast_lookup 
        ON disease_forecast(disease, year, week_number);
        
        -- Create index for forecast date
        CREATE INDEX IF NOT EXISTS idx_disease_forecast_date 
        ON disease_forecast(forecast_date);
        """
        try:
            self.cursor.execute(create_table_sql)
            self.conn.commit()
            print("Table is ready")
        except Exception as e:
            print(f"Error creating table: {str(e)}")
            self.conn.rollback()
            raise

    def get_year_and_week(self, date_str):
        """Extract year and week number from a date string."""
        date = datetime.strptime(date_str, '%Y-%m-%d')
        year = date.year
        week = isoweek.Week.withdate(date).week
        return year, week
    
    def get_monday_of_week(self, date_str):
        """Get the Monday date of the week containing the given date."""
        date = datetime.strptime(date_str, '%Y-%m-%d')
        # Calculate days to subtract to reach Monday (where Monday is 0, Sunday is 6)
        days_to_subtract = date.weekday()
        monday = date - timedelta(days=days_to_subtract)
        return monday

    def upload_prediction(self, municipality, prediction_data, disease, timeframe="current"):
        """Upload a single prediction to the database."""
        insert_sql = """
        INSERT INTO disease_forecast 
        (year, week_number, disease, municipality_code, municipality_name, predicted_cases, forecast_date, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
        ON CONFLICT (year, week_number, disease, municipality_code)
        DO UPDATE SET 
            predicted_cases = EXCLUDED.predicted_cases,
            forecast_date = EXCLUDED.forecast_date,
            updated_at = CURRENT_TIMESTAMP;
        """
        
        try:
            municipality_code = self.municipality_iso_codes.get(municipality)
            
            if not municipality_code:
                print(f"Warning: No ISO code found for {municipality}, skipping")
                return
            
            # Get year and week based on the timeframe
            if timeframe == "current":
                # For current week, use the prediction date
                date_str = prediction_data['prediction_date']
            else:
                # For next week, use the start date of the predicted week
                date_str = prediction_data['week_range']['start']
                
            year, week = self.get_year_and_week(date_str)
            
            # Calculate the Monday of the prediction week
            monday_date = self.get_monday_of_week(date_str)
            
            self.cursor.execute(insert_sql, (
                year,
                week,
                disease,
                municipality_code,
                municipality,
                prediction_data['predicted_cases'],
                monday_date,
            ))
            
            print(f"Uploaded {timeframe} week prediction for {municipality} ({disease}, Week {week}/{year}, Monday: {monday_date.strftime('%Y-%m-%d')})")
            return True
            
        except Exception as e:
            print(f"Error uploading {timeframe} week prediction for {municipality}: {str(e)}")
            self.conn.rollback()
            return False

    def upload_predictions(self, predictions, disease):
        """Upload current and next week predictions to the database."""
        success_count = 0
        total_predictions = 0
        
        for municipality, data in predictions.items():
            total_predictions += 1
            
            # Upload current week prediction
            if 'current_week' in data:
                if self.upload_prediction(municipality, data['current_week'], disease, "current"):
                    success_count += 1
            else:
                # Handle legacy format for backward compatibility
                if self.upload_prediction(municipality, data, disease, "current"):
                    success_count += 1
            
            # Upload next week prediction if available
            if 'next_week' in data:
                total_predictions += 1
                if self.upload_prediction(municipality, data['next_week'], disease, "next"):
                    success_count += 1
        
        self.conn.commit()
        print(f"Successfully uploaded {success_count} of {total_predictions} {disease} predictions")

def main():
    uploader = PredictionUploader()
    current_date = datetime.now().strftime('%Y%m%d')
    
    try:
        # Connect to database
        uploader.connect()
        
        # Create table if it doesn't exist
        uploader.create_table_if_not_exists()
        
        print("Directory: ", uploader.predictions_dir)
        print("Dengue file: ", f"{uploader.predictions_dir}/dengue_predictions_{current_date}.json")
        print("Diarrhea file: ", f"{uploader.predictions_dir}/diarrhea_predictions_{current_date}.json")
        
        # Process dengue predictions
        dengue_file = f"{uploader.predictions_dir}/dengue_predictions_{current_date}.json"
        if os.path.exists(dengue_file):
            with open(dengue_file, 'r') as f:
                dengue_predictions = json.load(f)
            uploader.upload_predictions(dengue_predictions, 'dengue')
        else:
            print(f"No dengue predictions file found for {current_date}")
        
        # Process diarrhea predictions
        diarrhea_file = f"{uploader.predictions_dir}/diarrhea_predictions_{current_date}.json"
        if os.path.exists(diarrhea_file):
            with open(diarrhea_file, 'r') as f:
                diarrhea_predictions = json.load(f)
            uploader.upload_predictions(diarrhea_predictions, 'diarrhea')
        else:
            print(f"No diarrhea predictions file found for {current_date}")
            
    except Exception as e:
        print(f"Error: {str(e)}")
    finally:
        uploader.disconnect()

if __name__ == "__main__":
    main() 
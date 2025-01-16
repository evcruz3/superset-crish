#!/usr/bin/env python3

import os
from dotenv import load_dotenv
import psycopg2
import json
from datetime import datetime
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (year, week_number, disease, municipality_code)
        );
        
        -- Create index for faster queries
        CREATE INDEX IF NOT EXISTS idx_disease_forecast_lookup 
        ON disease_forecast(disease, year, week_number);
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

    def upload_predictions(self, predictions, disease):
        """Upload predictions to the database."""
        insert_sql = """
        INSERT INTO disease_forecast 
        (year, week_number, disease, municipality_code, municipality_name, predicted_cases, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
        ON CONFLICT (year, week_number, disease, municipality_code)
        DO UPDATE SET 
            predicted_cases = EXCLUDED.predicted_cases,
            updated_at = CURRENT_TIMESTAMP;
        """
        
        for municipality, data in predictions.items():
            try:
                year, week = self.get_year_and_week(data['prediction_date'])
                municipality_code = self.municipality_iso_codes.get(municipality)
                
                if not municipality_code:
                    print(f"Warning: No ISO code found for {municipality}, skipping")
                    continue
                
                self.cursor.execute(insert_sql, (
                    year,
                    week,
                    disease,
                    municipality_code,
                    municipality,
                    data['predicted_cases']
                ))
                print(f"Uploaded prediction for {municipality} ({disease}, Week {week}/{year})")
                
            except Exception as e:
                print(f"Error uploading prediction for {municipality}: {str(e)}")
                self.conn.rollback()
                continue
        
        self.conn.commit()
        print(f"All {disease} predictions uploaded successfully")

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
                print(dengue_predictions)
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
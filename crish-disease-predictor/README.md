# Disease Prediction Pipeline

An automated pipeline for predicting dengue and diarrhea cases in Timor-Leste municipalities based on weather data and historical disease cases.

## Overview

This pipeline automates the following steps:
1. Pulls weather data from Visual Crossing API
2. Predicts dengue cases using LSTM models
3. Predicts diarrhea cases using LSTM models
4. Uploads predictions to a PostgreSQL database

## Directory Structure

```
.
├── README.md
├── requirements.txt
├── .env
├── prediction_pipeline.py
├── visual_crossing_puller.py
├── dengue_predictor.py
├── diarrhea_predictor.py
├── upload_predictions.py
├── dengueModels/
│   ├── {municipality}.h5
│   └── {municipality}_minmax_scaler.pkl
├── diarrheaModels/
│   ├── {municipality}.h5
│   └── {municipality}_minmax_scaler.pkl
├── predictions/
│   ├── dengue_predictions_{date}.json
│   └── diarrhea_predictions_{date}.json
└── weather_data/
    └── all_municipalities_weekly_averages_{date}.json
```

## Configuration

The pipeline is configured through environment variables in the `.env` file:

```env
# Visual Crossing API Configuration
VISUAL_CROSSING_API_KEY=your_api_key

# Model Directories
DENGUE_MODELS_DIR=dengueModels
DIARRHEA_MODELS_DIR=diarrheaModels

# Database Configuration
DATABASE_DB=superset
DATABASE_HOST=db
DATABASE_PASSWORD=superset
DATABASE_USER=superset

# Output Directories
PREDICTIONS_DIR=predictions
WEATHER_DATA_DIR=weather_data

# Default values for predictions
DEFAULT_PREV_CASES=1
MAX_WEEKS_HISTORY=4

# Disease Prediction Pipeline Configuration
DISEASE_PREDICTION_PIPELINE_FREQUENCY=weekly  # Options: daily, weekly, monthly
DISEASE_PREDICTION_PIPELINE_RUN_TIME=01:00   # 24-hour format
DISEASE_PREDICTION_PIPELINE_RUN_IMMEDIATE=false  # Whether to run pipeline immediately on startup
```

## Installation

1. Clone the repository
2. Install dependencies:
```bash
pip install -r requirements.txt
```
3. Configure the `.env` file with your settings
4. Ensure model files are present in their respective directories

## Running the Pipeline

Start the pipeline:
```bash
python prediction_pipeline.py
```

The pipeline can be configured to run:
- Daily at a specific time
- Weekly on Mondays at a specific time
- Monthly on the 1st at a specific time

## Components

### 1. Weather Data Puller (`visual_crossing_puller.py`)
- Fetches weather data from Visual Crossing API
- Calculates weekly averages for temperature, humidity, and precipitation
- Saves data to JSON files in the weather_data directory

### 2. Disease Predictors (`dengue_predictor.py`, `diarrhea_predictor.py`)
- Load LSTM models and scalers for each municipality
- Pull historical case data from the database
- Process weather data and make predictions
- Save predictions to JSON files in the predictions directory

### 3. Prediction Uploader (`upload_predictions.py`)
- Connects to PostgreSQL database
- Uploads predictions with proper municipality codes
- Handles data conflicts with UPSERT operations

### 4. Pipeline Orchestrator (`prediction_pipeline.py`)
- Schedules and coordinates all components
- Provides logging and error handling
- Manages the execution frequency
- Logs all activities to `pipeline.log`

## Database Schema

The predictions are stored in a table named `disease_forecast` with the following structure:
```sql
CREATE TABLE disease_forecast (
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
```

## Logging

The pipeline logs all activities to both:
- Console output
- `pipeline.log` file

Log entries include:
- Script execution status
- Prediction results
- Errors and warnings
- Pipeline scheduling information

## Error Handling

The pipeline includes comprehensive error handling:
- Database connection issues
- Missing model files
- API failures
- Invalid configurations

Failed steps are logged and the pipeline continues with the next scheduled run.

## Municipality Codes

The system uses ISO 3166-2 codes for Timor-Leste municipalities:
- Aileu: TL-AL
- Ainaro: TL-AN
- Atauro: TL-AT
- Baucau: TL-BA
- Bobonaro: TL-BO
- Covalima: TL-CO
- Dili: TL-DI
- Ermera: TL-ER
- Lautem: TL-LA
- Liquica: TL-LI
- Manatuto: TL-MT
- Manufahi: TL-MF
- Raeoa: TL-OE
- Viqueque: TL-VI
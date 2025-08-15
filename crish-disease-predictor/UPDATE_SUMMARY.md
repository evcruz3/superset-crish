# Disease Predictor Update Summary

## Date: August 15, 2025

### Overview
Updated the disease prediction system to use new machine learning models (joblib format) instead of the previous TensorFlow/Keras LSTM models. Added support for ISPA/ARI predictions.

## Changes Made

### 1. Model Updates
- **Previous**: TensorFlow/Keras LSTM models with 8 input features
- **New**: Scikit-learn joblib models with 40 input features
- **Feature Structure**: 
  - Disease lags 1-4 (most recent to oldest)
  - Weather parameters (temperature, precipitation, humidity) with max/mean/min values for lags 1-4

### 2. Updated Files

#### Disease Predictors
- `dengue_predictor.py` - Updated for new model format
- `diarrhea_predictor.py` - Updated for new model format
- `ispa_predictor.py` - New file created for ISPA/ARI predictions

#### Pipeline Files
- `prediction_pipeline.py` - Added ISPA predictor to the pipeline
- `upload_predictions.py` - Added ISPA prediction upload support

#### Configuration
- `.env` - Added new model directories:
  ```
  NEW_MODELS_DIR=new_models/Dengue
  NEW_DIARRHEA_MODELS_DIR=new_models/Diarrhea
  NEW_ISPA_MODELS_DIR=new_models/ISPA
  ```

### 3. Database Query Improvements
Updated disease detection queries to use PostgreSQL word boundary regex:
- Dengue: `lower(disease) ~* '\ydengue\y'`
- Diarrhea: `lower(disease) ~* '\ydiarr?hea\y'` (handles both spellings)
- ISPA: `lower(disease) ~* '\y(ispa\s*/\s*ari|ispa|ari)\y'`

### 4. File Organization
- Created `backups/` directory with timestamped backup files
- Created `tests/` directory with feature verification tests
- Model files renamed from "Cova Lima" to "Covalima" for consistency

### 5. Key Technical Changes
- Removed TensorFlow/Keras dependencies
- Removed scaling operations (new models don't require scaling)
- Updated input preparation to handle 40 features
- Maintained backward compatibility with existing database structure

## Testing
Test files are available in the `tests/` directory:
- `verify_feature_order.py` - Verifies 40-feature structure
- `test_dengue_features.py` - Tests dengue predictor features
- `test_ispa_features.py` - Tests ISPA predictor features

## Running the Pipeline
The prediction pipeline will now:
1. Pull weather data (visual_crossing_puller.py)
2. Run dengue predictions
3. Run diarrhea predictions
4. Run ISPA predictions
5. Upload all predictions to the database

## Notes
- All predictors now use the same 40-feature input structure
- Predictions include both current week and next week forecasts
- The system maintains compatibility with existing alert generation and bulletin creation
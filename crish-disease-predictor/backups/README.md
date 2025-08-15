# Backups Directory

This directory contains backup files of the disease predictors before migrating to the new machine learning models.

## Backup Files

- `dengue_predictor_backup_YYYYMMDD.py` - Backup of the original dengue predictor using LSTM models
- `diarrhea_predictor_backup_YYYYMMDD.py` - Backup of the original diarrhea predictor using LSTM models

## Changes Made

The original predictors were updated to:
1. Use new joblib models instead of TensorFlow/Keras LSTM models
2. Handle 40 input features instead of 8
3. Remove scaling operations (new models don't require scaling)
4. Update disease case queries to use word boundary regex patterns

## Restoring

If you need to restore the original predictors:
1. Copy the backup file to the parent directory
2. Remove the date suffix from the filename
3. Ensure the old model files (.h5 and scaler files) are available
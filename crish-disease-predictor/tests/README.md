# Tests Directory

This directory contains test scripts for verifying the new disease predictor implementations.

## Test Files

### Feature Verification Tests

- `verify_feature_order.py` - Simple script to verify the 40-feature order matches the model requirements
- `test_dengue_features.py` - Comprehensive test of feature ordering and weekly data processing logic

### Integration Tests

- `test_new_dengue_predictor.py` - Full integration test for the dengue predictor (requires database dependencies)

## Running Tests

### Basic Feature Tests (No Dependencies)

```bash
python tests/verify_feature_order.py
python tests/test_dengue_features.py
```

### Integration Tests (Requires Environment)

```bash
# Ensure environment variables are set
python tests/test_new_dengue_predictor.py
```

## Expected Feature Order

The new models expect 40 features in this specific order:

1. Disease lags 1-4 (most recent to oldest)
2. Temperature max lags 1-4
3. Temperature mean lags 1-4
4. Temperature min lags 1-4
5. Precipitation max lags 1-4
6. Precipitation mean lags 1-4
7. Precipitation min lags 1-4
8. Humidity max lags 1-4
9. Humidity mean lags 1-4
10. Humidity min lags 1-4

Where lag_1 is the most recent past week and lag_4 is the oldest (4 weeks ago).
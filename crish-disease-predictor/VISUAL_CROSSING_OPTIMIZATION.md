# Visual Crossing Puller Optimization

## Overview
The Visual Crossing weather data puller has been optimized to avoid unnecessary API calls by checking for existing data before making requests.

## Key Optimizations

### 1. **Check Consolidated Files First**
- Before any processing, checks if the main output files already exist:
  - `all_municipalities_weekly_averages_{date}.json`
  - `all_municipalities_forecast_{date}.json`
- If both exist for today's date, skips all processing and exits early

### 2. **Municipality-Level Checking**
- If consolidated files are incomplete, checks which municipalities need data
- Only processes municipalities that don't have both historical and forecast data
- Significantly reduces API calls when running multiple times per day

### 3. **Individual File Caching**
- Before making API calls, checks for individual municipality files:
  - `{municipality}_historical_{date}.json`
  - `{municipality}_forecast_{date}.json`
- Loads existing data from cache when available

### 4. **Smart Rate Limiting**
- Only applies rate limiting (sleep) when actually making API calls
- Skips delay when loading from cache

## Benefits

### API Call Reduction
- **First run of the day**: Makes all necessary API calls
- **Subsequent runs**: Zero API calls if all data exists
- **Partial reruns**: Only fetches missing data

### Time Savings
- Full run (14 municipalities): ~28-30 seconds with API calls
- Optimized run (all cached): ~1-2 seconds

### Cost Savings
- Visual Crossing API has daily/monthly limits
- Optimization prevents hitting limits from multiple runs
- Reduces API usage costs

## Usage Scenarios

### Scenario 1: Fresh Start
```
$ python visual_crossing_puller.py
Checking for existing weather data for 2025-08-15
Pulling historical data from 2025-07-18 to 2025-08-15
Need to pull data for 14 municipalities: Aileu, Ainaro, ...
[Fetches all data via API]
```

### Scenario 2: All Data Exists
```
$ python visual_crossing_puller.py
Checking for existing weather data for 2025-08-15
✓ All consolidated weather data files already exist for today!
Skipping data pull to avoid unnecessary API calls.
```

### Scenario 3: Partial Data
```
$ python visual_crossing_puller.py
Checking for existing weather data for 2025-08-15
Need to pull data for 2 municipalities: Baucau, Viqueque
[Only fetches missing data]
```

## File Structure
```
weather_data/
├── all_municipalities_weekly_averages_20250815.json  # Main output
├── all_municipalities_forecast_20250815.json         # Main output
├── Aileu_historical_20250815.json                    # Individual cache
├── Aileu_forecast_20250815.json                      # Individual cache
└── ... (other municipalities)
```

## Testing
Run the test suite to verify optimization:
```bash
python tests/test_visual_crossing_optimized.py
```

## Notes
- Data is date-stamped, so new data will be pulled each day
- If you need to force a refresh, delete the existing files for today
- The optimization is transparent to downstream processes
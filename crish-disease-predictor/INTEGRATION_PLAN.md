# Integration Plan: Disease Predictor Pipeline with Superset

## 1. Docker Configuration Changes

### A. Create New Dockerfile
Create `Dockerfile` in the `crish-disease-predictor` directory:
```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD ["python", "prediction_pipeline.py"]
```

### B. Update docker-compose.yml
Add the following service to Superset's `docker-compose.yml`:
```yaml
  disease-predictor:
    build: ./crish-disease-predictor
    volumes:
      - ./crish-disease-predictor:/app
    environment:
      - VISUAL_CROSSING_API_KEY=${VISUAL_CROSSING_API_KEY}
      - DATABASE_DB=superset
      - DATABASE_HOST=db
      - DATABASE_PASSWORD=superset
      - DATABASE_USER=superset
      - DISEASE_PREDICTION_PIPELINE_FREQUENCY=weekly
      - DISEASE_PREDICTION_PIPELINE_RUN_TIME=01:00
    depends_on:
      - db
```

## 2. Database Integration

### A. Create Database Table
Execute the following SQL in Superset's PostgreSQL database:
```sql
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
```

## 3. Implementation Steps

1. **Environment Setup**:
   - Copy the disease predictor code to Superset's root directory
   - Ensure all model files are present in their respective directories
   - Add VISUAL_CROSSING_API_KEY to Superset's `.env` file

2. **Docker Build**:
   ```bash
   docker-compose build disease-predictor
   ```

3. **Start the Service**:
   ```bash
   docker-compose up -d disease-predictor
   ```

4. **Verify Integration**:
   - Check logs: `docker-compose logs disease-predictor`
   - Verify database table creation
   - Monitor first prediction cycle

## 4. Superset Dashboard Integration

1. **Create Dataset**:
   - Add new dataset in Superset connecting to `disease_forecast` table
   - Set appropriate refresh frequency

2. **Create Charts**:
   - Predicted cases by municipality
   - Time series forecasts
   - Comparison with actual cases

3. **Build Dashboard**:
   - Combine charts into comprehensive dashboard
   - Add filters for disease type, municipality, and time period

## 5. Monitoring and Maintenance

1. **Logging**:
   - Logs will be available through Docker: `docker-compose logs disease-predictor`
   - Monitor pipeline.log inside the container

2. **Data Verification**:
   - Regular checks of prediction accuracy
   - Monitoring of weather data pulls
   - Database connection status

3. **Backup Strategy**:
   - Include model files in backup routine
   - Regular database backups (handled by Superset's existing backup)

## 6. Troubleshooting Guide

1. **Common Issues**:
   - Database connection failures: Check database credentials and network
   - Missing weather data: Verify API key and Visual Crossing service status
   - Model loading errors: Ensure all model files are present in mounted volume

2. **Resolution Steps**:
   - Check container logs
   - Verify environment variables
   - Ensure database migrations are complete
   - Validate model file permissions

## 7. Security Considerations

1. **API Key Management**:
   - Store VISUAL_CROSSING_API_KEY in `.env` file
   - Never commit API keys to version control

2. **Database Access**:
   - Use limited-privilege database user
   - Ensure secure database connection

## Next Steps

1. Test the integration in a staging environment
2. Monitor the first week of predictions
3. Create Superset dashboards for visualization
4. Document any specific customizations needed
5. Set up monitoring alerts for pipeline failures 
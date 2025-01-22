FROM python:3.7-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install TensorFlow 1.15.0 specifically for CPU
RUN pip install --no-cache-dir https://storage.googleapis.com/tensorflow/linux/cpu/tensorflow-1.15.0-cp37-cp37m-linux_x86_64.whl

# Copy application code
COPY . .

# Create directories for data persistence
RUN mkdir -p predictions weather_data

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Run the prediction pipeline
CMD ["python", "prediction_pipeline.py"] 
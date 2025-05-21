#!/bin/sh
set -e # Exit immediately if a command exits with a non-zero status.

# Environment variables needed:
# MINIO_ROOT_USER
# MINIO_ROOT_PASSWORD
# S3_BUCKET (optional, defaults to 'superset')

MINIO_ALIAS=${MINIO_ALIAS:-minio_local}
MINIO_ENDPOINT=${MINIO_ENDPOINT:-http://minio:9000}
# Use S3_BUCKET from .env, otherwise default to 'superset'
TARGET_BUCKET=${S3_BUCKET:-superset}

echo "MinIO Init: Waiting for MinIO to be available at ${MINIO_ENDPOINT}..."

# A more robust wait loop could be added here, but we rely on Docker Compose healthcheck dependency.
# Example:
# until mc alias set "${MINIO_ALIAS}" "${MINIO_ENDPOINT}" "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" --api S3v4 > /dev/null 2>&1; do
#   echo "MinIO not ready yet, retrying in 5 seconds..."
#   sleep 5
# done
# echo "MinIO is ready."

echo "MinIO Init: Configuring MinIO client (mc) for alias '${MINIO_ALIAS}'..."
mc alias set "${MINIO_ALIAS}" "${MINIO_ENDPOINT}" "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" --api S3v4

echo "MinIO Init: Checking if bucket '${TARGET_BUCKET}' exists on alias '${MINIO_ALIAS}'..."
if mc ls "${MINIO_ALIAS}/${TARGET_BUCKET}" > /dev/null 2>&1; then
  echo "MinIO Init: Bucket '${TARGET_BUCKET}' already exists."
else
  echo "MinIO Init: Bucket '${TARGET_BUCKET}' does not exist. Creating..."
  mc mb "${MINIO_ALIAS}/${TARGET_BUCKET}"
  echo "MinIO Init: Bucket '${TARGET_BUCKET}' created successfully."
fi

echo "MinIO Init: Bucket initialization process complete."

# Make the script executable: chmod +x docker/minio-init-bucket.sh 
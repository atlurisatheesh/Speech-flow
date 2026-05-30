# Use official Python runtime as a parent image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies (required for audio and other system libraries)
RUN apt-get update && apt-get install -y \
    portaudio19-dev \
    gcc \
    libasound2-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install them
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install uvicorn gunicorn python-multipart

# Copy the rest of the backend code
COPY backend/ .

# Set environment variable to indicate cloud deployment
ENV CLOUD_MODE=true

# Expose port 1993 (for local dev documentation)
EXPOSE 1993

# Run FastAPI using Uvicorn on Render's dynamic PORT
CMD uvicorn server:app --host 0.0.0.0 --port ${PORT:-1993}

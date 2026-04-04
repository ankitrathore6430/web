# Base Python image
FROM python:3.10-slim

# Force Python to print logs immediately
ENV PYTHONUNBUFFERED=1

# Install native Chromium, ChromeDriver, and Xvfb (Virtual Screen)
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

# Set working directory inside container
WORKDIR /app

# Copy requirements and install them
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all your project files
COPY . .

# Run the Flask app with lower threads to save RAM on free tier
CMD gunicorn app:app --bind 0.0.0.0:$PORT --workers 1 --threads 2
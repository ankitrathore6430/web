# Base Python image
FROM python:3.10-slim

# Install system dependencies and Google Chrome directly
RUN apt-get update && apt-get install -y \
    wget \
    unzip \
    curl \
    fonts-liberation \
    libnss3 \
    libatk-bridge2.0-0 \
    libx11-xcb1 \
    libxcb-dri3-0 \
    libdrm2 \
    libgbm1 \
    libasound2 \
    && wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && apt-get install -y ./google-chrome-stable_current_amd64.deb \
    && rm google-chrome-stable_current_amd64.deb \
    && rm -rf /var/lib/apt/lists/*

# Set working directory inside container
WORKDIR /app

# Copy requirements and install them
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all your project files
COPY . .

# Run the Flask app with Gunicorn
CMD gunicorn app:app --bind 0.0.0.0:$PORT --workers 1 --threads 4 
# Base Python image
FROM python:3.10-slim

# Install system dependencies aur Google Chrome
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    unzip \
    curl \
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Work directory set karein
WORKDIR /app

# Requirements install karein
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Baaki saari files (pan.py, cookies.json, storage.json) copy karein
COPY . .

# App ko start karein (aapki file ka naam pan.py hai logs ke hisaab se)
CMD ["python", "pan.py"]

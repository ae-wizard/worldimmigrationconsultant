# Use an official slim Python image as base
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install system dependencies needed for Playwright
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers
RUN playwright install --with-deps chromium

# Copy the application code
COPY . .

# Create directory for database and logs
RUN mkdir -p /app/data

# Expose port (FastAPI will run on 80 inside container)
EXPOSE 80

# Command to start the server (using our production API)
CMD ["uvicorn", "api_simple:app", "--host", "0.0.0.0", "--port", "80"] 
# Command to start the server (using Uvicorn)
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "80", "--reload"] 
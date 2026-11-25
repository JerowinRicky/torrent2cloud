FROM python:3.12-slim

WORKDIR /app

# Install system dependencies including libtorrent bindings and PostgreSQL client libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gcc \
    g++ \
    libpq-dev \
    python3-libtorrent \
    && rm -rf /var/lib/apt/lists/*

# Link system python3-libtorrent dist-packages into Python 3.12 site-packages
RUN if [ -d "/usr/lib/python3/dist-packages" ]; then \
        echo "/usr/lib/python3/dist-packages" > /usr/local/lib/python3.12/site-packages/libtorrent.pth; \
    fi

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create storage mount points with appropriate structure
RUN mkdir -p /data/incomplete /data/completed /data/resume_data

# Copy application code
COPY . .

# Configure permissions for non-root execution
RUN chmod +x /app/entrypoint.sh \
    && useradd -m -u 10001 appuser \
    && chown -R appuser:appuser /app /data

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]

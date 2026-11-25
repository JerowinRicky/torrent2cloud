FROM python:3.12-slim

WORKDIR /engine

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3-libtorrent \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Non-root user with isolated privileges
RUN useradd -m -u 10002 torrentuser
USER torrentuser

CMD ["python", "engine/worker_main.py"]

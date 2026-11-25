# syntax=docker/dockerfile:1
FROM python:3.12-slim AS deps
WORKDIR /app
COPY requirements.txt requirements-cpu.txt ./
RUN pip install --no-cache-dir -r requirements-cpu.txt

FROM python:3.12-slim AS dev
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 VISION_MODE=fixture VISION_DEVICE=cpu
COPY --from=deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin
COPY . .
RUN useradd --create-home --uid 10002 appuser && chown -R appuser:appuser /app
USER appuser
EXPOSE 8001
HEALTHCHECK --interval=10s --timeout=3s --retries=10 \
  CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8001/health',timeout=2)" || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--reload", "--reload-dir", "app", "--reload-dir", "config"]

# CPU target for the default real model: MoveNet Lightning via LiteRT.
FROM dev AS cpu
ENV VISION_MODE=movenet VISION_DEVICE=cpu OMP_NUM_THREADS=2 MKL_NUM_THREADS=2
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]

# Optional CPU Sapiens2 target retained for environments with explicit licence
# clearance. Source and checkpoints remain external read-only mounts.
FROM python:3.12-slim AS sapiens-cpu
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 \
    VISION_MODE=sapiens VISION_DEVICE=cpu \
    OMP_NUM_THREADS=2 MKL_NUM_THREADS=2
COPY requirements.txt requirements-sapiens-cpu.txt ./
RUN pip install --no-cache-dir -r requirements-sapiens-cpu.txt
COPY . .
RUN useradd --create-home --uid 10002 appuser && chown -R appuser:appuser /app
USER appuser
EXPOSE 8001
HEALTHCHECK --interval=15s --timeout=5s --retries=10 \
  CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8001/health',timeout=3)" || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]

# GPU target for real Sapiens2 inference. No weights or licensed source are
# copied into the image; both are mounted read-only by docker-compose.gpu.yml.
FROM python:3.12-slim AS gpu
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 VISION_MODE=sapiens VISION_DEVICE=cuda
COPY requirements.txt requirements-gpu.txt ./
RUN pip install --no-cache-dir -r requirements-gpu.txt
COPY . .
RUN useradd --create-home --uid 10002 appuser && chown -R appuser:appuser /app
USER appuser
EXPOSE 8001
HEALTHCHECK --interval=15s --timeout=5s --retries=10 \
  CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8001/health',timeout=3)" || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]

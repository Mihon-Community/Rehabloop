# syntax=docker/dockerfile:1
FROM python:3.12-slim AS deps
WORKDIR /app
# requirements-dev.txt pulls in requirements-cpu.txt (-r requirements-cpu.txt),
# which pulls in requirements.txt, so installing it also covers the runtime
# deps. Installed here so `docker compose exec vision_service pytest/ruff/mypy`
# works against the running dev/cpu containers.
COPY requirements.txt requirements-cpu.txt requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements-dev.txt

FROM python:3.12-slim AS dev
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 VISION_MODE=fixture
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
ENV VISION_MODE=movenet OMP_NUM_THREADS=2 MKL_NUM_THREADS=2
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]

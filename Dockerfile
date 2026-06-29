# Python image for the API and the RQ worker (same image, different commands).
FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

RUN apt-get update && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Dependency layer (cached unless lockfile changes).
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# App code + data.
COPY src ./src
COPY alembic ./alembic
COPY alembic.ini ./
COPY datasets ./datasets
COPY reports ./reports
COPY db ./db
RUN uv sync --frozen --no-dev

EXPOSE 8000

# Default: API. The worker service overrides this command in compose.
CMD ["uv", "run", "uvicorn", "sentinel.api.main:app", "--host", "0.0.0.0", "--port", "8000"]

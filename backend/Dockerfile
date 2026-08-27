# syntax=docker/dockerfile:1.7

ARG PYTHON_VERSION=3.11-slim-bookworm
ARG UV_VERSION=0.11.32

# Export only the backend dependency graph from the uv workspace lockfile.
FROM ghcr.io/astral-sh/uv:${UV_VERSION} AS uv

FROM python:${PYTHON_VERSION} AS requirements
WORKDIR /workspace

COPY --from=uv /uv /uvx /usr/local/bin/

# Keep dependency metadata in a separate layer so application changes do not
# invalidate dependency resolution.
COPY pyproject.toml uv.lock ./
COPY backend/pyproject.toml backend/pyproject.toml

RUN uv export --quiet \
    --frozen \
    --package fastapi-boilerplate \
    --no-dev \
    --no-editable \
    --no-emit-project \
    --output-file /tmp/requirements-prod.txt

RUN uv export --quiet \
    --frozen \
    --package fastapi-boilerplate \
    --no-dev \
    --extra dev \
    --no-editable \
    --no-emit-project \
    --output-file /tmp/requirements-dev.txt

FROM python:${PYTHON_VERSION} AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend:/app/backend/src \
    UV_LINK_MODE=copy

WORKDIR /app/backend

COPY --from=uv /uv /uvx /usr/local/bin/
COPY --from=requirements /tmp/requirements-prod.txt /tmp/requirements-prod.txt

RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --system --require-hashes -r /tmp/requirements-prod.txt \
    && rm /tmp/requirements-prod.txt

RUN groupadd --system app \
    && useradd --system --gid app --create-home app \
    && mkdir -p /app/backend/data/profile-images \
    && chown -R app:app /app/backend/data

COPY --chown=app:app backend/src ./src

EXPOSE 8000

# Development image: tooling and files useful for tests, migrations and setup.
FROM base AS dev

USER root
COPY --from=requirements /tmp/requirements-dev.txt /tmp/requirements-dev.txt
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --system --require-hashes -r /tmp/requirements-dev.txt \
    && rm /tmp/requirements-dev.txt

COPY --chown=app:app backend/tests ./tests
COPY --chown=app:app backend/fixtures ./fixtures
COPY --chown=app:app backend/migrations ./migrations
COPY --chown=app:app backend/scripts ./scripts
COPY --chown=app:app backend/alembic.ini ./alembic.ini

USER app
CMD ["fastapi", "dev", "src/interfaces/main.py", "--host", "0.0.0.0", "--port", "8000"]

# One-off image for database migrations.
FROM base AS migrate

COPY --chown=app:app backend/migrations ./migrations
COPY --chown=app:app backend/alembic.ini ./alembic.ini

USER app
CMD ["alembic", "upgrade", "head"]

# Production image: one process per container and no development dependencies.
FROM base AS prod

USER app
CMD ["fastapi", "run", "src/interfaces/main.py", "--host", "0.0.0.0", "--port", "8000"]

# syntax=docker/dockerfile:1

FROM python:3.15.2-slim AS builder

WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:0.13.7 /uv /usr/local/bin/uv
RUN uv venv /opt/venv
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --link-mode=copy --python /opt/venv/bin/python -r requirements.txt

FROM node:24-slim AS frontend

WORKDIR /frontend
RUN npm install --global pnpm@12.16.1
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm build

FROM python:3.15.2-slim AS runtime

WORKDIR /app
LABEL org.opencontainers.image.title="Arkanoid"
RUN groupadd --system --gid 1001 appgroup && \
    useradd --system --uid 1001 --gid appgroup appuser
COPY --link --from=builder /opt/venv /opt/venv
COPY --link --chown=1001:1001 main.py web.py models.py data.py api_documentation.py catalog_query.py app_logging.py ./
COPY --link --chown=1001:1001 apis/ ./apis/
COPY --link --chown=1001:1001 catalog/products.csv catalog/localization.json ./catalog/
COPY --link --chown=1001:1001 static/ ./static/
COPY --link --chown=1001:1001 --from=frontend /frontend/dist/ ./frontend/dist/
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
USER appuser
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

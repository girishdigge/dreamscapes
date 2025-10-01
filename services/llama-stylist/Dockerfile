# Multi-stage build for Python service
FROM python:3.13-slim-bookworm AS base

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PATH="/root/.local/bin:$PATH"
WORKDIR /app

# System dependencies stage - cached separately
FROM base AS system-deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

# Dependencies stage
FROM system-deps AS deps
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Development stage
FROM system-deps AS development
COPY --from=deps /root/.local /root/.local
COPY . .
EXPOSE 8000
ENV PYTHONPATH=/app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# Production stage
FROM base AS production
COPY --from=deps /root/.local /root/.local
COPY . .
EXPOSE 8000
ENV PYTHONPATH=/app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

# Default to development
FROM development

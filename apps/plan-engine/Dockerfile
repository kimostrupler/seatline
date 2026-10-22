# Seatline plan engine (Python). Build from the repository root:
#   docker build -f apps/plan-engine/Dockerfile -t seatline-plan-engine .
ARG PYTHON_IMAGE=python:3.13-slim-bookworm
FROM ${PYTHON_IMAGE}
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app
COPY apps/plan-engine/requirements.txt .
RUN pip install -r requirements.txt
COPY apps/plan-engine/app ./app
RUN useradd --system --uid 10001 engine
USER engine
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]

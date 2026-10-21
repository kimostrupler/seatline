"""Seatline plan engine (stub).

Phase 5 turns architect plans (PDF, image, DXF) into a draft floor layout that a
user confirms. Until then this service only answers health checks.
"""

from fastapi import FastAPI

app = FastAPI(title="Seatline plan engine")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

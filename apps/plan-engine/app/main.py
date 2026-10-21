"""Seatline plan engine: architect plans (DXF, PDF, images) → a draft floor layout.

Internal service: only the API calls it. POST /analyze with the file as multipart field "file";
the answer is the background image (PNG, base64) plus suggested rooms and desks in its pixels.
"""

from __future__ import annotations

import hmac
import os

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse

from .analyze import MAX_BYTES, analyze_isolated
from .dxf_import import DrawingError

app = FastAPI(title="Seatline plan engine", docs_url=None, redoc_url=None, openapi_url=None)
TOKEN = os.environ.get("PLAN_ENGINE_TOKEN", "")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    x_internal_token: str = Header(default=""),
):
    if TOKEN and not hmac.compare_digest(x_internal_token, TOKEN):
        raise HTTPException(401, "Unauthorized")
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        return JSONResponse({"code": "too_large"}, status_code=413)
    if not data:
        return JSONResponse({"code": "empty"}, status_code=422)
    try:
        return await run_in_threadpool(analyze_isolated, data)
    except DrawingError as error:
        return JSONResponse({"code": error.code}, status_code=422)

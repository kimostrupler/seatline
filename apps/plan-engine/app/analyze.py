"""Pick the reader by the file's bytes, run it in a child process with a time limit."""

from __future__ import annotations

import base64
import multiprocessing as mp
import traceback
from typing import Any

from .dxf_import import DrawingError, analyze_dxf
from .geometry import Draft
from .pdf_import import analyze_pdf, analyze_raster

MAX_BYTES = 25 * 1024 * 1024
TIMEOUT_S = 90


def kind_of(data: bytes) -> str:
    head = data[:2048]
    if head.startswith(b"%PDF-"):
        return "pdf"
    if head.startswith(b"\x89PNG") or head.startswith(b"\xff\xd8\xff") or (head[:4] == b"RIFF" and head[8:12] == b"WEBP"):
        return "image"
    if head.startswith(b"AutoCAD Binary DXF"):
        return "dxf"
    if head[:2] == b"AC" and head[2:6].isdigit():  # AutoCAD's own format (AC1015, AC1032…)
        return "dwg"
    text = head.decode("latin-1", errors="replace").upper()
    if "SECTION" in text and ("HEADER" in text or "ENTITIES" in text or "TABLES" in text or "CLASSES" in text):
        return "dxf"
    return "unknown"


def analyze(data: bytes) -> Draft:
    kind = kind_of(data)
    if kind == "dwg":
        raise DrawingError("dwg")
    if kind == "dxf":
        return analyze_dxf(data)
    if kind == "pdf":
        return analyze_pdf(data)
    if kind == "image":
        return analyze_raster(data)
    raise DrawingError("unsupported")


def _child(data: bytes, conn) -> None:  # pragma: no cover - runs in the child process
    try:
        conn.send(("ok", to_json(analyze(data))))
    except DrawingError as error:
        conn.send(("error", error.code))
    except MemoryError:
        conn.send(("error", "too_complex"))
    except Exception:
        traceback.print_exc()
        conn.send(("error", "failed"))
    finally:
        conn.close()


_CTX = None


def _context():
    """A clean server process forks the workers (forking the threaded web server can hang)."""
    global _CTX
    if _CTX is None:
        _CTX = mp.get_context("forkserver")
        _CTX.set_forkserver_preload(["app.analyze"])
    return _CTX


def analyze_isolated(data: bytes, timeout: float = TIMEOUT_S) -> dict[str, Any]:
    """Untrusted files are parsed in a separate process that is killed after `timeout`."""
    ctx = _context()
    parent, child = ctx.Pipe(duplex=False)
    proc = ctx.Process(target=_child, args=(data, child), daemon=True)
    proc.start()
    child.close()
    try:
        if not parent.poll(timeout):
            raise DrawingError("timeout")
        status, value = parent.recv()
    except EOFError:
        raise DrawingError("failed") from None  # crashed (e.g. out of memory)
    finally:
        if proc.is_alive():
            proc.kill()
        proc.join(1)
        parent.close()
    if status == "error":
        raise DrawingError(value)
    return value


def to_json(draft: Draft) -> dict[str, Any]:
    pt = lambda x, y: {"x": round(float(x), 1), "y": round(float(y), 1)}  # noqa: E731
    return {
        "source": draft.source,
        "width": int(draft.width),
        "height": int(draft.height),
        "scale": round(draft.scale, 3) if draft.scale else None,
        "image": base64.b64encode(draft.image_png).decode("ascii"),
        "rooms": [
            {"name": r.name, "type": r.type, "polygon": [pt(x, y) for x, y in r.polygon]}
            for r in draft.rooms[:500]
            if len(r.polygon) >= 3
        ],
        "seats": [
            {**pt(s.x, s.y), "rotation": round(float(s.rotation), 1) % 360, "label": s.label}
            for s in draft.seats[:2000]
        ],
        "warnings": sorted(set(draft.warnings)),
    }

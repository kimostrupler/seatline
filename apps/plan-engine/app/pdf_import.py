"""PDF and image plans → background image + rooms (+ desks for vector PDFs).

Vector PDFs (exported from CAD): rooms from the spaces between thick lines/filled walls, names
from the words inside, desks from many identical rectangles, the scale from a "1:100" note.
Scans and images: the background image, plus rooms from thick dark lines (no names or desks).
"""

from __future__ import annotations

import io
import re

import cv2
import numpy as np
import pdfplumber
import pypdfium2 as pdfium
from PIL import Image

from . import ai_names
from .dxf_import import DrawingError
from .geometry import (
    Draft,
    Rect,
    Room,
    Text,
    encode_png,
    find_rooms,
    inside,
    name_rooms,
    seats_from_rects,
    type_rooms,
    unit_from_walls,
    unit_px,
)

PX_PER_M = 40.0
MAX_SIDE_PX = 6000
MIN_SIDE_PX = 1600
UNSCALED_SIDE_PX = 3000
M_PER_PT_AT_1 = 0.0254 / 72  # one PDF point on paper, in metres
SCALE_NOTE = re.compile(r"(?<![\d.,])1\s*:\s*(20|25|50|75|100|125|150|200|250|500)(?![\d.,])")
MAX_OBJECTS = 400_000
Image.MAX_IMAGE_PIXELS = 80_000_000


def analyze_pdf(data: bytes) -> Draft:
    warnings: list[str] = []
    try:
        pdf = pdfplumber.open(io.BytesIO(data))
        page = pdf.pages[0]
    except Exception as error:
        raise DrawingError("unreadable") from error
    if len(pdf.pages) > 1:
        warnings.append("first_page_only")
    page_w, page_h = float(page.width), float(page.height)

    try:
        words = page.extract_words(extra_attrs=["size"])
    except Exception:
        words = []
    note = SCALE_NOTE.search(" ".join(w["text"] for w in words))
    if note:
        m_per_pt = M_PER_PT_AT_1 * int(note.group(1))
        r = PX_PER_M * m_per_pt  # px per pt
    else:
        r = UNSCALED_SIDE_PX / max(page_w, page_h)
        warnings.append("no_scale")
    r = min(max(r, MIN_SIDE_PX / max(page_w, page_h)), MAX_SIDE_PX / max(page_w, page_h))
    scale = r / m_per_pt if note else None

    try:
        bitmap = pdfium.PdfDocument(data)[0].render(scale=r, grayscale=True)
        image = np.array(bitmap.to_pil().convert("L"))
    except Exception as error:
        raise DrawingError("unreadable") from error
    height, width = image.shape

    objects = [*page.lines, *page.rects, *page.curves]
    if len(objects) > MAX_OBJECTS:
        raise DrawingError("too_complex")
    if len(objects) < 20:  # a scan in a PDF
        draft = analyze_image(image)
        draft.warnings = [*warnings, *draft.warnings]
        return draft

    thick, every = _wall_masks(objects, r, (height, width))
    polygons = find_rooms(thick, scale) if thick.any() else []
    if len(polygons) < 2:
        polygons = max(polygons, find_rooms(every, scale), key=len)
    rooms = [Room(polygon=p) for p in polygons]
    texts = [
        Text(
            x=(w["x0"] + w["x1"]) / 2 * r,
            y=(w["top"] + w["bottom"]) / 2 * r,
            text=w["text"],
            height=float(w.get("size") or 0) * r,
        )
        for w in words
    ]
    name_rooms(rooms, _join_lines(texts))
    rects = [
        Rect(x=o["x0"] * r, y=o["top"] * r, w=(o["x1"] - o["x0"]) * r, h=(o["bottom"] - o["top"]) * r)
        for o in page.rects
    ]
    seats = seats_from_rects(rects, scale, (height, width))
    type_rooms(rooms, seats, scale)
    if not rooms:
        warnings.append("no_rooms")
    if not seats:
        warnings.append("no_seats")
    return Draft(
        source="pdf",
        width=width,
        height=height,
        scale=scale,
        image_png=encode_png(image),
        rooms=rooms,
        seats=seats,
        warnings=warnings,
    )


def _wall_masks(objects: list[dict], r: float, size: tuple[int, int]) -> tuple[np.ndarray, np.ndarray]:
    """Walls are drawn thicker than furniture, or filled. `every` has all strokes as a fallback."""
    height, width = size
    thick = np.zeros(size, np.uint8)
    every = np.zeros(size, np.uint8)
    widths = [float(o.get("linewidth") or 0) for o in objects if o.get("stroke")]
    median = float(np.median(widths)) if widths else 0.0
    page_area = width * height
    for o in objects:
        pts = o.get("pts") or [(o["x0"], o["top"]), (o["x1"], o["top"]), (o["x1"], o["bottom"]), (o["x0"], o["bottom"])]
        poly = np.round(np.array(pts, dtype=np.float64) * r).astype(np.int32)
        if len(poly) < 2:
            continue
        lw = float(o.get("linewidth") or 0)
        filled = bool(o.get("fill")) and len(poly) >= 3
        if filled:
            area = cv2.contourArea(poly.astype(np.float32))
            if area > 0.02 * page_area:
                filled = False  # a room colour or background, not a wall
        is_thick = filled or (median > 0 and lw >= 1.8 * median)
        closed = o.get("object_type") == "rect"
        for mask, use in ((thick, is_thick), (every, True)):
            if not use:
                continue
            if filled:
                cv2.fillPoly(mask, [poly], 255)
            else:
                cv2.polylines(mask, [poly], closed, 255, max(2, int(round(lw * r))))
    return thick, every


def _join_lines(texts: list[Text]) -> list[Text]:
    """PDF words → lines of text (words on the same line, close together)."""
    lines: list[Text] = []
    for t in sorted(texts, key=lambda t: (round(t.y / max(t.height, 1)), t.x)):
        last = lines[-1] if lines else None
        if last and abs(last.y - t.y) < 0.5 * max(t.height, 1) and t.x - last.x < 12 * max(t.height, 1):
            last.text = f"{last.text} {t.text}"
            last.x = (last.x + t.x) / 2
        else:
            lines.append(Text(x=t.x, y=t.y, text=t.text, height=t.height))
    return lines


def analyze_image(gray: np.ndarray) -> Draft:
    """Scans and photos: thick dark strokes are walls, small drawn rectangles are desks."""
    gray = _limit(gray)
    height, width = gray.shape
    _, dark = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    # walls: what survives removing thin lines (text, furniture, hatching)
    stroke = max(3, int(round(unit_px(gray.shape, None) * 0.1)))  # ~10 cm
    walls = cv2.morphologyEx(dark, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (stroke, stroke)))
    polygons = find_rooms(walls, None, unit_from_walls(walls))
    rooms = [Room(polygon=p) for p in polygons]
    seats = seats_from_rects(_outlined_rects(dark, walls), None, gray.shape)
    type_rooms(rooms, seats, None)
    warnings = ["scan", "no_scale"] + ([] if seats else ["no_seats"]) + ([] if rooms else ["no_rooms"])
    if rooms and ai_names.configured():
        per_room = [sum(inside(r.polygon, s.x, s.y) for s in seats) for r in rooms]
        warnings.append("ai_names" if ai_names.name_rooms_with_ai(gray, rooms, per_room) else "ai_failed")
    return Draft(
        source="raster",
        width=width,
        height=height,
        scale=None,
        image_png=encode_png(gray),
        rooms=rooms,
        seats=seats,
        warnings=warnings,
    )


def _outlined_rects(dark: np.ndarray, walls: np.ndarray) -> list[Rect]:
    """Axis-aligned rectangles drawn with thin lines (desks), walls removed first."""
    thin = cv2.subtract(dark, cv2.dilate(walls, np.ones((3, 3), np.uint8)))
    contours, _ = cv2.findContours(thin, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    rects: list[Rect] = []
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        if w < 6 or h < 6:
            continue
        approx = cv2.approxPolyDP(c, 0.04 * cv2.arcLength(c, True), True)
        if len(approx) == 4 and cv2.isContourConvex(approx) and cv2.contourArea(approx) >= 0.8 * w * h:
            rects.append(Rect(x=x, y=y, w=w, h=h))
    return rects


def analyze_raster(data: bytes) -> Draft:
    try:
        with Image.open(io.BytesIO(data)) as img:
            img.draft("L", (MAX_SIDE_PX, MAX_SIDE_PX))
            gray = np.array(img.convert("L"))
    except Exception as error:
        raise DrawingError("unreadable") from error
    return analyze_image(gray)


def _limit(gray: np.ndarray) -> np.ndarray:
    side = max(gray.shape)
    if side <= MAX_SIDE_PX:
        return gray
    f = MAX_SIDE_PX / side
    return cv2.resize(gray, (int(gray.shape[1] * f), int(gray.shape[0] * f)), interpolation=cv2.INTER_AREA)

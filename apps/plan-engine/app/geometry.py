"""Shared plan geometry: rooms from a wall mask, room names and types, desks from repeated shapes.

Everything works in image pixels (y down), the floor's coordinate space in Seatline.
`scale` is pixels per metre when known, else None (then a typical floor width is assumed).
"""

from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass, field

import cv2
import numpy as np

Point = tuple[float, float]

# Rooms smaller than this are cupboards, shafts or furniture; doors are closed up to this width.
MIN_ROOM_M2 = 4.0
DOOR_M = 1.1
# A room must have a spot at least this far from its walls (filters the hollow inside of walls).
MIN_ROOM_DEPTH_M = 0.5
# Typical width of a floor when the scale is unknown, to size the tolerances above.
ASSUMED_FLOOR_WIDTH_M = 60.0
MAX_POLYGON_POINTS = 100


@dataclass
class Room:
    polygon: list[Point]
    name: str = ""
    type: str = "other"


@dataclass
class Seat:
    x: float
    y: float
    rotation: float = 0.0
    label: str | None = None


@dataclass
class Text:
    x: float  # centre
    y: float
    text: str
    height: float = 0.0
    width: float = 0.0  # 0 = unknown


@dataclass
class Rect:
    """An axis-aligned shape (desk candidate) in pixels."""

    x: float
    y: float
    w: float
    h: float


@dataclass
class Draft:
    source: str  # dxf | pdf | raster
    width: int
    height: int
    scale: float | None
    image_png: bytes
    rooms: list[Room] = field(default_factory=list)
    seats: list[Seat] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def unit_px(shape: tuple[int, int], scale: float | None) -> float:
    """Pixels per metre: the real scale, or a guess from the image size."""
    return scale or max(shape) / ASSUMED_FLOOR_WIDTH_M


def find_rooms(walls: np.ndarray, scale: float | None, unit: float | None = None) -> list[list[Point]]:
    """Closed spaces between walls (white = wall in `walls`) → room outlines.

    Door openings are closed first (morphological closing), so a room isn't one space with the
    corridor. Spaces touching the image border or surrounding everything are the outside.
    """
    h, w = walls.shape
    unit = unit or unit_px(walls.shape, scale)
    door = max(3, int(round(unit * DOOR_M)))
    closed = cv2.morphologyEx(
        walls, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (door, door))
    )
    free = (closed == 0).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(free, connectivity=4)
    distance = cv2.distanceTransform(free, cv2.DIST_L2, 3)
    rooms: list[list[Point]] = []
    for i in range(1, count):
        x, y, bw, bh, area = (int(v) for v in stats[i])
        if area < MIN_ROOM_M2 * unit * unit:
            continue
        if x == 0 or y == 0 or x + bw >= w or y + bh >= h:
            continue  # the outside
        if bw > 0.9 * w and bh > 0.9 * h:
            continue  # the space around the building inside a drawing frame
        mask = (labels[y : y + bh, x : x + bw] == i).astype(np.uint8)
        if float(distance[y : y + bh, x : x + bw][mask > 0].max()) < MIN_ROOM_DEPTH_M * unit:
            continue  # thin strip: the inside of a double-line wall
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        contour = max(contours, key=cv2.contourArea) + np.array([x, y])
        rooms.append(simplify(contour, unit))
    return rooms


def simplify(contour: np.ndarray, unit: float) -> list[Point]:
    """Outline with few corners; nearly rectangular rooms become exact rectangles."""
    x, y, w, h = cv2.boundingRect(contour)
    if cv2.contourArea(contour) >= 0.93 * w * h:
        return [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
    eps = max(1.5, 0.12 * unit)
    approx = cv2.approxPolyDP(contour, eps, True)
    while len(approx) > MAX_POLYGON_POINTS:
        eps *= 1.5
        approx = cv2.approxPolyDP(contour, eps, True)
    return [(float(p[0][0]), float(p[0][1])) for p in approx]


def polygon_area(polygon: list[Point]) -> float:
    return abs(cv2.contourArea(np.array(polygon, dtype=np.float32)))


def inside(polygon: list[Point], x: float, y: float) -> bool:
    return cv2.pointPolygonTest(np.array(polygon, dtype=np.float32), (x, y), False) >= 0


_AREA_TEXT = re.compile(r"^\s*[\d'.,]+\s*(m2|m²|qm|sqm|m)?\s*$", re.I)
_SKIP_TEXT = re.compile(r"^(h|hl|rh|bh|stb|ok|uk|fbh|ofb|r)\s*[=:]|^[±+-]\s*\d", re.I)


def name_rooms(rooms: list[Room], texts: list[Text], max_len: int = 100) -> None:
    """A room's name: the text written inside it (largest first), without areas and heights."""
    for room in rooms:
        found = [
            t
            for t in texts
            if inside(room.polygon, t.x, t.y)
            and t.text.strip()
            and not _AREA_TEXT.match(t.text)
            and not _SKIP_TEXT.match(t.text.strip())
        ]
        found.sort(key=lambda t: (-round(t.height, 1), t.y, t.x))
        parts: list[str] = []
        for t in found:
            text = " ".join(t.text.split())
            if text not in parts:
                parts.append(text)
            if len(parts) == 2:
                break
        # a room number ("3.14") reads best in front of the name
        parts.sort(key=lambda p: 0 if re.fullmatch(r"[\w.\-/]{1,8}", p) and any(c.isdigit() for c in p) else 1)
        room.name = " ".join(parts)[:max_len]


_TYPES = [
    ("meeting", r"sitzung|besprech|meeting|konferenz|conference|r[ée]union|board|workshop"),
    ("open_space", r"open ?space|gro(ss|ß)raum|open office|plateau|espace ouvert|bullpen|team ?zone"),
    ("office", r"b(ü|u|ue)ro|office|bureau|arbeitsraum|arbeitsplatz|einzelb|direktion|chef"),
    (
        "other",
        r"\bwc\b|toilet|sanit|k(ü|u|ue)che|kitchen|cuisine|teek|caf[eé]|lager|storage|archiv|technik"
        r"|server|elektro|treppe|stair|escalier|\blift\b|elevator|ascenseur|flur|korridor|\bgang\b"
        r"|corridor|couloir|empfang|reception|r[ée]ception|garderobe|putz|dusche|shower|lounge"
        r"|vorplatz|entr[ée]e|eingang|lobby|schacht|kopier|print",
    ),
]


def join_words(texts: list[Text]) -> list[Text]:
    """Words (PDF text, OCR) → lines: words in the same row with a small gap between them.
    Labels of neighbouring rooms at the same height stay apart."""
    rows: list[list[Text]] = []
    for t in sorted(texts, key=lambda t: t.y):
        if rows and abs(rows[-1][0].y - t.y) < 0.5 * max(t.height, rows[-1][0].height, 1):
            rows[-1].append(t)
        else:
            rows.append([t])
    lines: list[Text] = []
    for row in rows:
        last: Text | None = None
        for t in sorted(row, key=lambda t: t.x):
            h = max(t.height, last.height if last else 0, 1)
            if last is not None:
                gap = (t.x - t.width / 2) - (last.x + last.width / 2)
                limit = 1.5 * h if t.width and last.width else 6 * h  # without widths: centres only
                if -h < gap < limit:
                    left = last.x - last.width / 2
                    right = max(last.x + last.width / 2, t.x + t.width / 2)
                    last.text = f"{last.text} {t.text}"
                    last.x, last.width = (left + right) / 2, right - left
                    continue
            last = Text(x=t.x, y=t.y, text=t.text, height=t.height, width=t.width)
            lines.append(last)
    return lines


def type_from_name(name: str) -> str | None:
    """Office / meeting / open space / other from words in the name, if any (de/fr/en)."""
    for kind, pattern in _TYPES:
        if re.search(pattern, name, re.I):
            return kind
    return None


def guess_type(name: str, seats: int, area_m2: float | None) -> str:
    by_name = type_from_name(name)
    if by_name:
        return by_name
    if seats >= 6 or (area_m2 is not None and area_m2 >= 60 and seats > 0):
        return "open_space"
    return "office" if seats else "other"


def type_rooms(rooms: list[Room], seats: list[Seat], scale: float | None) -> None:
    for room in rooms:
        count = sum(inside(room.polygon, s.x, s.y) for s in seats)
        area = polygon_area(room.polygon) / scale**2 if scale else None
        room.type = guess_type(room.name, count, area)


def seats_from_rects(rects: list[Rect], scale: float | None, image_size: tuple[int, int]) -> list[Seat]:
    """Desks are drawn as many identical rectangles: keep groups of ≥ 4 with a desk's size."""
    groups: dict[tuple[int, int], list[Rect]] = defaultdict(list)
    tolerance = max(2.0, (scale or unit_px(image_size, None)) * 0.05)  # 5 cm
    for r in rects:
        long, short = max(r.w, r.h), min(r.w, r.h)
        groups[(round(long / tolerance), round(short / tolerance))].append(r)
    seats: list[Seat] = []
    width = max(image_size)
    for group in groups.values():
        if len(group) < 4:
            continue
        long, short = max(group[0].w, group[0].h), min(group[0].w, group[0].h)
        if short <= 0 or not 1.3 <= long / short <= 3.2:
            continue
        if scale:
            if not (1.0 <= long / scale <= 2.2 and 0.5 <= short / scale <= 1.1):
                continue
        elif not 0.006 * width <= long <= 0.05 * width:
            continue
        for r in group:
            seats.append(Seat(x=r.x + r.w / 2, y=r.y + r.h / 2, rotation=0 if r.w >= r.h else 90))
    return dedupe_seats(seats, scale, image_size)


def dedupe_seats(seats: list[Seat], scale: float | None, image_size: tuple[int, int]) -> list[Seat]:
    """Drop seats drawn twice (e.g. a desk outline plus its fill)."""
    near = (scale or unit_px(image_size, None)) * 0.4
    kept: list[Seat] = []
    for s in seats:
        if all(abs(s.x - k.x) > near or abs(s.y - k.y) > near for k in kept):
            kept.append(s)
    return kept


def unit_from_walls(walls: np.ndarray) -> float | None:
    """Pixels per metre guessed from the wall thickness (interior walls are ~15 cm)."""
    distance = cv2.distanceTransform((walls > 0).astype(np.uint8), cv2.DIST_L2, 3)
    ridge = distance[(distance >= cv2.dilate(distance, np.ones((3, 3), np.uint8))) & (distance >= 1.5)]
    if ridge.size < 50:
        return None
    thickness = 2 * float(np.percentile(ridge, 30))
    side = max(walls.shape)
    return float(np.clip(thickness / 0.15, side / 150, side / 15))


def encode_png(gray: np.ndarray) -> bytes:
    ok, data = cv2.imencode(".png", gray, [cv2.IMWRITE_PNG_COMPRESSION, 6])
    if not ok:
        raise RuntimeError("PNG encoding failed")
    return data.tobytes()

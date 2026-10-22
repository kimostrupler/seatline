"""DXF (CAD) plans → background image + rooms + desks.

Rooms come from closed room outlines if the drawing has them (room/area layers), else from the
spaces between walls. Desks are block inserts named or layered like desks, else any block placed
at least 4 times with a desk's size. Names come from texts and room stamps inside each room.
"""

from __future__ import annotations

import io
import math
import re
from collections import defaultdict

import cv2
import numpy as np
from ezdxf import bbox, recover
from ezdxf.addons.drawing import Frontend, RenderContext
from ezdxf.addons.drawing.config import Configuration
from ezdxf.addons.drawing.recorder import (
    FilledPathsRecord,
    PathRecord,
    PointsRecord,
    Recorder,
    SolidLinesRecord,
)

from .geometry import (
    Draft,
    Room,
    Seat,
    Text,
    dedupe_seats,
    encode_png,
    find_rooms,
    name_rooms,
    polygon_area,
    type_rooms,
)

PX_PER_M = 40.0  # matches the map's desk size (64 px ≈ 1.6 m)
MAX_SIDE_PX = 6000
MARGIN = 0.03
MAX_ENTITIES = 300_000

# metres per drawing unit, by $INSUNITS
UNITS = {1: 0.0254, 2: 0.3048, 4: 0.001, 5: 0.01, 6: 1.0, 14: 0.1}

WALL_LAYER = re.compile(
    r"wand|w(ä|ae)nde|wall|mauer|\bmur|cloison|beton|concrete|tragend|st(ü|ue)tz|column|s(ä|ae)ule"
    r"|fenster|window|fen[eê]tre|glas|fassade|facade",
    re.I,
)
SKIP_LAYER = re.compile(
    r"m(ö|oe)bel|furn|mobil|einricht|desk|tisch|stuhl|chair|text|dim|bema(ss|ß)|cota|hatch"
    r"|schraff|raster|grid|achs|axis|rahmen|frame|title|plankopf|cartouche|symbol|elektr|sanit"
    r"|defpoints|viewport|t(ü|ue)r|door|porte",
    re.I,
)
ROOM_LAYER = re.compile(r"raum|r(ä|ae)ume|room|space|fl(ä|ae)che|area|zone|\blocal|pi(è|e)ce|nutz", re.I)
DESK = re.compile(
    r"desk|tisch|schreibt|arbeitspl|workstation|work ?place|poste|bureau|^ap\b|^ap[_\-\d]|bench", re.I
)
NOT_DESK = re.compile(r"besprech|meeting|konferenz|sitzung|r[ée]union|conf|ess|dining|couch", re.I)
CHAIR = re.compile(r"chair|stuhl|sessel|chaise|si(è|e)ge|drehst", re.I)
NOT_WALL = {"ARC", "CIRCLE", "ELLIPSE", "SPLINE", "TEXT", "MTEXT", "DIMENSION", "LEADER", "MULTILEADER", "INSERT", "HATCH", "POINT"}
LABEL_TAGS = {"NR", "NUMMER", "NUMBER", "NO", "NUM", "ID", "PLATZ", "LABEL", "AP", "DESK"}
ROOM_TAGS = re.compile(r"name|bez|raum|room|nr|num|nummer|nom|d[ée]sign", re.I)


class DrawingError(Exception):
    """The file can't be used; `code` is shown to the user (translated)."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def analyze_dxf(data: bytes) -> Draft:
    try:
        doc, _ = recover.read(io.BytesIO(data))
    except Exception as error:  # ezdxf raises many types for broken files
        raise DrawingError("unreadable") from error
    msp = doc.modelspace()
    if len(msp) > MAX_ENTITIES:
        raise DrawingError("too_complex")

    recorder = Recorder()
    config = Configuration(lineweight_scaling=0)
    Frontend(RenderContext(doc), recorder, config=config).draw_layout(msp, finalize=True)
    player = recorder.player()
    box = player.bbox()
    if not box.has_data or box.size.x <= 0 or box.size.y <= 0:
        raise DrawingError("empty")

    warnings: list[str] = []
    m_per_unit = UNITS.get(int(doc.header.get("$INSUNITS", 0)))
    if m_per_unit is None:
        # unitless: a floor is ~10–200 m wide, so the size tells the unit
        longest = max(box.size.x, box.size.y)
        m_per_unit = 0.001 if longest > 5000 else 0.01 if longest > 500 else 1.0
        warnings.append("units_guessed")
    longest_m = max(box.size.x, box.size.y) * m_per_unit
    px_per_m = min(PX_PER_M, MAX_SIDE_PX / (longest_m * (1 + 2 * MARGIN)))
    k = px_per_m * m_per_unit  # px per drawing unit
    margin = MARGIN * longest_m * px_per_m
    width = int(math.ceil(box.size.x * k + 2 * margin))
    height = int(math.ceil(box.size.y * k + 2 * margin))
    minx, maxy = box.extmin.x, box.extmax.y

    def to_px(points: np.ndarray) -> np.ndarray:
        out = np.empty_like(points, dtype=np.float64)
        out[:, 0] = (points[:, 0] - minx) * k + margin
        out[:, 1] = (maxy - points[:, 1]) * k + margin
        return out

    image = np.full((height, width), 255, np.uint8)
    walls_layer = np.zeros((height, width), np.uint8)
    walls_all = np.zeros((height, width), np.uint8)
    flat = max(0.5 / k, 1e-6)  # flatten curves to half a pixel

    kinds = {}
    for record, props in player.recordings():
        layer = props.layer or ""
        is_wall = bool(WALL_LAYER.search(layer))
        # door swings, furniture blocks and texts are never walls (curved walls are rare)
        handle = props.handle
        if handle not in kinds:
            entity = doc.entitydb.get(handle) if handle else None
            kinds[handle] = entity.dxftype() if entity is not None else ""
        is_skip = (bool(SKIP_LAYER.search(layer)) or kinds[handle] in NOT_WALL) and not is_wall
        if isinstance(record, FilledPathsRecord):
            polys = [_int(to_px(np.array([(v.x, v.y) for v in p.flattening(flat)]))) for p in record.paths]
            polys = [p for p in polys if len(p) >= 3]
            if polys:
                cv2.fillPoly(image, polys, 120, cv2.LINE_AA)
                _mark(polys, is_wall, is_skip, walls_layer, walls_all, filled=True)
            continue
        if isinstance(record, PointsRecord):
            pts = to_px(record.points.np_vertices())
            if len(pts) > 2:  # filled polygon (solid, wall fill)
                poly = [_int(pts)]
                cv2.fillPoly(image, poly, 200, cv2.LINE_AA)
                _mark(poly, is_wall, is_skip, walls_layer, walls_all, filled=True)
                continue
            lines = [_int(pts)] if len(pts) == 2 else []
        elif isinstance(record, SolidLinesRecord):
            pts = _int(to_px(record.lines.np_vertices()))
            lines = [pts[i : i + 2] for i in range(0, len(pts) - 1, 2)]
        elif isinstance(record, PathRecord):
            pts = np.array([(v.x, v.y) for v in record.path.flattening(flat)])
            lines = [_int(to_px(pts))] if len(pts) >= 2 else []
        else:
            continue
        if lines:
            cv2.polylines(image, lines, False, 70, 1, cv2.LINE_AA)
            _mark(lines, is_wall, is_skip, walls_layer, walls_all, filled=False)

    to_point = lambda x, y: tuple(to_px(np.array([[x, y]]))[0])  # noqa: E731
    texts = _texts(msp, to_point, k)
    rooms = _room_outlines(msp, to_px, px_per_m)
    if len(rooms) < 2:
        polygons = find_rooms(walls_layer, px_per_m) if walls_layer.any() else []
        if len(polygons) < 2:
            polygons = max(polygons, find_rooms(walls_all, px_per_m), key=len)
        rooms = [Room(polygon=p) for p in polygons]
    name_rooms(rooms, texts)
    seats = _seats(doc, msp, to_point, k, px_per_m, (height, width))
    type_rooms(rooms, seats, px_per_m)

    if not rooms:
        warnings.append("no_rooms")
    if not seats:
        warnings.append("no_seats")
    return Draft(
        source="dxf",
        width=width,
        height=height,
        scale=px_per_m,
        image_png=encode_png(image),
        rooms=rooms,
        seats=seats,
        warnings=warnings,
    )


def _int(points: np.ndarray) -> np.ndarray:
    return np.round(points).astype(np.int32)


def _mark(polys, is_wall, is_skip, walls_layer, walls_all, filled: bool) -> None:
    targets = ([walls_layer] if is_wall else []) + ([] if is_skip else [walls_all])
    for target in targets:
        if filled:
            cv2.fillPoly(target, polys, 255)
        else:
            cv2.polylines(target, polys, False, 255, 2)


def _texts(msp, to_point, k: float) -> list[Text]:
    texts: list[Text] = []
    for e in msp.query("TEXT MTEXT"):
        try:
            if e.dxftype() == "TEXT":
                content, height = e.dxf.text, e.dxf.height
                # aligned texts are anchored at align_point
                pos = e.dxf.align_point if e.dxf.hasattr("align_point") and (e.dxf.halign or e.dxf.valign) else e.dxf.insert
            else:
                content, height, pos = e.plain_text(), e.dxf.char_height, e.dxf.insert
        except Exception:
            continue
        x, y = to_point(pos.x, pos.y)
        for i, line in enumerate(str(content).splitlines()):
            texts.append(Text(x=x, y=y + i * height * k, text=line, height=height * k))
    # room stamps: blocks with attributes like NAME / NUMMER
    for insert in msp.query("INSERT"):
        for attrib in insert.attribs:
            if ROOM_TAGS.search(attrib.dxf.tag or "") and attrib.dxf.text:
                x, y = to_point(insert.dxf.insert.x, insert.dxf.insert.y)
                texts.append(Text(x=x, y=y, text=attrib.dxf.text, height=attrib.dxf.height * k))
    return texts


def _room_outlines(msp, to_px, px_per_m: float) -> list[Room]:
    """Closed outlines on room/area layers: exact rooms, when the architect drew them."""
    rooms: list[Room] = []
    for e in msp.query("LWPOLYLINE POLYLINE"):
        if not ROOM_LAYER.search(e.dxf.layer or "") or not e.is_closed:
            continue
        try:
            points = np.array([(p[0], p[1]) for p in e.points()] if e.dxftype() == "POLYLINE" else [(p[0], p[1]) for p in e.get_points("xy")])
        except Exception:
            continue
        if len(points) < 3 or len(points) > 500:
            continue
        polygon = [(float(x), float(y)) for x, y in to_px(points)]
        if polygon_area(polygon) >= 2.0 * px_per_m**2:
            rooms.append(Room(polygon=[(round(x, 1), round(y, 1)) for x, y in polygon]))
    return rooms


def _seats(doc, msp, to_point, k: float, px_per_m: float, size: tuple[int, int]) -> list[Seat]:
    """Desks: named desk blocks; else chairs; else any block used ≥ 4 times with a desk's size."""
    named: list[Seat] = []
    chairs: list[Seat] = []
    by_block: dict[str, list[Seat]] = defaultdict(list)
    block_size: dict[str, tuple[float, float]] = {}
    for insert in msp.query("INSERT"):
        name = insert.dxf.name or ""
        layer = insert.dxf.layer or ""
        if name.startswith("*"):
            continue  # anonymous blocks: hatches, dimensions
        if name not in block_size:
            ext = bbox.extents(doc.blocks.get(name) or [], fast=True)
            block_size[name] = (ext.size.x, ext.size.y) if ext.has_data else (0.0, 0.0)
        local_w, local_h = block_size[name]
        ext = bbox.extents([insert], fast=True)
        if not ext.has_data:
            continue
        cx, cy = to_point(ext.center.x, ext.center.y)
        rotation = insert.dxf.rotation + (90 if local_h > local_w else 0)
        seat = Seat(x=round(cx, 1), y=round(cy, 1), rotation=round((-rotation) % 360, 1), label=_label(insert))
        size_m = sorted((ext.size.x * k / px_per_m, ext.size.y * k / px_per_m))
        if not 0.3 <= size_m[1] <= 4.0:
            continue
        text = f"{name} {layer}"
        if DESK.search(name) or DESK.search(layer):
            if not NOT_DESK.search(text):
                named.append(seat)
        elif CHAIR.search(text):
            chairs.append(seat)
        else:
            long, short = max(local_w, local_h) * k / px_per_m, min(local_w, local_h) * k / px_per_m
            if 1.0 <= long <= 2.2 and 0.5 <= short <= 1.6:  # a desk, maybe with its chair
                by_block[name].append(seat)
    if named:
        return dedupe_seats(named, px_per_m, size)
    repeated = [s for seats in by_block.values() if len(seats) >= 4 for s in seats]
    if repeated:
        return dedupe_seats(repeated, px_per_m, size)
    return dedupe_seats(chairs, px_per_m, size)


def _label(insert) -> str | None:
    for attrib in getattr(insert, "attribs", []):
        if (attrib.dxf.tag or "").upper() in LABEL_TAGS and attrib.dxf.text:
            return str(attrib.dxf.text).strip()[:50] or None
    return None


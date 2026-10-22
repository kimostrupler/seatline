"""Made-up office floor (40 × 20 m) as DXF, PDF and a scanned image — for tests and trying the import.

    python samples/make_samples.py      # writes office.dxf, office-plain.dxf, office.pdf, office-scan.jpg

Layout: a corridor in the middle; north: two offices, a meeting room, an open space;
south: kitchen, WC, an open space, an office. Doors are gaps (0.9 m) with swing arcs.
"""

from __future__ import annotations

import math
import zlib
from pathlib import Path

import cv2
import ezdxf
import numpy as np

W, H = 40.0, 20.0  # metres
EXT, INT = 0.3, 0.12  # wall thickness
CORRIDOR = (9.0, 11.0)
DOOR = 0.9

# (name, x0, y0, x1, y1, desks as (x, y, rotation°)); y up, metres
ROOMS = [
    ("1.01 Büro", 0, 11, 6, 20, [(3, 16, 0)]),
    ("1.02 Büro", 6, 11, 12, 20, [(8, 16, 0), (10, 16, 0)]),
    ("1.03 Sitzungszimmer", 12, 11, 20, 20, []),
    ("1.04 Open Space", 20, 11, 40, 20, [(x, y, 0) for x in (23, 26, 29, 32, 35) for y in (14, 17)]),
    ("1.05 Küche", 0, 0, 5, 9, []),
    ("1.06 WC", 5, 0, 8, 9, []),
    ("1.07 Open Space", 8, 0, 30, 9, [(x, y, 90) for x in (11, 15, 19, 23) for y in (2.5, 6)]),
    ("1.08 Büro", 30, 0, 40, 9, [(33, 4, 0), (37, 4, 0)]),
]
DESK_W, DESK_D = 1.6, 0.8


def walls() -> list[tuple[float, float, float, float, float]]:
    """Wall centre lines (x0, y0, x1, y1, thickness) with door gaps."""
    out = [
        (0, 0, W, 0, EXT),
        (0, H, W, H, EXT),
        (0, 0, 0, H, EXT),
        (W, 0, W, H, EXT),
    ]
    # corridor walls with a door per room
    for y in CORRIDOR:
        rooms = [r for r in ROOMS if (r[2] == y or r[4] == y)]
        xs = [0.0]
        for _, x0, _, x1, _, _ in sorted(rooms, key=lambda r: r[1]):
            mid = (x0 + x1) / 2
            xs += [mid - DOOR / 2, mid + DOOR / 2]
        xs.append(W)
        out += [(xs[i], y, xs[i + 1], y, INT) for i in range(0, len(xs), 2)]
    # walls between rooms
    for _, x0, y0, x1, y1, _ in ROOMS:
        if x0 > 0:
            out.append((x0, y0, x0, y1, INT))
    return out


def desks() -> list[tuple[float, float, float]]:
    return [d for r in ROOMS for d in r[5]]


def door_arcs() -> list[tuple[float, float]]:
    """Hinge points of the doors (arc radius = DOOR)."""
    out = []
    for _, x0, y0, x1, y1, _ in ROOMS:
        y = CORRIDOR[0] if y1 == CORRIDOR[0] else CORRIDOR[1]
        out.append(((x0 + x1) / 2 - DOOR / 2, y))
    return out


# ---- DXF ---------------------------------------------------------------------------------------


def make_dxf(path: Path, named_layers: bool = True) -> None:
    doc = ezdxf.new("R2018", units=4 if named_layers else 0)  # mm, or unitless
    msp = doc.modelspace()
    mm = 1000.0
    wall_layer = "A-Wände" if named_layers else "0"
    for name in ("A-Wände", "A-Türen", "A-Möbel", "A-Raumtext"):
        doc.layers.add(name)
    for x0, y0, x1, y1, t in walls():
        # double-line walls: two parallel lines, closed at the ends
        dx, dy = x1 - x0, y1 - y0
        length = math.hypot(dx, dy)
        nx, ny = -dy / length * t / 2, dx / length * t / 2
        a = ((x0 + nx) * mm, (y0 + ny) * mm)
        b = ((x1 + nx) * mm, (y1 + ny) * mm)
        c = ((x1 - nx) * mm, (y1 - ny) * mm)
        d = ((x0 - nx) * mm, (y0 - ny) * mm)
        msp.add_lwpolyline([a, b, c, d], close=True, dxfattribs={"layer": wall_layer})
    for hx, hy in door_arcs():
        msp.add_arc((hx * mm, hy * mm), DOOR * mm, 0, 90, dxfattribs={"layer": "A-Türen" if named_layers else "0"})
    block_name = "Tisch_160x80" if named_layers else "B1"
    block = doc.blocks.new(block_name)
    block.add_lwpolyline(
        [(-DESK_W / 2 * mm, -DESK_D / 2 * mm), (DESK_W / 2 * mm, -DESK_D / 2 * mm), (DESK_W / 2 * mm, DESK_D / 2 * mm), (-DESK_W / 2 * mm, DESK_D / 2 * mm)],
        close=True,
    )
    block.add_circle((0, -DESK_D / 2 * mm - 300), 250)  # the chair
    for i, (x, y, rot) in enumerate(desks()):
        msp.add_blockref(block_name, (x * mm, y * mm), dxfattribs={"rotation": rot, "layer": "A-Möbel" if named_layers else "0"})
    for name, x0, y0, x1, y1, _ in ROOMS:
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2 + (1.5 if y0 >= CORRIDOR[1] else -1.5)
        layer = "A-Raumtext" if named_layers else "0"
        msp.add_text(name, height=250, dxfattribs={"layer": layer}).set_placement((cx * mm, (y1 - 1.0) * mm if y0 >= CORRIDOR[1] else (y0 + 1.0) * mm))
        area = (x1 - x0) * (y1 - y0)
        msp.add_text(f"{area:.1f} m²", height=180, dxfattribs={"layer": layer}).set_placement((cx * mm, ((y1 - 1.5) if y0 >= CORRIDOR[1] else (y0 + 0.5)) * mm))
    doc.saveas(path)


# ---- PDF (vector, 1:100) -----------------------------------------------------------------------

PT_PER_M = 72 / 0.0254 / 100  # 1:100
PAGE = (W * PT_PER_M + 120, H * PT_PER_M + 140)


def _pt(x: float, y: float) -> tuple[float, float]:
    return 60 + x * PT_PER_M, 80 + y * PT_PER_M  # PDF y is up, like our metres


def make_pdf(path: Path) -> None:
    ops: list[str] = ["0 0 0 RG"]
    for x0, y0, x1, y1, t in walls():
        a, b = _pt(x0, y0), _pt(x1, y1)
        ops.append(f"{t * PT_PER_M:.2f} w {a[0]:.2f} {a[1]:.2f} m {b[0]:.2f} {b[1]:.2f} l S")
    ops.append("0.4 w")
    for x, y, rot in desks():
        w, d = (DESK_W, DESK_D) if rot in (0, 180) else (DESK_D, DESK_W)
        a = _pt(x - w / 2, y - d / 2)
        ops.append(f"{a[0]:.2f} {a[1]:.2f} {w * PT_PER_M:.2f} {d * PT_PER_M:.2f} re S")
    for hx, hy in door_arcs():
        a = _pt(hx, hy)
        r = DOOR * PT_PER_M
        ops.append(f"{a[0] + r:.2f} {a[1]:.2f} m {a[0] + r:.2f} {a[1] + r * 0.55:.2f} {a[0] + r * 0.55:.2f} {a[1] + r:.2f} {a[0]:.2f} {a[1] + r:.2f} c S")
    texts = []
    for name, x0, y0, x1, y1, _ in ROOMS:
        cx = (x0 + x1) / 2 - len(name) * 0.09
        cy = y1 - 1.0 if y0 >= CORRIDOR[1] else y0 + 1.0
        texts.append((cx, cy, 9, name))
        texts.append((cx, cy - 0.6, 7, f"{(x1 - x0) * (y1 - y0):.1f} m²"))
    texts.append((0, -0.5, 10, "Grundriss 1. OG  M 1:100"))
    for x, y, size, text in texts:
        p = _pt(x, y)
        literal = text.encode("cp1252").replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)")
        ops.append(f"BT /F1 {size} Tf {p[0]:.2f} {p[1]:.2f} Td (" + literal.decode("latin-1") + ") Tj ET")
    content = zlib.compress("\n".join(ops).encode("latin-1"))
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE[0]:.0f} {PAGE[1]:.0f}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>".encode(),
        b"<< /Length %d /Filter /FlateDecode >>\nstream\n" % len(content) + content + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, obj in enumerate(objects, 1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + obj + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    out += b"".join(b"%010d 00000 n \n" % o for o in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objects) + 1, xref)
    path.write_bytes(bytes(out))


# ---- scan (PNG) --------------------------------------------------------------------------------


def make_scan(path: Path, px_per_m: float = 40) -> None:
    margin = 60
    img = np.full((int(H * px_per_m) + 2 * margin, int(W * px_per_m) + 2 * margin), 250, np.uint8)
    p = lambda x, y: (int(margin + x * px_per_m), int(margin + (H - y) * px_per_m))  # noqa: E731
    for x0, y0, x1, y1, t in walls():
        cv2.line(img, p(x0, y0), p(x1, y1), 30, max(2, int(t * px_per_m)))
    for x, y, rot in desks():
        w, d = (DESK_W, DESK_D) if rot in (0, 180) else (DESK_D, DESK_W)
        cv2.rectangle(img, p(x - w / 2, y - d / 2), p(x + w / 2, y + d / 2), 90, 1)
    for name, x0, y0, x1, y1, _ in ROOMS:  # room labels, like on a real plan (ASCII: OpenCV fonts)
        label = name.replace("ü", "ue").replace("ä", "ae").replace("ö", "oe")
        size = px_per_m / 60
        (tw, _), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, size, 1)
        cy = y1 - 1.2 if y0 >= CORRIDOR[1] else y0 + 1.0
        cx, cy_px = p((x0 + x1) / 2, cy)
        cv2.putText(img, label, (cx - tw // 2, cy_px), cv2.FONT_HERSHEY_SIMPLEX, size, 40, 1, cv2.LINE_AA)
    noise = np.random.default_rng(1).normal(0, 3, img.shape)
    cv2.imwrite(str(path), np.clip(img + noise, 0, 255).astype(np.uint8))


if __name__ == "__main__":
    here = Path(__file__).parent
    make_dxf(here / "office.dxf")
    make_dxf(here / "office-plain.dxf", named_layers=False)
    make_pdf(here / "office.pdf")
    make_scan(here / "office-scan.jpg")
    print("wrote", ", ".join(p.name for p in sorted(here.glob("office*"))))

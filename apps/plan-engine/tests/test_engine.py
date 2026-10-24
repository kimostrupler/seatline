"""The plan engine on made-up plans (samples/make_samples.py): DXF, PDF and a scan of one office."""

import importlib.util
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import main
from app.analyze import analyze, analyze_isolated, kind_of, to_json
from app.dxf_import import DrawingError
from app.geometry import Text, join_words

spec = importlib.util.spec_from_file_location("samples", Path(__file__).parents[1] / "samples" / "make_samples.py")
samples = importlib.util.module_from_spec(spec)
spec.loader.exec_module(samples)

NAMES = {r[0] for r in samples.ROOMS}
DESKS = len(samples.desks())


@pytest.fixture(scope="module")
def files(tmp_path_factory):
    d = tmp_path_factory.mktemp("plans")
    samples.make_dxf(d / "office.dxf")
    samples.make_dxf(d / "plain.dxf", named_layers=False)
    samples.make_pdf(d / "office.pdf")
    samples.make_scan(d / "scan.png")
    return {p.name: p.read_bytes() for p in d.iterdir()}


def names(draft):
    return {r.name for r in draft.rooms if r.name}


def test_dxf_with_layers_finds_every_room_name_type_and_desk(files):
    d = analyze(files["office.dxf"])
    assert d.source == "dxf" and d.scale == 40 and d.warnings == []
    assert names(d) == NAMES
    assert len(d.rooms) == len(NAMES) + 1  # + the corridor
    types = {r.name: r.type for r in d.rooms}
    assert types["1.03 Sitzungszimmer"] == "meeting"
    assert types["1.04 Open Space"] == "open_space"
    assert types["1.01 Büro"] == "office"
    assert types["1.06 WC"] == "other"
    assert len(d.seats) == DESKS
    # a 6 × 9 m office is 240 × 360 px at 40 px/m (inside the walls a bit less)
    office = next(r for r in d.rooms if r.name == "1.01 Büro")
    xs, ys = [p[0] for p in office.polygon], [p[1] for p in office.polygon]
    assert 220 < max(xs) - min(xs) <= 240 and 330 < max(ys) - min(ys) <= 360


def test_dxf_without_layer_names_or_units_still_works(files):
    d = analyze(files["plain.dxf"])
    assert "units_guessed" in d.warnings
    assert names(d) == NAMES
    assert len(d.seats) == DESKS  # the desk block is used 23 times with a desk's size


def test_vector_pdf_reads_the_scale_note_names_and_desks(files):
    d = analyze(files["office.pdf"])
    assert d.source == "pdf"
    assert d.scale == pytest.approx(40, rel=0.01)  # "M 1:100"
    assert names(d) == NAMES
    assert len(d.seats) == DESKS
    assert sum(s.rotation == 90 for s in d.seats) == 8  # the turned desks in 1.07


def test_scan_finds_rooms_desks_and_most_names(files):
    d = analyze(files["scan.png"])
    assert d.source == "raster" and d.scale is None
    assert len(d.rooms) == len(NAMES) + 1
    assert len(d.seats) == DESKS  # thin drawn rectangles of a desk's size
    assert sum(s.rotation == 90 for s in d.seats) == 8
    assert {"scan", "no_scale"} <= set(d.warnings) and "no_seats" not in d.warnings
    if not shutil.which("tesseract"):
        pytest.skip("OCR (tesseract) isn't installed here")
    ascii_names = {n.replace("ü", "ue") for n in NAMES}  # the scan's labels are ASCII
    assert len(names(d) & ascii_names) >= 6, names(d)  # printed labels read by OCR
    assert names(d) <= ascii_names  # and nothing made up


def test_words_on_one_line_stay_in_their_room():
    words = [
        Text(x=150, y=100, text="1.01", height=14, width=35),
        Text(x=200, y=101, text="Büro", height=13, width=48),
        Text(x=400, y=99, text="1.02", height=14, width=35),
        Text(x=720, y=102, text="Sitzungszimmer", height=18, width=136),
    ]
    assert [w.text for w in join_words(words)] == ["1.01 Büro", "1.02", "Sitzungszimmer"]


def test_file_kinds():
    assert kind_of(b"AC1032\x00\x00") == "dwg"
    assert kind_of(b"%PDF-1.7") == "pdf"
    assert kind_of(b"\x89PNG\r\n") == "image"
    assert kind_of(b"  0\nSECTION\n  2\nHEADER\n") == "dxf"
    assert kind_of(b"hello") == "unknown"
    with pytest.raises(DrawingError) as e:
        analyze(b"AC1032 rest of a dwg")
    assert e.value.code == "dwg"


def test_broken_files_fail_cleanly_in_the_child_process():
    with pytest.raises(DrawingError) as e:
        analyze_isolated(b"%PDF-1.4 this is not really a pdf")
    assert e.value.code == "unreadable"
    with pytest.raises(DrawingError) as e:
        analyze_isolated(b"just text")
    assert e.value.code == "unsupported"


def _hog(conn):  # runs in a child: allocate more than the cap
    from app.analyze import MEMORY_LIMIT_BYTES, limit_memory

    limit_memory()
    try:
        bytearray(MEMORY_LIMIT_BYTES + 200 * 1024 * 1024)
        conn.send("allocated")
    except MemoryError:
        conn.send("memory_error")
    conn.close()


def test_child_memory_is_capped_with_a_clean_memory_error():
    import multiprocessing as mp

    parent, child = mp.get_context("spawn").Pipe(duplex=False)
    proc = mp.get_context("spawn").Process(target=_hog, args=(child,))
    proc.start()
    child.close()
    assert parent.poll(60)
    assert parent.recv() == "memory_error"
    proc.join(5)


def test_json_is_what_the_api_expects(files):
    out = to_json(analyze(files["office.dxf"]))
    assert set(out) == {"source", "width", "height", "scale", "image", "rooms", "seats", "warnings"}
    assert all(0 <= s["rotation"] < 360 for s in out["seats"])
    assert all(len(r["polygon"]) >= 3 and set(r["polygon"][0]) == {"x", "y"} for r in out["rooms"])


def test_http_endpoint_and_token(files, monkeypatch):
    client = TestClient(main.app)
    assert client.get("/health").json() == {"status": "ok"}
    res = client.post("/analyze", files={"file": ("office.pdf", files["office.pdf"])})
    assert res.status_code == 200 and len(res.json()["rooms"]) == len(NAMES) + 1
    res = client.post("/analyze", files={"file": ("x.dwg", b"AC1032....")})
    assert res.status_code == 422 and res.json() == {"code": "dwg"}
    monkeypatch.setattr(main, "TOKEN", "secret")
    assert client.post("/analyze", files={"file": ("a.pdf", b"%PDF")}).status_code == 401
    ok = client.post("/analyze", files={"file": ("o.pdf", files["office.pdf"])}, headers={"x-internal-token": "secret"})
    assert ok.status_code == 200

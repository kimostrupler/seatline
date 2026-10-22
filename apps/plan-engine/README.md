# Plan engine

Python service that turns architect plans into a draft floor layout: the background image plus
suggested rooms (with names and types) and desks. The API calls it for **Edit layout → Floor →
Import architect plan**; people confirm the suggestions before anything is saved.

| File                         | What it gives                                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| DXF (CAD)                    | rooms (room outlines, else spaces between walls), names, desks, exact scale                        |
| PDF exported from CAD        | rooms from thick lines/filled walls, names, desks (repeated rectangles), scale from a "1:100" note |
| Scan / photo (PDF, PNG, JPG) | rooms from thick dark lines, desks from small drawn rectangles; names via OCR (below)              |
| DWG                          | not readable (proprietary): save as DXF                                                            |

Everything is in the new image's pixels (Seatline's floor coordinates); with a known scale the
image has 40 px per metre, so desks match the map's desk size.

## Run it

```bash
cd apps/plan-engine
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
pnpm --filter @seatline/plan-engine dev     # http://localhost:8000/health
pnpm --filter @seatline/plan-engine test    # pytest
```

Set `PLAN_ENGINE_URL=http://localhost:8000` in `apps/api/.env` to use it from the app.
`pnpm check` and the browser tests use `.venv` if it exists, else `python3` (CI installs the
requirements with pip).

## How it reads plans

- `app/geometry.py` — rooms from a wall mask: close door gaps (1.1 m), take the closed spaces,
  drop the outside, tiny spaces (< 4 m²) and wall cavities; outlines are simplified, near-
  rectangles become rectangles. Names = texts inside a room (areas and heights skipped); types
  from the name (Büro/Office/Bureau, Sitzung/Meeting, Küche/WC/Flur… = other) or the desk count.
- `app/dxf_import.py` — renders the drawing with ezdxf; walls from wall layers (Wand, Wall, Mur…),
  else everything except furniture/text/door layers and arcs. Desks: blocks named or layered like
  desks (Tisch, Desk, Arbeitsplatz, AP…), else any block used ≥ 4 times with a desk's size.
- `app/pdf_import.py` — renders page 1 with pdfium; vector shapes from pdfplumber; scans are
  thresholded and thin lines removed.
- `app/analyze.py` — picks the reader from the file's bytes and runs it in a separate process
  (killed after 90 s) — uploaded files are untrusted. Max 25 MB.

## Room names in scans (OCR)

`app/ocr.py` reads printed labels with Tesseract (German, French, English) on the plan engine
itself; words are joined into lines (`join_words`) and named into the room they're in, like PDF
text. Free, no keys, nothing leaves the server. Without the `tesseract` program installed
(`apt install tesseract-ocr tesseract-ocr-deu tesseract-ocr-fra`) scans come in without names.

## Samples

`samples/make_samples.py` draws a made-up 40 × 20 m office as `office.dxf`, `office-plain.dxf`
(no layer names, no units), `office.pdf` (1:100) and `office-scan.jpg`. The tests and the browser
test use them; they are also handy to try the import.

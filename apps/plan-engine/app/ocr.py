"""Printed text in scanned plans (room labels), read with Tesseract OCR on this server.

Free and local: nothing leaves the plan engine. Without the `tesseract` program installed
(e.g. a laptop without it) scans simply come in without room names.
"""

from __future__ import annotations

import csv
import functools
import io
import shutil
import subprocess

import numpy as np

from .geometry import Text, encode_png

LANGUAGES = ("deu", "fra", "eng")
MIN_CONFIDENCE = 60
TIMEOUT_S = 60


@functools.cache
def _languages() -> str | None:
    if not shutil.which("tesseract"):
        return None
    try:
        out = subprocess.run(["tesseract", "--list-langs"], capture_output=True, text=True, timeout=10).stdout
    except (OSError, subprocess.SubprocessError):
        return None
    have = [lang for lang in LANGUAGES if lang in out.split()]
    return "+".join(have) or None


def read_words(gray: np.ndarray) -> list[Text]:
    """Words with their position (pixels of `gray`); [] when OCR isn't available or fails."""
    langs = _languages()
    if not langs:
        return []
    try:
        result = subprocess.run(
            # --psm 11: sparse text — labels scattered over a drawing, not a page of prose
            ["tesseract", "stdin", "stdout", "-l", langs, "--psm", "11", "tsv"],
            input=encode_png(gray),
            capture_output=True,
            timeout=TIMEOUT_S,
        )
    except (OSError, subprocess.SubprocessError):
        return []
    words: list[Text] = []
    rows = csv.DictReader(io.StringIO(result.stdout.decode("utf-8", "replace")), delimiter="\t", quoting=csv.QUOTE_NONE)
    for row in rows:
        try:
            text = (row.get("text") or "").strip()
            if row.get("level") != "5" or float(row.get("conf") or -1) < MIN_CONFIDENCE:
                continue
            if not any(c.isalnum() for c in text):
                continue  # lines and dots taken for letters
            left, top, w, h = (int(row[k]) for k in ("left", "top", "width", "height"))
        except (KeyError, ValueError):
            continue
        words.append(Text(x=left + w / 2, y=top + h / 2, text=text, height=float(h), width=float(w)))
    return words

"""Room names in scans, read by Azure OpenAI (vision) in Switzerland North — when configured.

The room outlines stay what OpenCV found (exact); the model only reads what is written in each
room. Seatline draws a number into every room it found and asks: "what does room 3 say, and what
kind of room is it?" Without AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_DEPLOYMENT nothing is sent.

Auth: the container's managed identity (AZURE_CLIENT_ID, no key), or AZURE_OPENAI_API_KEY locally.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import re
import urllib.request

import cv2
import numpy as np

from .geometry import Room, type_from_name

log = logging.getLogger("plan-engine.ai")

API_VERSION = "2024-10-21"
MAX_SIDE_PX = 2048  # what the model sees; enough to read room labels
TIMEOUT_S = 60
TYPES = ["office", "open_space", "meeting", "other"]

PROMPT = (
    "This is an architectural floor plan. Every room found on it is outlined in red and marked "
    "with a red number in a white circle in its top-left corner. For each number, give the room's name and/or number exactly as written inside "
    "that room on the plan, in its original language and spelling (e.g. '1.04 Büro', 'Salle de "
    "conférence', 'WC'). Leave out areas (m²), heights and dimensions. If nothing is written in the "
    "room, answer an empty name — never invent one. Also classify each room: office (individual "
    "or shared office), open_space (open-plan work area), meeting (meeting or conference room), "
    "other (corridor, kitchen, WC, storage, stairs, technical, reception…)."
)

SCHEMA = {
    "name": "rooms",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "rooms": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "number": {"type": "integer"},
                        "name": {"type": "string"},
                        "type": {"type": "string", "enum": TYPES},
                    },
                    "required": ["number", "name", "type"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["rooms"],
        "additionalProperties": False,
    },
}


def configured() -> bool:
    return bool(os.environ.get("AZURE_OPENAI_ENDPOINT") and os.environ.get("AZURE_OPENAI_DEPLOYMENT"))


def name_rooms_with_ai(gray: np.ndarray, rooms: list[Room], seats_per_room: list[int]) -> bool:
    """Fills in names and types; True if the model answered. Never raises (the import goes on)."""
    if not rooms or not configured():
        return False
    try:
        answer = _ask(_numbered_image(gray, rooms))
    except Exception as error:  # network, auth, quota, bad answer: keep the rooms unnamed
        log.warning("AI room names failed: %s", error)
        return False
    for item in answer:
        i = item.get("number", 0) - 1
        if not 0 <= i < len(rooms):
            continue
        name = re.sub(r"\s+", " ", str(item.get("name", ""))).strip()[:100]
        kind = item.get("type") if item.get("type") in TYPES else "other"
        room = rooms[i]
        room.name = name
        # the name's own words win (Büro, Sitzung…), then the model; many desks = open space
        room.type = type_from_name(name) or kind
        if room.type == "office" and seats_per_room[i] >= 6:
            room.type = "open_space"
    return True


def _numbered_image(gray: np.ndarray, rooms: list[Room]) -> bytes:
    """The plan with each room outlined and numbered (red) in its top-left corner."""
    img = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
    f = min(1.0, MAX_SIDE_PX / max(gray.shape))
    if f < 1:
        img = cv2.resize(img, None, fx=f, fy=f, interpolation=cv2.INTER_AREA)
    radius = max(10, int(min(img.shape[:2]) * 0.014))
    for n, room in enumerate(rooms, 1):
        poly = np.round(np.array(room.polygon) * f).astype(np.int32)
        cv2.polylines(img, [poly], True, (40, 40, 220), 1, cv2.LINE_AA)
        x, y = _label_point(poly, img.shape[:2], radius)
        cv2.circle(img, (x, y), radius, (255, 255, 255), -1, cv2.LINE_AA)
        cv2.circle(img, (x, y), radius, (40, 40, 220), 2, cv2.LINE_AA)
        text = str(n)
        scale = radius / 14
        (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, scale, 2)
        cv2.putText(img, text, (x - tw // 2, y + th // 2), cv2.FONT_HERSHEY_SIMPLEX, scale, (40, 40, 220), 2, cv2.LINE_AA)
    ok, data = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 85])
    if not ok:
        raise RuntimeError("JPEG encoding failed")
    return data.tobytes()


def _label_point(poly: np.ndarray, shape: tuple[int, int], radius: int) -> tuple[int, int]:
    """Top-left inside the room, clear of its walls — the name is usually written in the middle."""
    mask = np.zeros(shape, np.uint8)
    cv2.fillPoly(mask, [poly], 255)
    distance = cv2.distanceTransform(mask, cv2.DIST_L2, 3)
    ys, xs = np.nonzero(distance >= 1.5 * radius)
    if len(xs) == 0:  # a small room: its most open spot
        y, x = np.unravel_index(int(np.argmax(distance)), distance.shape)
        return int(x), int(y)
    x0, y0 = poly[:, 0].min(), poly[:, 1].min()
    i = int(np.argmin((xs - x0) + (ys - y0)))
    return int(xs[i]), int(ys[i])


def _ask(jpeg: bytes) -> list[dict]:
    endpoint = os.environ["AZURE_OPENAI_ENDPOINT"].rstrip("/")
    deployment = os.environ["AZURE_OPENAI_DEPLOYMENT"]
    body = {
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": PROMPT},
                    {
                        "type": "image_url",
                        "image_url": {"url": "data:image/jpeg;base64," + base64.b64encode(jpeg).decode(), "detail": "high"},
                    },
                ],
            }
        ],
        "temperature": 0,
        "max_tokens": 4000,
        "response_format": {"type": "json_schema", "json_schema": SCHEMA},
    }
    req = urllib.request.Request(
        f"{endpoint}/openai/deployments/{deployment}/chat/completions?api-version={API_VERSION}",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", **_auth_headers()},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT_S) as res:
        answer = json.load(res)
    content = answer["choices"][0]["message"]["content"]
    rooms = json.loads(content)["rooms"]
    if not isinstance(rooms, list):
        raise ValueError("unexpected answer")
    return rooms


def _auth_headers() -> dict[str, str]:
    key = os.environ.get("AZURE_OPENAI_API_KEY")
    if key:
        return {"api-key": key}
    # Azure Container Apps managed identity (no key stored anywhere)
    url = (
        f"{os.environ['IDENTITY_ENDPOINT']}?resource=https://cognitiveservices.azure.com"
        f"&api-version=2019-08-01"
    )
    if os.environ.get("AZURE_CLIENT_ID"):
        url += f"&client_id={os.environ['AZURE_CLIENT_ID']}"
    req = urllib.request.Request(url, headers={"X-IDENTITY-HEADER": os.environ["IDENTITY_HEADER"]})
    with urllib.request.urlopen(req, timeout=10) as res:
        return {"Authorization": f"Bearer {json.load(res)['access_token']}"}

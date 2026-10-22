"""Room names in scans via (a fake) Azure OpenAI: request shape, auth, and failing quietly."""

import base64
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from app.analyze import analyze

from .test_engine import samples

calls: list[dict] = []
reply: dict = {"status": 200, "rooms": []}


class Fake(BaseHTTPRequestHandler):
    def log_message(self, *args):  # quiet
        pass

    def _send(self, status: int, body: dict):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):  # managed identity token endpoint
        calls.append({"path": self.path, "headers": {k.lower(): v for k, v in self.headers.items()}})
        self._send(200, {"access_token": "mi-token"})

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["content-length"])))
        calls.append({"path": self.path, "headers": {k.lower(): v for k, v in self.headers.items()}, "body": body})
        if reply["status"] != 200:
            return self._send(reply["status"], {"error": {"message": "nope"}})
        content = json.dumps({"rooms": reply["rooms"]})
        self._send(200, {"choices": [{"message": {"content": content}}]})


@pytest.fixture(scope="module")
def server():
    httpd = HTTPServer(("127.0.0.1", 0), Fake)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{httpd.server_port}"
    httpd.shutdown()


@pytest.fixture(scope="module")
def scan(tmp_path_factory):
    path = tmp_path_factory.mktemp("ai") / "scan.png"
    samples.make_scan(path)
    return path.read_bytes()


@pytest.fixture(autouse=True)
def env(monkeypatch, server):
    calls.clear()
    reply.update(status=200, rooms=[])
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", server + "/")
    monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT", "plans")
    monkeypatch.setenv("AZURE_OPENAI_API_KEY", "test-key")
    monkeypatch.delenv("NO_PROXY", raising=False)
    monkeypatch.setenv("no_proxy", "127.0.0.1")


def test_names_and_types_come_from_the_model(scan):
    reply["rooms"] = [
        {"number": 1, "name": "1.03  Sitzungszimmer", "type": "office"},  # the name's word wins
        {"number": 2, "name": "Lager", "type": "office"},
        {"number": 3, "name": "", "type": "open_space"},
        {"number": 99, "name": "nowhere", "type": "other"},  # ignored
    ]
    d = analyze(scan)
    assert "ai_names" in d.warnings
    assert [(r.name, r.type) for r in d.rooms[:3]] == [
        ("1.03 Sitzungszimmer", "meeting"),
        ("Lager", "other"),
        ("", "open_space"),
    ]
    [call] = calls
    assert call["path"] == "/openai/deployments/plans/chat/completions?api-version=2024-10-21"
    assert call["headers"]["api-key"] == "test-key"
    body = call["body"]
    assert body["response_format"]["json_schema"]["strict"] is True
    image = body["messages"][0]["content"][1]["image_url"]["url"]
    assert image.startswith("data:image/jpeg;base64,")
    assert len(base64.b64decode(image.split(",", 1)[1])) > 10_000  # the numbered plan


def test_managed_identity_instead_of_a_key(scan, monkeypatch, server):
    monkeypatch.delenv("AZURE_OPENAI_API_KEY")
    monkeypatch.setenv("IDENTITY_ENDPOINT", server + "/msi/token")
    monkeypatch.setenv("IDENTITY_HEADER", "secret-header")
    monkeypatch.setenv("AZURE_CLIENT_ID", "client-1")
    reply["rooms"] = [{"number": 1, "name": "Büro", "type": "office"}]
    analyze(scan)
    token, chat = calls
    assert token["path"].startswith("/msi/token?resource=https://cognitiveservices.azure.com")
    assert "client_id=client-1" in token["path"]
    assert token["headers"]["x-identity-header"] == "secret-header"
    assert chat["headers"]["authorization"] == "Bearer mi-token"


def test_a_failing_model_keeps_the_rooms_unnamed(scan):
    reply["status"] = 429
    d = analyze(scan)
    assert "ai_failed" in d.warnings and len(d.rooms) == len(samples.ROOMS) + 1
    assert all(r.name == "" for r in d.rooms)


def test_nothing_is_sent_without_configuration(scan, monkeypatch):
    monkeypatch.delenv("AZURE_OPENAI_ENDPOINT")
    d = analyze(scan)
    assert calls == [] and not {"ai_names", "ai_failed"} & set(d.warnings)


def test_vector_plans_never_go_to_the_model(tmp_path):
    samples.make_pdf(tmp_path / "o.pdf")
    analyze((tmp_path / "o.pdf").read_bytes())
    assert calls == []

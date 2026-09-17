import hmac
import json
import os
import re
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from uuid import uuid4

from backend.domain import LANGUAGES, ValidationError, validate_review, validate_run
from backend.runner import availability, evaluate
from backend.storage import ReviewConflict, Store

RUN_PATH = re.compile(r"^/api/runs/([a-f0-9]{32})(/review)?$")
BODY_LIMIT = 32_768


def make_server(host, port, db_path, token, read_only_token=""):
    if len(token) < 24:
        raise ValueError("WORKBENCH_TOKEN must have at least 24 characters")
    if read_only_token and (len(read_only_token) < 24 or read_only_token == token):
        raise ValueError("READ_ONLY_TOKEN must be distinct and have at least 24 characters")
    store = Store(db_path)
    slots = threading.BoundedSemaphore(2)

    class Handler(BaseHTTPRequestHandler):
        server_version = "Workbench"

        def setup(self):
            super().setup()
            self.connection.settimeout(10)

        def log_message(self, *_):
            pass  # Do not log access tokens or review text.

        def send_json(self, status, payload):
            # Drain a bounded rejected request before closing so clients receive the
            # JSON error instead of a connection reset while still sending its body.
            if not self.body_consumed:
                try:
                    length = int(self.headers.get("Content-Length", "0"))
                except ValueError:
                    length = 0
                if 0 < length <= BODY_LIMIT:
                    self.rfile.read(length)
                self.body_consumed = True
            body = json.dumps(payload, ensure_ascii=True, allow_nan=False).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Request-ID", self.request_id)
            self.end_headers()
            self.wfile.write(body)
            print(
                json.dumps(
                    {
                        "event": "request",
                        "request_id": self.request_id,
                        "method": self.command,
                        "route": "/api/runs/:id"
                        if RUN_PATH.fullmatch(self.path)
                        else self.path
                        if self.path in ("/api/health", "/api/catalog", "/api/runs")
                        else "unknown",
                        "status": status,
                        "duration_ms": round((time.perf_counter() - self.started) * 1000, 2),
                    }
                ),
                flush=True,
            )

        def read_json(self):
            if self.headers.get("Transfer-Encoding"):
                raise ValidationError("Chunked request bodies are not supported")
            if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                raise ValidationError("Content-Type must be application/json")
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError as exc:
                raise ValidationError("Invalid content length") from exc
            if not 0 < length <= BODY_LIMIT:
                raise ValidationError("Request body must contain 1 to 32768 bytes")
            try:
                raw = self.rfile.read(length)
                self.body_consumed = True
                return json.loads(
                    raw,
                    parse_constant=lambda _: (_ for _ in ()).throw(ValueError()),
                )
            except (ValueError, UnicodeDecodeError) as exc:
                raise ValidationError("Malformed JSON") from exc

        def dispatch(self):
            if self.command == "GET" and self.path == "/api/health":
                return self.send_json(200, {"status": "ok"})
            auth = self.headers.get("Authorization", "")
            operator = hmac.compare_digest(auth.encode(), ("Bearer " + token).encode())
            viewer = bool(read_only_token) and hmac.compare_digest(
                auth.encode(), ("Bearer " + read_only_token).encode()
            )
            if not operator and not viewer:
                return self.send_json(401, {"error": "A valid access token is required"})
            if viewer and self.command != "GET":
                return self.send_json(403, {"error": "This access token is read-only"})
            if self.command == "GET" and self.path == "/api/catalog":
                return self.send_json(
                    200,
                    {
                        "role": "operator" if operator else "viewer",
                        "implementations": [
                            {
                                "id": lang,
                                "available": availability(lang),
                                "mutant": lang.endswith("-mutant"),
                            }
                            for lang in LANGUAGES
                        ],
                    },
                )
            if self.path == "/api/runs":
                if self.command == "GET":
                    return self.send_json(200, {"runs": store.list()})
                if self.command == "POST":
                    languages, suite, cases = validate_run(self.read_json())
                    if not slots.acquire(blocking=False):
                        return self.send_json(
                            429,
                            {"error": "Two evaluations are already running; retry shortly"},
                        )
                    try:
                        run = {
                            "id": uuid4().hex,
                            "created_at": datetime.now(timezone.utc).isoformat(),
                            "suite": suite,
                            "results": [evaluate(lang, cases) for lang in languages],
                        }
                        return self.send_json(201, store.add(run))
                    finally:
                        slots.release()
            match = RUN_PATH.fullmatch(self.path)
            if match:
                run_id, review_path = match.groups()
                if self.command == "GET" and not review_path:
                    run = store.get(run_id)
                elif self.command == "PATCH" and review_path:
                    verdict, note, version = validate_review(self.read_json())
                    run = store.review(run_id, verdict, note, version)
                else:
                    return self.send_json(405, {"error": "Method not allowed"})
                return (
                    self.send_json(200, run)
                    if run
                    else self.send_json(404, {"error": "Run not found"})
                )
            self.send_json(404, {"error": "Route not found"})

        def handle_request(self):
            self.body_consumed = False
            self.request_id = uuid4().hex
            self.started = time.perf_counter()
            try:
                self.dispatch()
            except ValidationError as exc:
                self.send_json(400, {"error": str(exc)})
            except ReviewConflict as exc:
                self.send_json(409, {"error": str(exc)})
            except (BrokenPipeError, ConnectionResetError, TimeoutError):
                pass
            except Exception:
                self.send_json(500, {"error": "Internal server error"})

        do_GET = do_POST = do_PATCH = do_DELETE = handle_request

    return ThreadingHTTPServer((host, port), Handler)


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    server = make_server(
        os.getenv("API_HOST", "127.0.0.1"),
        int(os.getenv("API_PORT", "8011")),
        os.getenv("DB_PATH", str(root / ".data/workbench.sqlite")),
        os.getenv("WORKBENCH_TOKEN", ""),
        os.getenv("READ_ONLY_TOKEN", ""),
    )
    print("Evaluation API ready", flush=True)
    server.serve_forever()

import concurrent.futures
import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from unittest.mock import patch

from backend.server import make_server
from backend.storage import Store

TOKEN = "test-only-token-not-for-deployment"
VIEWER_TOKEN = "test-only-read-access-not-for-deployment"


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.path = Path(self.directory.name) / "test.sqlite"
        self.server = make_server("127.0.0.1", 0, self.path, TOKEN, VIEWER_TOKEN)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.directory.cleanup()

    def call(self, path, method="GET", payload=None, token=TOKEN):
        headers = {
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
        }
        req = urllib.request.Request(
            self.url + path,
            data=json.dumps(payload).encode() if payload is not None else None,
            headers=headers,
            method=method,
        )
        # Ignore environment proxies for loopback integration tests.
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        try:
            response = opener.open(req, timeout=10)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            return response.status, json.loads(response.read())

    def test_access_control(self):
        self.assertEqual(self.call("/api/health", token="")[0], 200)
        for path in ["/api/catalog", "/api/runs"]:
            self.assertEqual(self.call(path, token="wrong")[0], 401)
        self.assertEqual(self.call("/api/catalog")[0], 200)

    def test_viewer_can_read_but_cannot_write(self):
        self.assertEqual(self.call("/api/catalog", token=VIEWER_TOKEN)[1]["role"], "viewer")
        self.assertEqual(self.call("/api/runs", token=VIEWER_TOKEN)[0], 200)
        self.assertEqual(
            self.call("/api/runs", "POST", {"languages": ["python"]}, token=VIEWER_TOKEN)[0], 403
        )
        self.assertEqual(
            self.call(
                "/api/runs/" + "0" * 32 + "/review",
                "PATCH",
                {"version": 0, "verdict": "approved", "note": "x"},
                token=VIEWER_TOKEN,
            )[0],
            403,
        )

    def test_stale_review_is_rejected_and_history_is_retained(self):
        _, run = self.call("/api/runs", "POST", {"languages": ["python"]})
        path = "/api/runs/" + run["id"] + "/review"
        status, first = self.call(
            path, "PATCH", {"version": 0, "verdict": "approved", "note": "First review"}
        )
        self.assertEqual(status, 200)
        self.assertEqual(first["version"], 1)
        self.assertEqual(
            self.call(
                path, "PATCH", {"version": 0, "verdict": "needs-work", "note": "Stale review"}
            )[0],
            409,
        )
        status, second = self.call(
            path, "PATCH", {"version": 1, "verdict": "needs-work", "note": "New evidence"}
        )
        self.assertEqual(status, 200)
        self.assertEqual(second["version"], 2)
        self.assertEqual(
            [review["note"] for review in second["reviews"]], ["New evidence", "First review"]
        )

    def test_run_review_and_persistence(self):
        status, run = self.call(
            "/api/runs", "POST", {"languages": ["python"], "suite": "regression"}
        )
        self.assertEqual(status, 201)
        self.assertEqual(run["results"][0]["passed"], 49)
        self.assertEqual(run["results"][0]["status"], "passed")
        status, result = self.call(
            "/api/runs/" + run["id"] + "/review",
            "PATCH",
            {
                "version": 0,
                "verdict": "approved",
                "note": "Checked boundaries; '); DROP TABLE runs; --",
            },
        )
        self.assertEqual(status, 200)
        self.assertEqual(Store(self.path).get(run["id"])["note"], result["note"])
        self.assertEqual(self.call("/api/runs/" + run["id"])[1]["verdict"], "approved")
        self.assertEqual(len(self.call("/api/runs")[1]["runs"]), 1)
        self.assertNotIn("cases", self.call("/api/runs")[1]["runs"][0]["results"][0])

    def test_validation_and_not_found(self):
        self.assertEqual(self.call("/api/runs", "POST", {"languages": ["../../bin/sh"]})[0], 400)
        self.assertEqual(
            self.call(
                "/api/runs",
                "POST",
                {"languages": ["python"], "suite": "custom", "intervals": [[True, 2]]},
            )[0],
            400,
        )
        self.assertEqual(self.call("/api/runs/" + "0" * 32)[0], 404)
        self.assertEqual(
            self.call(
                "/api/runs/" + "0" * 32 + "/review",
                "PATCH",
                {"version": 0, "verdict": "approved", "note": "checked"},
            )[0],
            404,
        )
        self.assertEqual(self.call("/api/runs", "POST", {"padding": "x" * 33000})[0], 400)

    def test_concurrent_writes_preserve_both_records(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results = list(
                pool.map(
                    lambda _: self.call(
                        "/api/runs",
                        "POST",
                        {"languages": ["python"], "suite": "boundaries"},
                    ),
                    range(2),
                )
            )
        self.assertEqual([r[0] for r in results], [201, 201])
        self.assertEqual(len(self.call("/api/runs")[1]["runs"]), 2)

    def test_evaluation_capacity_returns_retryable_response(self):
        both_started = threading.Event()
        release = threading.Event()
        lock = threading.Lock()
        started = 0

        def slow_evaluation(language, cases):
            nonlocal started
            with lock:
                started += 1
                if started == 2:
                    both_started.set()
            release.wait(5)
            return {
                "language": language,
                "status": "passed",
                "passed": len(cases),
                "total": len(cases),
                "duration_ms": 1,
                "cases": [],
            }

        with patch("backend.server.evaluate", side_effect=slow_evaluation):
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                futures = [
                    pool.submit(self.call, "/api/runs", "POST", {"languages": ["python"]})
                    for _ in range(2)
                ]
                try:
                    self.assertTrue(both_started.wait(3))
                    self.assertEqual(
                        self.call("/api/runs", "POST", {"languages": ["python"]})[0], 429
                    )
                finally:
                    release.set()
                self.assertEqual([future.result()[0] for future in futures], [201, 201])

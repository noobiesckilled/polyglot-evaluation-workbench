import os
import subprocess
import sys
import unittest
from unittest.mock import patch

from backend.domain import fixtures
from backend.runner import availability, evaluate


class RunnerTests(unittest.TestCase):
    @patch("backend.runner.commands")
    def test_real_process_is_terminated_at_deadline(self, commands):
        commands.return_value = {"python": [sys.executable, "-c", "import time; time.sleep(2)"]}
        self.assertEqual(
            evaluate("python", fixtures("boundaries"), timeout=0.05)["status"], "timeout"
        )

    def test_all_installed_workers_match_oracle(self):
        for language in ("python", "javascript", "java", "go", "rust"):
            with self.subTest(language=language):
                if not availability(language):
                    if os.getenv("REQUIRE_ALL_WORKERS") == "1":
                        self.fail(language + " is missing")
                    continue
                result = evaluate(language, fixtures("regression"))
                self.assertEqual(result["status"], "passed", result)
                self.assertEqual(result["passed"], 49)

    def test_boundary_mutant_is_detected(self):
        if not availability("javascript-mutant"):
            self.skipTest("Node is not installed")
        result = evaluate("javascript-mutant", fixtures("boundaries"))
        self.assertEqual(result["status"], "failed")
        self.assertFalse(
            next(c for c in result["cases"] if c["name"] == "touching boundaries")["passed"]
        )

    @patch(
        "backend.runner.subprocess.run",
        side_effect=subprocess.TimeoutExpired("worker", 5),
    )
    def test_timeout_is_not_a_pass(self, _):
        self.assertEqual(evaluate("python", fixtures("boundaries"))["status"], "timeout")

    @patch("backend.runner.subprocess.run")
    def test_boolean_output_does_not_pass_as_integer(self, run):
        run.return_value = subprocess.CompletedProcess([], 0, "[[true,3]]\n", "")
        result = evaluate("python", fixtures("custom", [[1, 3]]))
        self.assertEqual(result["status"], "failed")

    @patch("backend.runner.subprocess.run")
    def test_malformed_worker_output_is_an_error(self, run):
        run.return_value = subprocess.CompletedProcess([], 0, "not json\n", "")
        self.assertEqual(evaluate("python", fixtures("custom", []))["status"], "error")

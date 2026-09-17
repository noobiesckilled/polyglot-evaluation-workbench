"""Execute only checked-in, allowlisted workers. This is not an arbitrary code sandbox."""

import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def commands():
    suffix = ".exe" if os.name == "nt" else ""
    return {
        "python": [sys.executable, str(ROOT / "workers/python/worker.py")],
        "javascript": [
            shutil.which("node") or "node",
            str(ROOT / "workers/javascript/worker.mjs"),
        ],
        "javascript-mutant": [
            shutil.which("node") or "node",
            str(ROOT / "workers/javascript/worker.mjs"),
            "--mutant",
        ],
        "java": [
            shutil.which("java") or "java",
            "-cp",
            str(ROOT / ".build/java"),
            "Worker",
        ],
        "go": [str(ROOT / ".build" / ("go-worker" + suffix))],
        "rust": [str(ROOT / ".build" / ("rust-worker" + suffix))],
    }


def availability(language):
    command = commands()[language]
    available = Path(command[0]).is_file() or shutil.which(command[0]) is not None
    if language == "java":
        available = available and (ROOT / ".build/java/Worker.class").is_file()
    return bool(available)


def evaluate(language, cases, timeout=5):
    result = {
        "language": language,
        "status": "unavailable",
        "duration_ms": None,
        "passed": 0,
        "total": len(cases),
        "cases": [],
    }
    if not availability(language):
        result["error"] = "Runtime or compiled worker is missing. Run the worker build first."
        return result
    payload = "".join(
        " ".join([str(len(c["input"]))] + [str(n) for pair in c["input"] for n in pair]) + "\n"
        for c in cases
    )
    started = time.perf_counter()
    try:
        worker_env = {
            key: value
            for key, value in os.environ.items()
            if key.upper() in {"PATH", "SYSTEMROOT", "TEMP", "TMP", "LANG"}
        }
        process = subprocess.run(
            commands()[language],
            input=payload,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=ROOT,
            env=worker_env,
            check=False,
        )
        result["duration_ms"] = round((time.perf_counter() - started) * 1000, 2)
        if process.returncode != 0:
            result.update(status="error", error="Worker exited unsuccessfully")
            return result
        lines = process.stdout.splitlines()
        if len(lines) != len(cases) or len(process.stdout) > 200_000:
            raise ValueError("Worker output does not match the result contract")
        for case, line in zip(cases, lines, strict=True):
            actual = json.loads(line, parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
            # Strict shape/type comparison rejects booleans and malformed worker output.
            valid = isinstance(actual, list) and all(
                isinstance(pair, list) and len(pair) == 2 and all(type(n) is int for n in pair)
                for pair in actual
            )
            passed = valid and actual == case["expected"]
            result["cases"].append({**case, "actual": actual, "passed": passed})
            result["passed"] += int(passed)
        result["status"] = "passed" if result["passed"] == result["total"] else "failed"
    except subprocess.TimeoutExpired:
        result.update(status="timeout", error="Worker exceeded the five-second execution limit")
    except (ValueError, OSError):
        result.update(status="error", error="Worker produced invalid output or could not execute")
    return result

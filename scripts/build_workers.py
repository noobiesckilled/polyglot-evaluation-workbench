"""Build installed native runtimes; --strict fails if any required compiler is missing."""

import argparse
import os
import shutil
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
build = root / ".build"
build.mkdir(exist_ok=True)
(build / "java").mkdir(exist_ok=True)
suffix = ".exe" if os.name == "nt" else ""
parser = argparse.ArgumentParser()
parser.add_argument("--strict", action="store_true")
args = parser.parse_args()
missing = []
for name, command, cwd in [
    (
        "javac",
        [
            "javac",
            "-d",
            str(build / "java"),
            str(root / "workers/java/Worker.java"),
            str(root / "workers/java/WorkerTest.java"),
        ],
        root,
    ),
    (
        "go",
        ["go", "build", "-o", str(build / ("go-worker" + suffix)), "."],
        root / "workers/go",
    ),
    ("cargo", ["cargo", "build", "--release"], root / "workers/rust"),
]:
    if not shutil.which(name):
        print(f"{name}: unavailable")
        missing.append(name)
        continue
    subprocess.run(command, cwd=cwd, check=True)
    if name == "cargo":
        shutil.copy2(
            root / "workers/rust/target/release" / ("interval-worker" + suffix),
            build / ("rust-worker" + suffix),
        )
if missing and args.strict:
    raise SystemExit("Missing compilers: " + ", ".join(missing))

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path


class ReviewConflict(Exception):
    pass


class Store:
    def __init__(self, path):
        self.path = str(path)
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as connection:
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute(
                "CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, payload TEXT NOT NULL, verdict TEXT NOT NULL DEFAULT 'unreviewed', note TEXT NOT NULL DEFAULT '')"
            )
            columns = {row["name"] for row in connection.execute("PRAGMA table_info(runs)")}
            if "version" not in columns:
                connection.execute("ALTER TABLE runs ADD COLUMN version INTEGER NOT NULL DEFAULT 0")
            connection.execute(
                "CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, version INTEGER NOT NULL, verdict TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(run_id, version))"
            )

    @contextmanager
    def connect(self):
        connection = sqlite3.connect(self.path, timeout=5)
        connection.row_factory = sqlite3.Row
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def add(self, run):
        with self.connect() as connection:
            connection.execute(
                "INSERT INTO runs(id, created_at, payload) VALUES (?, ?, ?)",
                (run["id"], run["created_at"], json.dumps(run)),
            )
        return self.get(run["id"])

    def unpack(self, row):
        return {
            **json.loads(row["payload"]),
            "verdict": row["verdict"],
            "note": row["note"],
            "version": row["version"],
        }

    def get(self, run_id):
        with self.connect() as connection:
            row = connection.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
            reviews = connection.execute(
                "SELECT version, verdict, note, created_at FROM reviews WHERE run_id = ? ORDER BY version DESC LIMIT 50",
                (run_id,),
            ).fetchall()
        return (
            {**self.unpack(row), "reviews": [dict(review) for review in reviews]} if row else None
        )

    def list(self):
        with self.connect() as connection:
            rows = connection.execute(
                "SELECT * FROM runs ORDER BY created_at DESC, id DESC LIMIT 50"
            ).fetchall()
        result = []
        for row in rows:
            run = self.unpack(row)
            run["results"] = [{k: v for k, v in r.items() if k != "cases"} for r in run["results"]]
            result.append(run)
        return result

    def review(self, run_id, verdict, note, version):
        with self.connect() as connection:
            changed = connection.execute(
                "UPDATE runs SET verdict = ?, note = ?, version = version + 1 WHERE id = ? AND version = ?",
                (verdict, note, run_id, version),
            ).rowcount
            if changed:
                connection.execute(
                    "INSERT INTO reviews(run_id, version, verdict, note, created_at) VALUES (?, ?, ?, ?, ?)",
                    (
                        run_id,
                        version + 1,
                        verdict,
                        note,
                        datetime.now(timezone.utc).isoformat(),
                    ),
                )
            elif connection.execute("SELECT 1 FROM runs WHERE id = ?", (run_id,)).fetchone():
                raise ReviewConflict(
                    "This review changed in another session. Reopen the run before saving again."
                )
        return self.get(run_id) if changed else None

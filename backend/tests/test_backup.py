import tempfile
import unittest
from pathlib import Path

from backend.storage import Store
from scripts.backup import backup


class BackupTests(unittest.TestCase):
    def test_backup_restores_runs_and_reviews(self):
        with tempfile.TemporaryDirectory() as directory:
            source, target = (
                Path(directory) / "source.sqlite",
                Path(directory) / "backup.sqlite",
            )
            original = Store(source)
            original.add(
                {
                    "id": "a" * 32,
                    "created_at": "2026-09-17",
                    "suite": "boundaries",
                    "results": [],
                }
            )
            original.review("a" * 32, "approved", "Verified boundaries", 0)
            backup(source, target)
            restored = Store(target)
            self.assertEqual(restored.get("a" * 32)["note"], "Verified boundaries")
            self.assertEqual(restored.get("a" * 32)["verdict"], "approved")
            with self.assertRaises(ValueError):
                backup(source, target)

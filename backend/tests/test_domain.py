import unittest

from backend.domain import (
    ValidationError,
    fixtures,
    oracle,
    validate_review,
    validate_run,
)
from workers.python.worker import merge, parse


class DomainTests(unittest.TestCase):
    def test_worker_protocol_rejects_non_decimal_and_empty_input(self):
        for value in ["", "1 1e2 200", "1 1_000 2000", "1 0xff 300"]:
            with self.assertRaises(ValueError):
                parse(value)

    def test_oracle_matches_independent_golden_cases(self):
        self.assertEqual(oracle([[6, 8], [1, 3], [3, 6]]), [[1, 8]])
        self.assertEqual(oracle([[4, 5], [-3, -1]]), [[-3, -1], [4, 5]])

    def test_seeded_cases_are_reproducible_and_cover_python(self):
        cases = fixtures("regression")
        self.assertEqual(cases, fixtures("regression"))
        self.assertEqual(len(cases), 49)
        for case in cases:
            original = [p[:] for p in case["input"]]
            self.assertEqual(merge(case["input"]), case["expected"])
            self.assertEqual(case["input"], original)

    def test_invalid_requests_are_rejected(self):
        for payload in [
            [],
            {},
            {"languages": ["bash"]},
            {"languages": ["python", "python"]},
            {"languages": ["python"], "suite": []},
            {"languages": ["python"], "shell": "x"},
        ]:
            with self.subTest(payload=payload), self.assertRaises(ValidationError):
                validate_run(payload)

    def test_invalid_custom_intervals_are_rejected(self):
        for pairs in [
            None,
            [[True, 2]],
            [[1.2, 3]],
            [[5, 1]],
            [[0, 1000001]],
            [[0]],
            [[0, 1]] * 129,
        ]:
            with self.subTest(pairs=pairs), self.assertRaises(ValidationError):
                validate_run({"languages": ["python"], "suite": "custom", "intervals": pairs})

    def test_review_requires_explanation(self):
        self.assertEqual(
            validate_review({"version": 0, "verdict": "approved", "note": " looks good "}),
            ("approved", "looks good", 0),
        )
        for payload in [
            {"version": 0, "verdict": "approved", "note": " "},
            {"version": 0, "verdict": "bad", "note": "x"},
            {"version": 0, "verdict": [], "note": "x"},
            {"version": 0, "verdict": "unreviewed", "note": "x" * 2001},
        ]:
            with self.assertRaises(ValidationError):
                validate_review(payload)

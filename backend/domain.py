"""Protected fixtures and request validation, independent of candidate workers."""

import random

LANGUAGES = ("python", "javascript", "java", "go", "rust", "javascript-mutant")
MAX_VALUE = 1_000_000


class ValidationError(ValueError):
    pass


def validate_intervals(value):
    if not isinstance(value, list) or len(value) > 128:
        raise ValidationError("intervals must be an array containing at most 128 pairs")
    for pair in value:
        if not isinstance(pair, list) or len(pair) != 2:
            raise ValidationError("Each interval must contain exactly two integers")
        if any(type(n) is not int or abs(n) > MAX_VALUE for n in pair):
            raise ValidationError("Endpoints must be integers between -1000000 and 1000000")
        if pair[0] > pair[1]:
            raise ValidationError("Interval start must not exceed end")
    return value


def oracle(intervals):
    """Independent O(n^2) connected-component oracle, not the workers' sort/sweep."""
    groups = [list(pair) for pair in intervals]
    changed = True
    while changed:
        changed = False
        for i in range(len(groups)):
            for j in range(i + 1, len(groups)):
                a, b = groups[i], groups[j]
                if max(a[0], b[0]) <= min(a[1], b[1]):
                    groups[i] = [min(a[0], b[0]), max(a[1], b[1])]
                    groups.pop(j)
                    changed = True
                    break
            if changed:
                break
    return sorted(groups)


def fixtures(suite, custom=None):
    values = [
        ("empty", []),
        ("single point", [[0, 0]]),
        ("touching boundaries", [[1, 3], [3, 5]]),
        ("nested intervals", [[1, 10], [2, 3], [4, 9]]),
        ("unsorted disjoint", [[8, 9], [1, 2], [4, 5]]),
        ("duplicate points", [[2, 2], [2, 2]]),
        ("negative endpoints", [[-5, -1], [-3, 2]]),
        ("transitive chain", [[6, 8], [1, 3], [3, 6]]),
        ("numeric bounds", [[-MAX_VALUE, -MAX_VALUE], [MAX_VALUE, MAX_VALUE]]),
    ]
    if suite == "regression":
        rng = random.Random(2026)
        for i in range(40):
            pairs = [
                sorted([rng.randint(-30, 30), rng.randint(-30, 30)])
                for _ in range(rng.randint(0, 16))
            ]
            values.append((f"seeded case {i + 1:02d}", pairs))
    elif suite == "custom":
        values = [("custom input", validate_intervals(custom))]
    elif suite != "boundaries":
        raise ValidationError("Unknown test suite")
    return [{"name": name, "input": value, "expected": oracle(value)} for name, value in values]


def validate_run(payload):
    if not isinstance(payload, dict) or set(payload) - {
        "languages",
        "suite",
        "intervals",
    }:
        raise ValidationError("Expected languages, suite, and optional intervals")
    languages = payload.get("languages")
    if not isinstance(languages, list) or not languages or len(languages) > len(LANGUAGES):
        raise ValidationError("Choose between one and six implementations")
    if any(not isinstance(x, str) or x not in LANGUAGES for x in languages) or len(
        set(languages)
    ) != len(languages):
        raise ValidationError("Implementations must be unique supported names")
    suite = payload.get("suite", "boundaries")
    return languages, suite, fixtures(suite, payload.get("intervals"))


def validate_review(payload):
    if not isinstance(payload, dict) or set(payload) != {"verdict", "note", "version"}:
        raise ValidationError("Expected verdict, note, and version")
    verdict, note = payload["verdict"], payload["note"]
    if verdict not in ("approved", "needs-work", "unreviewed"):
        raise ValidationError("Unknown review verdict")
    if not isinstance(note, str) or len(note) > 2000:
        raise ValidationError("Review note must be text of at most 2000 characters")
    if verdict != "unreviewed" and not note.strip():
        raise ValidationError("Add a reason for the review verdict")
    if type(payload["version"]) is not int or payload["version"] < 0:
        raise ValidationError("Review version must be a non-negative integer")
    return verdict, note.strip(), payload["version"]

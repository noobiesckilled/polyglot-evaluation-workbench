import json
import re
import sys


def merge(intervals):
    result = []
    for start, end in sorted(intervals):
        if result and start <= result[-1][1]:
            result[-1][1] = max(result[-1][1], end)
        else:
            result.append([start, end])
    return result


def parse(line):
    parts = line.split()
    if any(not re.fullmatch(r"[+-]?[0-9]+", value) for value in parts):
        raise ValueError("Invalid integer")
    values = [int(value) for value in parts]
    if not values or not 0 <= values[0] <= 128 or len(values) != 1 + 2 * values[0]:
        raise ValueError("Invalid interval count")
    pairs = [values[i : i + 2] for i in range(1, len(values), 2)]
    if any(a > b or abs(a) > 1_000_000 or abs(b) > 1_000_000 for a, b in pairs):
        raise ValueError("Invalid interval")
    return pairs


if __name__ == "__main__":
    for line in sys.stdin:
        print(json.dumps(merge(parse(line)), separators=(",", ":")))

import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

export function merge(intervals, mutant = false) {
  const result = [];
  for (const [start, end] of [...intervals].sort(
    (a, b) => a[0] - b[0] || a[1] - b[1],
  )) {
    const last = result.at(-1);
    // The deliberate mutant demonstrates whether the evaluator catches boundary bugs.
    if (last && (mutant ? start < last[1] : start <= last[1]))
      last[1] = Math.max(last[1], end);
    else result.push([start, end]);
  }
  return result;
}

export function parse(line) {
  const parts = line.trim().split(/\s+/);
  if (parts.some((part) => !/^[+-]?[0-9]+$/.test(part)))
    throw new Error("Invalid integer");
  const values = parts.map(Number);
  const [count] = values;
  if (
    values.some((n) => !Number.isInteger(n)) ||
    count < 0 ||
    count > 128 ||
    values.length !== 1 + 2 * count
  )
    throw new Error("Invalid interval count");
  const pairs = [];
  for (let i = 1; i < values.length; i += 2) {
    const [a, b] = values.slice(i, i + 2);
    if (a > b || Math.abs(a) > 1_000_000 || Math.abs(b) > 1_000_000)
      throw new Error("Invalid interval");
    pairs.push([a, b]);
  }
  return pairs;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines)
    console.log(
      JSON.stringify(merge(parse(line), process.argv.includes("--mutant"))),
    );
}

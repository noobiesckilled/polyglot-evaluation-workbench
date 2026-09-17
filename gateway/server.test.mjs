import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGateway } from "./server.mjs";
import { merge, parse } from "../workers/javascript/worker.mjs";

test("Gateway rate limiting bounds requests per client and preserves health access", async () => {
  const backend = http.createServer((_, response) => response.end("{}"));
  await new Promise((done) => backend.listen(0, "127.0.0.1", done));
  const gateway = createGateway({
    backend: `http://127.0.0.1:${backend.address().port}`,
    rateLimit: 2,
  });
  await new Promise((done) => gateway.listen(0, "127.0.0.1", done));
  const base = `http://127.0.0.1:${gateway.address().port}`;
  try {
    assert.equal((await fetch(base + "/api/catalog")).status, 200);
    assert.equal((await fetch(base + "/api/catalog")).status, 200);
    const limited = await fetch(base + "/api/catalog");
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get("Retry-After")) > 0);
    assert.equal((await fetch(base + "/api/health")).status, 200);
  } finally {
    await Promise.all([
      new Promise((done) => gateway.close(done)),
      new Promise((done) => backend.close(done)),
    ]);
  }
});

test("JavaScript merges closed boundaries without modifying input", () => {
  const input = [
    [3, 5],
    [1, 3],
    [9, 9],
  ];
  assert.deepEqual(merge(input), [
    [1, 5],
    [9, 9],
  ]);
  assert.deepEqual(input, [
    [3, 5],
    [1, 3],
    [9, 9],
  ]);
  assert.deepEqual(merge([]), []);
  assert.notDeepEqual(merge(input, true), merge(input));
  for (const value of [
    "",
    "1 1e2 200",
    "1 0xff 300",
    "-1",
    "2 1 3",
    "1 5 1",
    "1 -1000001 0",
  ])
    assert.throws(() => parse(value));
});

test("Gateway proxies requests and enforces origin, size and route boundaries", async () => {
  const dist = await mkdtemp(join(tmpdir(), "workbench-"));
  await writeFile(join(dist, "index.html"), "<h1>Workbench</h1>");
  const backend = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ path: req.url, auth: req.headers.authorization }));
  });
  await new Promise((done) => backend.listen(0, "127.0.0.1", done));
  const gateway = createGateway({
    dist,
    backend: `http://127.0.0.1:${backend.address().port}`,
  });
  await new Promise((done) => gateway.listen(0, "127.0.0.1", done));
  const base = `http://127.0.0.1:${gateway.address().port}`;
  try {
    const page = await fetch(base);
    assert.equal(page.status, 200);
    assert.match(
      page.headers.get("Content-Security-Policy"),
      /frame-ancestors 'none'/,
    );
    const api = await fetch(base + "/api/catalog", {
      headers: { Authorization: "Bearer test-token" },
    });
    assert.deepEqual(await api.json(), {
      path: "/api/catalog",
      auth: "Bearer test-token",
    });
    assert.equal(
      (
        await fetch(base + "/api/runs", {
          headers: { Origin: "https://evil.example" },
        })
      ).status,
      403,
    );
    assert.equal(
      (await fetch(base + "/api/runs?redirect=https://evil.example")).status,
      404,
    );
    assert.equal(
      (await fetch(base + "/api/runs", { method: "DELETE" })).status,
      405,
    );
    assert.equal(
      (
        await fetch(base + "/api/runs", {
          method: "POST",
          body: "x".repeat(33000),
        })
      ).status,
      413,
    );
    assert.equal((await fetch(base + "/missing.txt")).status, 404);
    assert.equal((await fetch(base + "/%2e%2e%5c.env")).status, 403);
  } finally {
    await Promise.all([
      new Promise((done) => gateway.close(done)),
      new Promise((done) => backend.close(done)),
    ]);
    await rm(dist, { recursive: true, force: true });
  }
});

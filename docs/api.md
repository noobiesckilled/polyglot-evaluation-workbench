# API contract

The gateway exposes the API under the same origin as the browser application. JSON requests use `Content-Type: application/json`. Except for health checks, send `Authorization: Bearer <access token>`.

`WORKBENCH_TOKEN` grants operator access. Optional `READ_ONLY_TOKEN` grants read access. Both must be at least 24 characters and must differ. Generate random values; length alone does not provide entropy. The application does not create user accounts or issue identity tokens.

| Method | Route                   | Access             | Success                                       |
| ------ | ----------------------- | ------------------ | --------------------------------------------- |
| GET    | `/api/health`           | Public             | 200 with process health                       |
| GET    | `/api/catalog`          | Viewer or operator | 200 with role and implementation availability |
| GET    | `/api/runs`             | Viewer or operator | 200 with the latest 50 run summaries          |
| POST   | `/api/runs`             | Operator           | 201 with saved evaluation evidence            |
| GET    | `/api/runs/{id}`        | Viewer or operator | 200 with one run and review history           |
| PATCH  | `/api/runs/{id}/review` | Operator           | 200 with the updated review                   |

## Create a run

```json
{
  "languages": [
    "python",
    "javascript",
    "java",
    "go",
    "rust",
    "javascript-mutant"
  ],
  "suite": "regression"
}
```

Suites are `boundaries` (9 fixtures), `regression` (9 fixtures and 40 seeded cases), and `custom` (one supplied case). Custom requests also contain `intervals`, for example `[[1,3],[3,5]]`.

Inputs are arrays of at most 128 pairs. Endpoints must be integers from -1,000,000 to 1,000,000, inclusive, and each start must be less than or equal to its end. Booleans and floating-point values are rejected. Implementation names are a fixed allowlist. Duplicates, unknown names, and unsupported request fields are rejected.

The worker result contains `language`, `status`, `passed`, `total`, `duration_ms`, and `cases`. Each case records `name`, `input`, `expected`, `actual`, and `passed`. Infrastructure failures carry a short `error` rather than raw process output. Valid statuses are `passed`, `failed`, `unavailable`, `timeout`, and `error`.

## Save a review

```json
{
  "verdict": "needs-work",
  "note": "The implementation does not merge touching boundaries.",
  "version": 0
}
```

Verdicts are `unreviewed`, `approved`, and `needs-work`. A non-empty explanation is required for the latter two. Notes are capped at 2,000 characters. Use the run's current `version`; successful updates increment it. A stale version returns 409 and preserves the already-saved review. New runs start at version zero.

## Errors and limits

Errors have the shape `{"error":"Human-readable reason"}`. The browser retains entered review text after a failed save. Review the current saved run before retrying a conflict.

| Status    | Meaning                                                                  |
| --------- | ------------------------------------------------------------------------ |
| 400       | Invalid JSON, validation failure, or malformed request                   |
| 401       | Missing or invalid token                                                 |
| 403       | Read-only token used for a write, disallowed origin, or denied file path |
| 404       | Unknown route, file, or run                                              |
| 405       | Method not supported                                                     |
| 409       | Review version changed                                                   |
| 413       | Gateway body limit exceeded                                              |
| 429       | Request throttling or evaluation capacity reached                        |
| 500       | API internal error                                                       |
| 502 / 504 | Upstream unavailable / upstream timeout                                  |

API responses include a request ID for correlation with structured server logs. Logs contain route, method, status, and duration, not bearer tokens, request bodies, or review notes. The gateway permits 120 API requests per client address per minute, excluding health checks. It does not trust forwarded client addresses. Users behind one proxy share that allowance. The API allows two active evaluations, each worker has a five-second deadline, and request bodies are capped at 32 KiB.

`/api/health` reports process reachability. It is not a complete readiness check of the database and every runtime; validate `/api/catalog` and perform a smoke evaluation after a deployment.

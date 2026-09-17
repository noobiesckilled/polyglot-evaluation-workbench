# Testing

Tests cover the request path and the evaluator, not just the merge algorithm.

## Layers

| Layer                       | Checks                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| React component tests       | Failed unlock, run submission, review save, malformed custom JSON                                                              |
| Gateway integration tests   | Header policy, proxy behavior, origin checks, route allowlist, body limit, path checks, request throttling                     |
| Python domain tests         | Golden oracle cases, reproducible fixtures, rejected booleans/floats/out-of-range input, review validation                     |
| API integration tests       | Access control, read-only writes, persistence, concurrent writes, stale-review conflicts, revision history                     |
| Worker contract tests       | All installed runtimes must match all 49 fixtures; strict CI mode requires every runtime                                       |
| Evaluator negative controls | Deliberately incorrect implementation must fail; invalid output and real timeout must not pass                                 |
| Native worker tests         | Java, Go, and Rust empty/boundary/invalid-input behavior; input mutation checks                                                |
| Backup test                 | Restore a saved run and review into a separate database and verify the content                                                 |
| Browser tests               | Real frontend-to-database workflow, failure inspection, reload persistence, viewer permissions, mobile overflow, accessibility |

The 49-case suite contains nine named boundary cases and forty generated cases with a fixed seed. These are reproducible contract checks, not exhaustive input coverage or load-test results. The deliberately broken JavaScript variant uses a strict overlap comparison and misses touching boundaries.

## Fast checks

```bash
npm ci
npm run build
npm test
python -m unittest discover -s backend/tests -v
```

Native compilers are optional for the fast Python pass, so that command alone is not proof that every language works. `docker build -t workbench:verify .` compiles the native workers, runs their tests, and sets `REQUIRE_ALL_WORKERS=1` for the cross-language checks.

## End-to-end checks

Use a dedicated test container and test volume. These tokens are deliberately public test fixtures, not deployment secrets.

```bash
docker run -d --name workbench-test \
  -p 127.0.0.1:4173:4173 \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --cap-drop ALL --security-opt no-new-privileges \
  --pids-limit 128 --memory 768m --cpus 1 \
  -e WORKBENCH_TOKEN=ci-only-token-not-for-deployment \
  -e READ_ONLY_TOKEN=ci-only-viewer-token-not-for-deployment \
  -v workbench-test-data:/app/.data workbench:verify
npx playwright install chromium
npm run test:e2e
```

The commands above use Bash continuation syntax. In PowerShell, run the Docker command on one line or use backticks for continuation. Stop and remove only the dedicated test container after verification; preserve or deliberately clean its test volume.

Browser artifacts are written under `test-results` and `playwright-report`, which are ignored by Git. They can contain entered review text and test access tokens. Do not run the test suite against a real database containing sensitive records and then publish its trace files.

## Accessibility and visual checks

Browser tests run axe checks for WCAG A/AA rules, assert that the mobile page does not overflow horizontally, and capture desktop/mobile screenshots. Review the screenshots as well: automated tools cannot judge whether a visual hierarchy is clear or a workflow is pleasant to use. Cases are shown in batches so long suites do not create an unmanageable mobile page.

## CI and release gate

The workflow checks formatting, Python lint, the npm dependency audit, the multi-stage Docker build, and the real-browser tests. A failed step blocks that workflow; no AWS deployment occurs automatically.

Before releasing a change, verify the current commit's workflow, reproduce its Docker image, run the smoke workflow, back up the target database, and record the image digest. For a database change, test restoring the backup and document rollback compatibility before rollout.

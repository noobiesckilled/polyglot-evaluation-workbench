# Security boundaries

The workbench is intended for local use or a private AWS trial through Session Manager. Do not expose its HTTP listener directly to the internet.

## Implemented controls

- Constant-time bearer-token comparison on the API; optional separate read-only token.
- Browser tokens stay in memory. They are not placed in URLs, local storage, or cookies.
- Same-origin gateway requests, fixed proxy routes, and no user-supplied upstream destination.
- A restrictive content security policy, frame denial, MIME sniffing prevention, and no-referrer policy.
- A 32 KiB request limit, bounded interval count, strict integer checks, and explicit implementation allowlists.
- Two active evaluations at most, per-process execution deadlines, and gateway request throttling.
- Subprocesses receive structured stdin and fixed executable arguments. Shell execution is not used. Access-token environment variables are not passed to workers.
- Parameterized SQL, transactional review revisions, and optimistic concurrency checks.
- Container runs as an unprivileged user with a read-only root filesystem, dropped capabilities, PID/memory/CPU limits, and a dedicated writable data volume in the documented launch configuration.

The golden fixtures and oracle stay in the API. Workers return results; they do not decide their own score. Worker output is parsed and compared strictly so boolean values cannot pass as integers.

## What these controls do not provide

The worker process boundary is **not an arbitrary-code security sandbox**. A checked-in implementation is trusted application code and could still read files accessible to the container user. Do not add an upload-and-execute feature without a separate threat model, sandbox, network policy, filesystem isolation, resource accounting, and independent review.

Shared bearer tokens are not per-user authentication. Read-only access separates permissions, but cannot prove which person made an edit. Public or multi-tenant use requires an identity provider, short-lived sessions, role assignment, tenant isolation, and auditable individual identities.

The Python HTTP server is intentionally small and binds to loopback behind the gateway. It is not a general public-facing application server. The Docker health check is a liveness probe, not evidence that backups, disks, every runtime, and all dependencies are healthy.

A green test run does not establish that a system has no vulnerabilities. Dependency scanning, patching, access review, log review, and operational testing remain ongoing work.

## Reporting a problem

Do not open a public issue containing credentials, private data, or an exploit against an active deployment. Use the repository's private vulnerability reporting option if enabled. Revoke a leaked token through the deployment configuration and restart the service; deleting a commit does not revoke a secret.

## Token rotation

Generate a new random token, update the local environment or AWS SecureString parameter, and restart the application. Existing browser sessions will receive an unauthorized response and must unlock again. Keep operator and read-only tokens separate. On AWS, use short-lived operator credentials through IAM Identity Center or an assumed role; never add AWS access keys to this repository.

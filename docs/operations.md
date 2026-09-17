# Operations and recovery

These procedures apply to the private single-instance AWS setup in the deployment guide. They are deployment instructions, not a claim that an AWS recovery exercise has already been performed.

## Signals to watch

| Signal             | Check                                                  | Action                                                       |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------------------ |
| Process health     | `curl --fail http://127.0.0.1:4173/api/health`         | Inspect service and container state                          |
| Runtime readiness  | Unlock and inspect implementation availability         | Verify the deployed image and compiler artifacts             |
| Application errors | CloudWatch JSON `status` values and request IDs        | Correlate the failing route and inspect its inputs locally   |
| CPU and memory     | `docker stats --no-stream polyglot-workbench-aws`      | Check concurrent workload before increasing limits           |
| Disk space         | `df -h /srv/workbench/data`                            | Review database, backups, images, and log retention          |
| Instance health    | EC2 status checks                                      | Investigate host/network failure or restore to a replacement |
| Backups            | Latest successful timer execution and latest S3 object | Investigate failed upload, permissions, or disk pressure     |

The health check does not restart an unhealthy container automatically. The systemd unit restarts a failed process. A running but unhealthy service still needs an alarm and an operator response.

Useful host commands:

```bash
sudo systemctl status workbench.service
sudo journalctl -u workbench.service --since '30 minutes ago'
docker inspect --format '{{json .State.Health}}' polyglot-workbench-aws
sudo systemctl list-timers workbench-backup.timer
```

Application logs are sent to the configured CloudWatch log group. They include request IDs, route, status, and duration. Tokens, review text, and case inputs are not logged. For a suspected permission issue, verify the host instance role and exact resource ARN rather than adding broad administrator permissions.

## Backup

The backup script calls SQLite's backup API inside the application container and runs an integrity check. It then uploads the completed file to S3. Do not copy the live database file by itself while WAL writes are active.

```bash
sudo systemctl start workbench-backup.service
sudo journalctl -u workbench-backup.service -n 30
```

Verify that a new object appeared under the bucket's `database/` prefix. After a successful restore exercise, enable the timer:

```bash
sudo systemctl enable --now workbench-backup.timer
```

The timer runs daily at 02:00 UTC, with up to five minutes of jitter. A daily schedule implies that up to a day of changes may be missing after a disk loss, assuming backups succeeded. Choose a different schedule if that is unacceptable. No recovery-time objective is claimed until it has been measured.

Backups remain in `/srv/workbench/data/backups` as well as S3. Monitor local disk use and apply a reviewed local retention procedure after confirming off-host copies. Configure S3 lifecycle rules deliberately; versioning alone is not a retention policy.

## Restore exercise

First restore into a separate test location, not over the live database. Use an operator role with `s3:GetObject` scoped to the selected backup. The normal application role only needs to upload backups. Do not paste long-lived AWS credentials onto the host.

1. Download a selected backup to a recovery directory and record its S3 key and version.
2. Check SQLite integrity, the run count, a known run's result, and its review history.
3. Start the same application image against a separate writable data directory containing the downloaded file named `workbench.sqlite`.
4. Use a separate local port and temporary token. Confirm a saved run and its review through the UI.
5. Record when the backup was taken, when service became usable, and any missing data.

The local test suite performs a database backup and restoration check. It does not replace this full AWS exercise, which also verifies IAM, S3 access, host configuration, image availability, and the operator's runbook.

## Replace the active database

After verifying the recovery copy:

1. Stop `workbench.service` and confirm the container has exited.
2. Preserve the entire old `/srv/workbench/data` directory under a dated recovery name. This retains the database, WAL, shared-memory file, and local backups together.
3. Create a new `/srv/workbench/data` directory owned by UID/GID 1000, with mode 0750.
4. Copy the verified backup into it as `workbench.sqlite`, also owned by UID/GID 1000. Do not copy old `-wal` or `-shm` files beside the restored database.
5. Start the service, run the smoke workflow, and verify the restored records. Keep the old data directory until recovery is accepted.

This preserves a rollback path and avoids mixing a restored database with stale WAL files. Restore actions replace application state, so verify the instance and paths before carrying them out.

## Application rollout and rollback

Build from a reviewed commit, wait for its CI checks, inspect dependency/image scan findings, and publish a new immutable ECR tag. Record its digest and the previous digest. Back up the target database, edit only `APP_IMAGE` in `/etc/workbench.conf`, and restart the service.

Run the acceptance workflow after restart. If it fails, stop the service and restore the previous image digest. If a schema migration is incompatible with the previous version, image rollback alone is insufficient: use the verified database backup and the restore procedure. Never assume a future migration is backward compatible.

## Common failures

- **Service exits before the page loads:** inspect the systemd journal for ECR access, an invalid digest, a missing SSM parameter, or a log-group permission error.
- **Unauthorized in the browser:** verify the token source and whether it was rotated. Refreshing the page intentionally clears browser access.
- **Implementation unavailable:** the native worker was not built or the wrong image was deployed. Missing workers must not be relabeled as passing.
- **Review conflict:** another save advanced the version. Preserve your draft, reopen the run, reconcile the current review, and save again.
- **Rate limit or busy response:** wait for the current requests/evaluations to complete. Behind a shared proxy, the gateway sees one client address.
- **Database write failure:** inspect disk space, mount permissions, and WAL files. Do not delete the database as a repair step.
- **Backup upload failure:** verify the bucket region, scoped `PutObject` permission, encryption settings, and S3 connectivity. The locally verified backup may still exist.

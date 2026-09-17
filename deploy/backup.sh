#!/usr/bin/env bash
set -euo pipefail
umask 077

: "${AWS_REGION:?Set AWS_REGION}"
: "${BACKUP_BUCKET:?Set BACKUP_BUCKET}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
filename="workbench-$stamp.sqlite"

docker exec polyglot-workbench-aws python3 scripts/backup.py \
  /app/.data/workbench.sqlite "/app/.data/backups/$filename"
aws s3 cp "/srv/workbench/data/backups/$filename" \
  "s3://$BACKUP_BUCKET/database/$filename" \
  --region "$AWS_REGION" --sse AES256 --only-show-errors
printf 'Verified backup uploaded: %s\n' "$filename"

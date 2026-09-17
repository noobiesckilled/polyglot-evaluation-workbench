#!/usr/bin/env bash
set -euo pipefail
umask 077

: "${AWS_REGION:?Set AWS_REGION}"
: "${APP_IMAGE:?Set APP_IMAGE to an immutable ECR digest}"
: "${TOKEN_PARAMETER:?Set TOKEN_PARAMETER}"
: "${AWS_LOG_GROUP:?Set AWS_LOG_GROUP}"

if [[ ! "$APP_IMAGE" =~ ^[0-9]{12}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com/[a-z0-9/_-]+@sha256:[a-f0-9]{64}$ ]]; then
  echo "APP_IMAGE must be an ECR image pinned by digest" >&2
  exit 1
fi

registry="${APP_IMAGE%%/*}"
aws ecr get-login-password --region "$AWS_REGION" |
  docker login --username AWS --password-stdin "$registry" >/dev/null
docker pull "$APP_IMAGE"

token="$(aws ssm get-parameter --region "$AWS_REGION" --name "$TOKEN_PARAMETER" --with-decryption --query Parameter.Value --output text)"
if [[ ! "$token" =~ ^[a-fA-F0-9]{64}$ ]]; then
  echo "The operator token must be 32 random bytes encoded as 64 hex characters" >&2
  exit 1
fi
install -d -m 0700 /run/workbench
printf 'WORKBENCH_TOKEN=%s\n' "$token" > /run/workbench/runtime.env
unset token
install -d -o 1000 -g 1000 -m 0750 /srv/workbench/data

exec docker run --rm --name polyglot-workbench-aws \
  --publish 127.0.0.1:4173:4173 \
  --env-file /run/workbench/runtime.env \
  --mount type=bind,source=/srv/workbench/data,target=/app/.data \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --cap-drop ALL --security-opt no-new-privileges \
  --pids-limit 128 --memory 768m --cpus 1 \
  --log-driver awslogs \
  --log-opt "awslogs-region=$AWS_REGION" \
  --log-opt "awslogs-group=$AWS_LOG_GROUP" \
  --log-opt awslogs-stream=workbench \
  "$APP_IMAGE"

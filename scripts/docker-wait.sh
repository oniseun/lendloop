#!/bin/sh
# Waits until the Docker stack's web and n8n containers report healthy.
set -eu
for i in $(seq 1 120); do
  web=$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q web)" 2>/dev/null || echo starting)
  n8n=$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q n8n)" 2>/dev/null || echo starting)
  echo "web: $web  n8n: $n8n"
  [ "$web" = healthy ] && [ "$n8n" = healthy ] && exit 0
  sleep 5
done
echo "Timed out waiting for the stack" >&2
exit 1

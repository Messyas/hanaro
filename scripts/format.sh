#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

# Use the host user so bind-mounted files remain writable by the Linux developer.
compose_user=(--user "$(id -u):$(id -g)")

docker compose run --rm --no-deps "${compose_user[@]}" backend sh -c 'RUFF_CACHE_DIR=/tmp/ruff-cache ruff check --fix src tests && RUFF_CACHE_DIR=/tmp/ruff-cache ruff format src tests'
docker compose run --rm --no-deps "${compose_user[@]}" frontend sh -c "./node_modules/.bin/prettier --write 'src/**/*.{ts,html,css}'"

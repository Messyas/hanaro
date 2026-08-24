#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

docker compose --profile sonar up -d --build sonarqube
docker compose --profile sonar run --rm --build sonar-backend-coverage
docker compose --profile sonar run --rm --build sonar-frontend-coverage
docker compose --profile sonar run --rm sonar-scanner

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot

Push-Location $projectRoot
try {
    docker compose --profile sonar up -d --build sonarqube
    docker compose --profile sonar run --rm --build sonar-backend-coverage
    docker compose --profile sonar run --rm --build sonar-frontend-coverage
    docker compose --profile sonar run --rm sonar-scanner
}
finally {
    Pop-Location
}

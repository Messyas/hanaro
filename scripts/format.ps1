[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot

Push-Location $projectRoot
try {
    docker compose run --rm --no-deps backend sh -c "RUFF_CACHE_DIR=/tmp/ruff-cache ruff check --fix src tests && RUFF_CACHE_DIR=/tmp/ruff-cache ruff format src tests"
    if ($LASTEXITCODE -ne 0) {
        throw "Ruff could not format the backend."
    }

    docker compose run --rm --no-deps frontend sh -c "./node_modules/.bin/prettier --write 'src/**/*.{ts,html,css}'"
    if ($LASTEXITCODE -ne 0) {
        throw "Prettier could not format the frontend."
    }
}
finally {
    Pop-Location
}

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR/ui-tests"

npm ci
# If browsers are not present on this machine/CI runner, uncomment:
# npx playwright install chromium

npx playwright test

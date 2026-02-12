#!/usr/bin/env bash
set -e

# Test production site (duocalculator.com) with Playwright
# Usage: ./scripts/test-production.sh [prod-url]

cd "$(dirname "$0")/.."

PROD_URL="${1:-https://www.duocalculator.com}"

echo "🌐 Testing production site: $PROD_URL"
echo ""

cd ui-tests

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Ensure Chromium is installed
echo "🔧 Checking Playwright browsers..."
npx playwright install chromium --with-deps

echo ""
echo "🧪 Running Playwright tests against production..."
echo ""

# Run tests with production config
# Export PROD_URL so tests can access it via readBaseUrl()
export PROD_URL="$PROD_URL"
npx playwright test --config=playwright.config.prod.js

echo ""
echo "✅ Production tests complete!"
echo ""
echo "📊 View HTML report: npx playwright show-report test-results-prod"

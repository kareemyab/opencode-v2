#!/usr/bin/env bash
# Audit outbound telemetry / vendor hooks in desktop path packages.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PACKAGES=(packages/desktop packages/app)
PATTERN='opencode\.ai|anomalyco|sentry\.io'

echo "Telemetry / outbound vendor audit (desktop path)"
echo "================================================"

if rg -n "$PATTERN" "${PACKAGES[@]}" \
  --glob '!node_modules' \
  --glob '!.artifacts' \
  --glob '!**/*.md' \
  --glob '!**/package.json' \
  2>/dev/null; then
  echo ""
  echo "Review required: hardcoded vendor URLs found above."
  echo "Sentry init is env-gated via VITE_SENTRY_DSN — no DSN is bundled by default."
  exit 1
fi

if rg -n '@sentry|Sentry\.init|VITE_SENTRY' "${PACKAGES[@]}" \
  --glob '!node_modules' \
  --glob '!.artifacts' \
  2>/dev/null; then
  echo ""
  echo "Sentry integration points (env-gated — OK when VITE_SENTRY_DSN is unset):"
  rg -n '@sentry|Sentry\.init|VITE_SENTRY' "${PACKAGES[@]}" \
    --glob '!node_modules' \
    --glob '!.artifacts' \
    2>/dev/null || true
fi

echo ""
echo "Telemetry audit passed: no hardcoded opencode.ai/anomalyco/sentry.io URLs."

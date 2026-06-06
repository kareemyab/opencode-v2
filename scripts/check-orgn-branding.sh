#!/usr/bin/env bash
# Fail CI if user-visible OpenCode branding remains in desktop path packages.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GLOBS=(
  --glob '!node_modules'
  --glob '!.artifacts'
  --glob '!**/*.md'
  --glob '!**/*.test.ts'
)

PACKAGES=(packages/desktop packages/app packages/ui)

fail=0

report() {
  echo "$1"
  fail=1
}

if rg -n 'OpenCode' "${PACKAGES[@]}" "${GLOBS[@]}" 2>/dev/null; then
  report ""
  report "Branding check failed: found OpenCode product name in desktop path."
fi

if rg -n 'opencode\.ai' "${PACKAGES[@]}" "${GLOBS[@]}" 2>/dev/null; then
  report ""
  report "Branding check failed: found opencode.ai URL in desktop path."
fi

if rg -n 'anomalyco' "${PACKAGES[@]}" "${GLOBS[@]}" --glob '!**/package.json' 2>/dev/null; then
  report ""
  report "Branding check failed: found anomalyco reference in desktop path."
fi

if rg -n 'ai\.opencode\.desktop' "${PACKAGES[@]}" \
  "${GLOBS[@]}" \
  --glob '!**/migrate.ts' \
  --glob '!**/store.ts' \
  2>/dev/null; then
  report ""
  report "Branding check failed: found legacy ai.opencode.desktop id outside migration compat code."
fi

if [ "$fail" -ne 0 ]; then
  echo ""
  echo "Branding check failed in packages/desktop, packages/app, or packages/ui."
  exit 1
fi

echo "Branding check passed (desktop path)."

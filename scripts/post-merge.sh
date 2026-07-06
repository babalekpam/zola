#!/usr/bin/env bash
set -euo pipefail

# Post-merge setup for the Next.js app (github main / 854adcb lineage).
# Installs dependencies so the dev/preview workflow can start cleanly.

echo "[post-merge] Installing npm dependencies..."
npm install --no-audit --no-fund

echo "[post-merge] Done."

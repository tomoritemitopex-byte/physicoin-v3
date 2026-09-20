#!/usr/bin/env bash
# bend-check.sh — lightweight pre-build Bend validation
# Runs `bend --check-only` on ~/physicoin-bend/Physicoin.bend, UI.bend, Builder.bend and Clean.bend if they exist.
# Fails the build if they don't check. Warns (not fails) if bend is not installed.
set -e

BEND_BIN="${BEND_BIN:-$HOME/.cargo/bin/bend}"

# Resolve bend binary
if [ ! -x "$BEND_BIN" ]; then
  if command -v bend >/dev/null 2>&1; then
    BEND_BIN="$(command -v bend)"
  else
    echo "[bend-check] WARN: bend not installed at $BEND_BIN and not in PATH — skipping (not blocking build)" >&2
    exit 0
  fi
fi

if [ ! -x "$BEND_BIN" ]; then
  echo "[bend-check] WARN: bend binary not executable at $BEND_BIN — skipping" >&2
  exit 0
fi

FAILED=0
for f in "$HOME/physicoin-bend/Physicoin.bend" "$HOME/physicoin-bend/UI.bend" "$HOME/physicoin-bend/Builder.bend" "$HOME/physicoin-bend/Clean.bend" ./bend/Builder.bend ./bend/Physicoin.bend ./bend/UI.bend ./bend/Clean.bend ./bend/Showcase.bend ./bend/Emit.bend; do
  if [ -f "$f" ]; then
    echo "[bend-check] checking $f ..."
    if ! "$BEND_BIN" --check-only "$f" 2>&1; then
      echo "[bend-check] FAILED: $f did not check — failing build" >&2
      FAILED=1
    else
      echo "[bend-check] ok: $f"
    fi
  else
    echo "[bend-check] $f not found — skipping"
  fi
done

if [ "$FAILED" -ne 0 ]; then
  echo "[bend-check] one or more Bend files failed check" >&2
  exit 1
fi

echo "[bend-check] all Bend checks passed"

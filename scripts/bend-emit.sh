#!/usr/bin/env bash
# bend-emit.sh — compile Bend to JS for Next.js import
# Runs `bend build bend/Emit.bend -o /tmp/emit.js` (and mirrors to bend/Emit.js)
# Warns, never fails, if bend not installed or build fails — build must stay green.
set -e

BEND_BIN="${BEND_BIN:-$HOME/.cargo/bin/bend}"

# Resolve bend binary
if [ ! -x "$BEND_BIN" ]; then
  if command -v bend >/dev/null 2>&1; then
    BEND_BIN="$(command -v bend)"
  else
    echo "[bend-emit] WARN: bend not installed at $BEND_BIN and not in PATH — skipping JS emit (not blocking build)" >&2
    exit 0
  fi
fi

if [ ! -x "$BEND_BIN" ]; then
  echo "[bend-emit] WARN: bend binary not executable at $BEND_BIN — skipping" >&2
  exit 0
fi

SRC="bend/Emit.bend"
OUT_TMP="/tmp/emit.js"
OUT_PROJ="bend/Emit.js"

if [ ! -f "$SRC" ]; then
  echo "[bend-emit] WARN: $SRC not found — skipping" >&2
  exit 0
fi

echo "[bend-emit] building $SRC -> $OUT_TMP ..."
# Task spec: `bend build bend/Emit.bend -o /tmp/emit.js` (Bend 2.0.18 uses `bend <file> -o <out>`)
# Try new `build` subcommand first, fall back to classic `bend <file> -o <out>` for this install.
if ! ( "$BEND_BIN" build "$SRC" -o "$OUT_TMP" 2>&1 || "$BEND_BIN" "$SRC" -o "$OUT_TMP" 2>&1 ); then
  echo "[bend-emit] WARN: bend build failed for $SRC — skipping (not blocking build)" >&2
  exit 0
fi

if [ -f "$OUT_TMP" ]; then
  echo "[bend-emit] ok: $OUT_TMP exists ($(wc -c < "$OUT_TMP" | tr -d ' ') bytes)"
else
  echo "[bend-emit] WARN: expected output $OUT_TMP not found — skipping" >&2
  exit 0
fi

# Mirror to project-local path so Next.js *could* import it (optional, not required for build)
if cp "$OUT_TMP" "$OUT_PROJ" 2>/dev/null; then
  echo "[bend-emit] mirrored to $OUT_PROJ (Next.js can import from @/bend/Emit.js)"
else
  echo "[bend-emit] WARN: could not mirror to $OUT_PROJ — /tmp output still valid" >&2
fi

# Also emit to lib/bendEmit.js for alternative import path (best-effort)
mkdir -p lib 2>/dev/null || true
cp "$OUT_TMP" "lib/bendEmit.js" 2>/dev/null || true

echo "[bend-emit] done"

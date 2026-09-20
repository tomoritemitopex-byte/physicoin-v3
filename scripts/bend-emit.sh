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
else
  echo "[bend-emit] building $SRC -> $OUT_TMP ..."
  # Task spec: `bend build bend/Emit.bend -o /tmp/emit.js` (Bend 2.0.18 uses `bend <file> -o <out>`)
  # Try new `build` subcommand first, fall back to classic `bend <file> -o <out>` for this install.
  if ! ( "$BEND_BIN" build "$SRC" -o "$OUT_TMP" 2>&1 || "$BEND_BIN" "$SRC" -o "$OUT_TMP" 2>&1 ); then
    echo "[bend-emit] WARN: bend build failed for $SRC — skipping (not blocking build)" >&2
  else
    if [ -f "$OUT_TMP" ]; then
      echo "[bend-emit] ok: $OUT_TMP exists ($(wc -c < "$OUT_TMP" | tr -d ' ') bytes)"
    else
      echo "[bend-emit] WARN: expected output $OUT_TMP not found — skipping" >&2
    fi

    # Mirror to project-local path so Next.js *could* import it (optional, not required for build)
    if [ -f "$OUT_TMP" ] && cp "$OUT_TMP" "$OUT_PROJ" 2>/dev/null; then
      echo "[bend-emit] mirrored to $OUT_PROJ (Next.js can import from @/bend/Emit.js)"
    else
      echo "[bend-emit] WARN: could not mirror to $OUT_PROJ — /tmp output still valid" >&2
    fi

    # Also emit to lib/bendEmit.js for alternative import path (best-effort)
    mkdir -p lib 2>/dev/null || true
    cp "$OUT_TMP" "lib/bendEmit.js" 2>/dev/null || true
  fi
fi

# --- Lottery: simple parallel lottery (List Nat -> List Nat via bend) ---
SRC_LOT="bend/Lottery.bend"
OUT_LOT="/tmp/lottery.js"
OUT_LOT_PROJ="bend/Lottery.js"

if [ ! -f "$SRC_LOT" ]; then
  echo "[bend-emit] WARN: $SRC_LOT not found — skipping lottery emit" >&2
else
  echo "[bend-emit] building $SRC_LOT -> $OUT_LOT ..."
  if ! ( "$BEND_BIN" build "$SRC_LOT" -o "$OUT_LOT" 2>&1 || "$BEND_BIN" "$SRC_LOT" -o "$OUT_LOT" 2>&1 ); then
    echo "[bend-emit] WARN: bend build failed for $SRC_LOT — skipping (not blocking build)" >&2
  else
    if [ -f "$OUT_LOT" ]; then
      echo "[bend-emit] ok: $OUT_LOT exists ($(wc -c < "$OUT_LOT" | tr -d ' ') bytes)"
    else
      echo "[bend-emit] WARN: expected output $OUT_LOT not found — skipping" >&2
    fi
    if [ -f "$OUT_LOT" ] && cp "$OUT_LOT" "$OUT_LOT_PROJ" 2>/dev/null; then
      echo "[bend-emit] mirrored to $OUT_LOT_PROJ"
    fi
    mkdir -p lib 2>/dev/null || true
    cp "$OUT_LOT" "lib/bendLottery.js" 2>/dev/null || true
  fi
fi

# --- Score: parallel Latin grid scorer (List Nat, Nat -> Nat via bend) ---
SRC_SCORE="bend/Score.bend"
OUT_SCORE="/tmp/score.js"
OUT_SCORE_PROJ="bend/Score.js"

if [ ! -f "$SRC_SCORE" ]; then
  echo "[bend-emit] WARN: $SRC_SCORE not found — skipping score emit" >&2
else
  echo "[bend-emit] building $SRC_SCORE -> $OUT_SCORE ..."
  if ! ( "$BEND_BIN" build "$SRC_SCORE" -o "$OUT_SCORE" 2>&1 || "$BEND_BIN" "$SRC_SCORE" -o "$OUT_SCORE" 2>&1 ); then
    echo "[bend-emit] WARN: bend build failed for $SRC_SCORE — skipping (not blocking build)" >&2
  else
    if [ -f "$OUT_SCORE" ]; then
      echo "[bend-emit] ok: $OUT_SCORE exists ($(wc -c < "$OUT_SCORE" | tr -d ' ') bytes)"
    else
      echo "[bend-emit] WARN: expected output $OUT_SCORE not found — skipping" >&2
    fi
    if [ -f "$OUT_SCORE" ] && cp "$OUT_SCORE" "$OUT_SCORE_PROJ" 2>/dev/null; then
      echo "[bend-emit] mirrored to $OUT_SCORE_PROJ"
    fi
    mkdir -p lib 2>/dev/null || true
    cp "$OUT_SCORE" "lib/bendScore.js" 2>/dev/null || true
  fi
fi

echo "[bend-emit] done"

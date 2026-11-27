#!/bin/bash
# Regression suite for the uuid-guard fix.
#
# A query param that lands in a Postgres uuid column must be a UUID. If it
# isn't, Postgres throws "invalid input syntax for type uuid" and the route
# returns 500 INTERNAL instead of 400 BAD_INPUT. These routes used to crash.
#
# Requires a running server (default http://127.0.0.1:3111) and a migrated DB.
#   usage: bash scripts/api-regress.sh [base_url]
set -u
BASE="${1:-http://127.0.0.1:3111}"
pass=0; fail=0

check() {
  local path="$1" want_status="$2" want_code="$3" label="$4"
  local out code body
  out=$(curl -s -m 25 -w $'\n%{http_code}' "$BASE$path")
  code=$(printf '%s' "$out" | tail -n1)
  body=$(printf '%s' "$out" | sed '$d')
  if [ "$code" = "$want_status" ] && printf '%s' "$body" | grep -q "\"$want_code\""; then
    echo "PASS  $label  ($path -> $code $want_code)"
    pass=$((pass+1))
  else
    echo "FAIL  $label  ($path -> $code, wanted $want_status/$want_code)"
    echo "        body: $(printf '%s' "$body" | cut -c1-140)"
    fail=$((fail+1))
  fi
}

echo "== the 3 originally-crashing endpoints =="
check "/api/ghost-chain"          400 BAD_INPUT "ghost-chain no user_id"
check "/api/ghost-chain?user_id=" 400 BAD_INPUT "ghost-chain empty user_id"
check "/api/ghost-chain?user_id=not-a-uuid" 400 BAD_INPUT "ghost-chain garbage user_id"
check "/api/cohort"               400 BAD_INPUT "cohort no user_id"
check "/api/cohort?user_id=xyz"   400 BAD_INPUT "cohort garbage user_id"
check "/api/proof"                400 BAD_INPUT "proof no event_id"
check "/api/proof?event_id=abc"   400 BAD_INPUT "proof garbage event_id"

echo
echo "== wider uuid-guard surface =="
check "/api/echo"                 400 BAD_INPUT "echo no event_id"
check "/api/echo?event_id=1"      400 BAD_INPUT "echo garbage event_id"
check "/api/squad/wave"           400 BAD_INPUT "squad/wave no user_id"
check "/api/schools/departments"  400 BAD_INPUT "schools/departments no school_id"
check "/api/dm"                   400 BAD_INPUT "dm no user_id"
check "/api/dm?user_id=1"         400 BAD_INPUT "dm garbage user_id"
check "/api/vote-weight"          400 BAD_INPUT "vote-weight no user_id"
check "/api/streak/heatmap"       400 BAD_INPUT "streak/heatmap no user_id"
check "/api/futures"              400 BAD_INPUT "futures no event_id"
check "/api/faucet"               400 BAD_INPUT "faucet no user_id"
check "/api/pods"                 400 BAD_INPUT "pods no user_id"
check "/api/verify"               400 BAD_INPUT "verify no event_id"

echo
echo "== valid inputs must NOT be rejected =="
check "/api/health"               200 ok "health still works"
check "/api/mining?round=current" 200 ok "mining current round still works"
check "/api/stats"                200 ok "stats still works"
check "/api/notes"                200 ok "notes (optional viewer) still works"
check "/api/squad"                200 ok "squad heat (optional viewer) still works"
check "/api/mining"               200 ok "mining with no user_id still works"

ics_code=$(curl -s -m 25 -o /tmp/ics.out -w '%{http_code}' "$BASE/api/calendar/ics")
if [ "$ics_code" = "200" ] && grep -q 'BEGIN:VCALENDAR' /tmp/ics.out 2>/dev/null; then
  echo "PASS  calendar ics (optional user) still works  (/api/calendar/ics -> 200 VCALENDAR)"
  pass=$((pass+1))
else
  echo "FAIL  calendar ics (optional user) still works  (got $ics_code)"
  fail=$((fail+1))
fi

# A well-formed uuid that does not exist must be a domain 404, NOT a 400.
code=$(curl -s -m 25 -o /tmp/u.out -w '%{http_code}' "$BASE/api/proof?event_id=00000000-0000-4000-8000-000000000000")
if [ "$code" != "500" ] && [ "$code" != "400" ]; then
  echo "PASS  valid-but-unknown uuid is not a 400/500  (/api/proof -> $code)"
  pass=$((pass+1))
else
  echo "FAIL  valid-but-unknown uuid is not a 400/500  (got $code: $(cat /tmp/u.out))"
  fail=$((fail+1))
fi

# The chain must be readable and self-consistent after a repair pass.
code=$(curl -s -m 30 -o /tmp/c.out -w '%{http_code}' "$BASE/api/rounds?view=chain&limit=200")
if [ "$code" = "200" ] && grep -q '"valid":true' /tmp/c.out 2>/dev/null; then
  echo "PASS  block chain verifies after repair  (/api/rounds?view=chain -> 200 valid)"
  pass=$((pass+1))
else
  echo "FAIL  block chain verifies after repair  (got $code: $(head -c 160 /tmp/c.out))"
  fail=$((fail+1))
fi

# Repair must be idempotent: a second pass changes nothing.
curl -s -m 30 -o /dev/null "$BASE/api/rounds?limit=3"
a=$(curl -s -m 30 "$BASE/api/rounds?view=chain&limit=200")
curl -s -m 30 -o /dev/null "$BASE/api/rounds?limit=3"
b=$(curl -s -m 30 "$BASE/api/rounds?view=chain&limit=200")
if [ "$a" = "$b" ] && echo "$b" | grep -q '"valid":true'; then
  echo "PASS  repair is idempotent  (repeat visit keeps the chain valid)"
  pass=$((pass+1))
else
  echo "FAIL  repair is idempotent  (got: ${b:0:160})"
  fail=$((fail+1))
fi

echo
echo "RESULT: $pass passed, $fail failed"
exit $([ $fail -eq 0 ] && echo 0 || echo 1)

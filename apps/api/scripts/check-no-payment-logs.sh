#!/usr/bin/env bash
# Anti-regression gate for HIGH-01 (plan 28-02): payment payloads must never
# be logged in full. Fails CI if any console.log in the in-scope files emits
# a signed transaction or EIP-3009 authorization.
#
# Scope is deliberately narrow — only the two files where the audit found
# full-payload logs. Adding files to FILES below requires re-auditing each
# call site for false positives (banner strings, etc.) and tightening the
# pattern set if needed.

set -euo pipefail

PATTERNS=(
  'console\.log\([^)]*x_payment'
  'console\.log\([^)]*authorization'
  'console\.log\([^)]*signedTx'
  'console\.log\([^)]*serializedTx'
  'console\.log\([^)]*x-payment'
)

FILES=(
  "src/inngest/utils/execute-x402.ts"
  "src/routes/execute.ts"
)

FAIL=0
for f in "${FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "FAIL: $f not found (script ran from wrong cwd?)"
    FAIL=1
    continue
  fi
  for p in "${PATTERNS[@]}"; do
    # Strip JS/TS comment lines before counting so the gate doesn't trip on
    # comments that mention the pattern (e.g. the deviation comments left
    # by the HIGH-01 fix explaining what NOT to log).
    # shellcheck disable=SC2002
    hits=$(cat "$f" | grep -v '^[[:space:]]*//' | grep -v '^[[:space:]]*\*' | grep -cE "$p" || true)
    if [ "$hits" -gt 0 ]; then
      echo "FAIL: $f matches forbidden pattern: $p (hits: $hits)"
      FAIL=1
    fi
  done
done

if [ "$FAIL" -eq 0 ]; then
  echo "OK: no payment-payload logs found in scoped files."
fi
exit "$FAIL"

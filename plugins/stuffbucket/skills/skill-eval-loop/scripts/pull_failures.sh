#!/bin/bash
# Dump failing tests from a promptfoo eval run.
#
# Usage:
#   ./pull_failures.sh <EVAL_ID>
#   ./pull_failures.sh            # most recent eval
#
# Outputs one block per failing test: description, assertion reason,
# and the first 800 chars of the model's output. Use this to categorize
# each failure as skill weakness / false positive / test design issue.

set -euo pipefail

if ! command -v promptfoo >/dev/null 2>&1; then
  echo "ERROR: promptfoo CLI not on PATH" >&2
  echo "Install with: npm install -g promptfoo" >&2
  exit 2
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "ERROR: sqlite3 not on PATH" >&2
  exit 2
fi

DB="${PROMPTFOO_DB:-$HOME/.promptfoo/promptfoo.db}"

if [[ ! -f "$DB" ]]; then
  echo "ERROR: promptfoo DB not found at $DB" >&2
  echo "Set PROMPTFOO_DB env var or run an eval first." >&2
  exit 1
fi

if [[ $# -ge 1 ]]; then
  EVAL_ID="$1"
else
  EVAL_ID=$(sqlite3 "$DB" "SELECT id FROM evals ORDER BY created_at DESC LIMIT 1;")
  if [[ -z "$EVAL_ID" ]]; then
    echo "ERROR: no evals found in $DB" >&2
    exit 1
  fi
  echo "# Using most recent eval: $EVAL_ID" >&2
fi

TOTAL=$(sqlite3 "$DB" "SELECT COUNT(*) FROM eval_results WHERE eval_id = '$EVAL_ID';")
FAILED=$(sqlite3 "$DB" "SELECT COUNT(*) FROM eval_results WHERE eval_id = '$EVAL_ID' AND success = 0;")

if [[ "$TOTAL" == "0" ]]; then
  echo "ERROR: no results found for eval ID '$EVAL_ID'" >&2
  echo "List recent evals with:" >&2
  echo "  sqlite3 $DB \"SELECT id, created_at FROM evals ORDER BY created_at DESC LIMIT 10;\"" >&2
  exit 1
fi

echo "# Eval: $EVAL_ID"
echo "# Total: $TOTAL  Failed: $FAILED"
echo ""

if [[ "$FAILED" == "0" ]]; then
  echo "# All tests passed. Nothing to pull."
  exit 0
fi

sqlite3 -separator $'\n---\n' "$DB" "
SELECT
  '## ' || COALESCE(json_extract(test_case, '\$.description'), '(no description)') || char(10) ||
  'Reason: ' || COALESCE(json_extract(grading_result, '\$.reason'), '(no reason)') || char(10) || char(10) ||
  'Output (first 800 chars):' || char(10) ||
  COALESCE(substr(json_extract(response, '\$.output'), 1, 800), '(no output)')
FROM eval_results
WHERE eval_id = '$EVAL_ID' AND success = 0
ORDER BY json_extract(test_case, '\$.description');
"

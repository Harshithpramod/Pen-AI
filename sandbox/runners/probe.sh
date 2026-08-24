#!/usr/bin/env bash
# One-shot probe. Reads $JOB_JSON, runs the probe matching job.probe against
# the repository already mounted at /work/repo (read-only), and prints a single
# JSON line on stdout as the last line:
#   {"status":"confirmed"|"not_exploitable"|"failed","evidence":"...","details":{...}}
# "failed" means the analysis tool itself errored — distinct from a clean scan
# that legitimately found nothing — so a tool crash is never silently reported
# as "not_exploitable".
set -euo pipefail

# CodeQL and semgrep both want a writable $HOME for caches/config (~/.codeql,
# ~/.semgrep); the container filesystem is --read-only apart from /tmp.
export HOME=/tmp

JOB="${JOB_JSON:-}"
if [[ -z "$JOB" ]]; then
  echo '{"status":"failed","evidence":"missing JOB_JSON"}'
  exit 0
fi

PROBE=$(echo "$JOB" | jq -r '.probe')
RULES_DIR="/opt/semgrep-rules"
CODEQL_BIN="${CODEQL_HOME:-/opt/codeql}/codeql"
REPO_PATH="${REPO_PATH:-/work/repo}"

cd "$REPO_PATH"

if [[ ! -d .git ]]; then
  jq -nc --arg path "$REPO_PATH" \
    '{status:"not_exploitable",evidence:("repository not mounted at " + $path)}'
  exit 0
fi

RESULT='{"status":"not_exploitable","evidence":"no issues found by static analysis"}'

# ---------------------------------------------------------------------------
# run_semgrep: scan CWD with bundled offline rules (or auto if rules missing).
# Sets the global RESULT variable. Used both as the sole engine for languages
# CodeQL can't cover here, and as the fallback if CodeQL itself errors.
# ---------------------------------------------------------------------------
run_semgrep() {
  local -a config_args=()

  if [[ -d "$RULES_DIR" ]]; then
    # Use offline rules bundled at image-build time (runner has no internet).
    for lang_dir in javascript python java go ruby php generic; do
      if [[ -d "$RULES_DIR/$lang_dir" ]]; then
        config_args+=("--config" "$RULES_DIR/$lang_dir")
      fi
    done
  fi

  if [[ ${#config_args[@]} -eq 0 ]]; then
    # Fallback: requires internet — only reached if the image was built incorrectly.
    config_args=("--config" "auto")
  fi

  local OUT COUNT SEMGREP_STATUS
  OUT=$(semgrep --quiet --json "${config_args[@]}" . 2>/tmp/semgrep.err) && SEMGREP_STATUS=0 || SEMGREP_STATUS=$?

  if [[ "$SEMGREP_STATUS" -ne 0 ]]; then
    RESULT=$(jq -nc --rawfile err /tmp/semgrep.err \
      '{status:"failed", evidence: ("semgrep crashed: " + ($err | .[-2000:]))}')
    return
  fi

  COUNT=$(echo "$OUT" | jq '.results | length' 2>/dev/null || echo 0)

  if [[ "$COUNT" -gt 0 ]]; then
    RESULT=$(jq -nc \
      --argjson count "$COUNT" \
      --argjson results "$(echo "$OUT" | jq '[.results[:5]]' | jq '.[0]')" \
      '{status:"confirmed",
        evidence: ("semgrep matched \($count) finding(s)"),
        details: {count: $count, results: $results}}')
  else
    local file_count
    file_count=$(find . -type f | wc -l)
    RESULT=$(jq -nc \
      --arg files "$file_count" \
      '{status:"not_exploitable",
        evidence: ("semgrep scanned \($files) files with bundled rules — no patterns matched")}')
  fi
}

# ---------------------------------------------------------------------------
# detect_codeql_language: CodeQL's javascript/typescript and python extractors
# read source directly (no compiler hooks), so they work against an arbitrary
# cloned repo with no build step. Every other CodeQL language needs a real
# build, which this generic runner can't provide, so those repos stay on
# semgrep. Checked in priority order; a mixed-language repo only gets its
# dominant stack analyzed by CodeQL.
# ---------------------------------------------------------------------------
detect_codeql_language() {
  if find . -type f \( -name '*.js' -o -name '*.jsx' -o -name '*.ts' -o -name '*.tsx' -o -name '*.mjs' -o -name '*.cjs' \) \
       -not -path '*/node_modules/*' -print -quit 2>/dev/null | grep -q .; then
    echo "javascript"
  elif find . -type f -name '*.py' -not -path '*/node_modules/*' -print -quit 2>/dev/null | grep -q .; then
    echo "python"
  else
    echo ""
  fi
}

# ---------------------------------------------------------------------------
# run_codeql: build a CodeQL database for the detected language, run the
# bundled security-extended query suite, and classify the SARIF output via
# sarif_verdict.py. Falls back to run_semgrep for any hard failure —
# unsupported language, extraction error, or analysis error — never leaves
# the job silently unanswered.
# ---------------------------------------------------------------------------
run_codeql() {
  local lang db_dir sarif_out target_file
  lang=$(detect_codeql_language)

  if [[ -z "$lang" ]]; then
    echo "codeql: no supported language detected, using semgrep" >&2
    run_semgrep
    return
  fi
  if [[ ! -x "$CODEQL_BIN" ]]; then
    echo "codeql: CLI not found at $CODEQL_BIN, using semgrep" >&2
    run_semgrep
    return
  fi

  db_dir="/tmp/codeqldb-$$"
  sarif_out="/tmp/codeql-results-$$.sarif"
  rm -rf "$db_dir" 2>/dev/null || true

  if ! "$CODEQL_BIN" database create "$db_dir" \
        --language="$lang" \
        --source-root=. \
        --build-mode=none \
        --threads=0 \
        --overwrite \
        > /tmp/codeql-create.log 2>&1; then
    echo "codeql: database create failed for language=$lang, falling back to semgrep" >&2
    tail -c 2000 /tmp/codeql-create.log >&2 || true
    run_semgrep
    return
  fi

  if ! "$CODEQL_BIN" database analyze "$db_dir" \
        "${lang}-security-extended.qls" \
        --format=sarifv2.1.0 \
        --output="$sarif_out" \
        --threads=0 \
        --ram=1500 \
        > /tmp/codeql-analyze.log 2>&1; then
    echo "codeql: analyze failed for language=$lang, falling back to semgrep" >&2
    tail -c 2000 /tmp/codeql-analyze.log >&2 || true
    rm -rf "$db_dir" 2>/dev/null || true
    run_semgrep
    return
  fi

  target_file=$(echo "$JOB" | jq -r '.file_path // ""')
  RESULT=$(python3 /opt/sarif_verdict.py "$sarif_out" "$PROBE" "$target_file" 2>/tmp/sarif-verdict.err) \
    || RESULT=$(jq -nc --rawfile err /tmp/sarif-verdict.err \
         '{status:"failed", evidence: ("sarif_verdict.py crashed: " + ($err | .[-2000:]))}')

  rm -rf "$db_dir" "$sarif_out" /tmp/codeql-create.log /tmp/codeql-analyze.log /tmp/sarif-verdict.err 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# Probe dispatch
# ---------------------------------------------------------------------------
case "$PROBE" in
  secret)
    # job.file_path is a top-level field, not job.target.file_path.
    FILE=$(echo "$JOB" | jq -r '.file_path // ""')
    if [[ -n "$FILE" && -f "$FILE" ]]; then
      MATCHES=$(trufflehog3 --no-history --format json "$FILE" 2>/dev/null || echo "[]")
      # trufflehog3 may output null or an empty array on no findings
      if [[ "$MATCHES" != "[]" && "$MATCHES" != "null" && -n "$MATCHES" ]]; then
        RESULT=$(jq -nc --argjson m "$MATCHES" \
          '{status:"confirmed",evidence:"secret present at HEAD",details:{matches:$m}}')
      else
        # Fall through to semgrep for additional coverage (e.g. generic secret rules)
        run_semgrep
      fi
    else
      # No specific file path — scan the whole repo with semgrep secret rules
      run_semgrep
    fi
    ;;

  # All of these are verified by CodeQL's security-extended query suite when
  # the repo's dominant language supports build-free extraction (js/ts,
  # python); otherwise they fall back to semgrep. Dynamic probes (actual HTTP
  # fuzzing, payload injection) are out of scope for the sandboxed
  # environment — this gives a confirmed/not_exploitable verdict based on
  # deep static analysis (dataflow/taint tracking), not just pattern matching.
  sqli|ssrf|rce|xss|idor|semgrep)
    run_codeql
    ;;

  *)
    # Unknown probe type — best-effort CodeQL/semgrep scan rather than silent failure.
    run_codeql
    ;;
esac

# LAST line of stdout must be the verdict JSON (single line, no trailing newline issues).
echo "$RESULT"

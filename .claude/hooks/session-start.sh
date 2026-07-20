#!/bin/bash
set -euo pipefail

# SessionStart hook: register the c8ctl "prod" profile from environment secrets.
#
# Security model: the client secret is NEVER written into the repo and NEVER
# printed. Values are read from environment variables that the Claude Code web
# environment injects (configure them under the environment's settings, not in
# chat). c8ctl stores the credential in its own session data; this script only
# references $CAMUNDA_* and suppresses c8ctl output so nothing leaks to the
# session transcript.

# Only run in the remote (Claude Code on the web) environment.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Ensure c8ctl is available (registry.npmjs.org is allowlisted).
if ! command -v c8ctl >/dev/null 2>&1; then
  npm install -g @camunda8/cli >/dev/null 2>&1
fi

# Only register the profile when the required secrets are present.
if [ -n "${CAMUNDA_CLIENT_ID:-}" ] && [ -n "${CAMUNDA_CLIENT_SECRET:-}" ]; then
  # Idempotent: drop any stale profile before re-adding (ignore if absent).
  c8ctl remove profile prod >/dev/null 2>&1 || true

  # Output suppressed so no credential material reaches the transcript.
  if c8ctl add profile prod \
      --baseUrl="${CAMUNDA_BASE_URL:-http://localhost:8080/v2}" \
      --clientId="$CAMUNDA_CLIENT_ID" \
      --clientSecret="$CAMUNDA_CLIENT_SECRET" >/dev/null 2>&1; then
    echo "c8ctl 'prod' profile registered from environment secrets."
  else
    echo "WARN: failed to register c8ctl 'prod' profile (check CAMUNDA_* env vars)."
  fi
else
  echo "CAMUNDA_CLIENT_ID / CAMUNDA_CLIENT_SECRET not set; skipping c8ctl profile setup."
fi

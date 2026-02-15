#!/usr/bin/env bash
# Syncs Granola access token from macOS desktop app to a target VM.
#
# The Granola desktop app manages token refresh. This script reads the
# current valid access token and pushes it to the VM's file-based
# credential store, so the CLI can use it without needing a keychain
# or its own refresh cycle.
#
# Usage:
#   ./scripts/sync-token.sh              # Sync to Vagrant VM (default)
#   ./scripts/sync-token.sh vagrant      # Explicit Vagrant target
#   ./scripts/sync-token.sh ssh user@host  # Any SSH-accessible host
#
# Cron (every hour):
#   0 * * * * /path/to/granola-cli/scripts/sync-token.sh vagrant

set -euo pipefail

SUPABASE_PATH="$HOME/Library/Application Support/Granola/supabase.json"
REMOTE_CREDS_DIR=".config/granola-cli"
REMOTE_CREDS_FILE="${REMOTE_CREDS_DIR}/credentials.json"

TARGET="${1:-vagrant}"

# --- Extract token from macOS desktop app ---

if [ ! -f "$SUPABASE_PATH" ]; then
  echo "Error: Granola desktop app not found at: $SUPABASE_PATH" >&2
  exit 1
fi

CREDS_JSON=$(python3 -c "
import json, sys

with open('''$SUPABASE_PATH''') as f:
    data = json.load(f)

if 'workos_tokens' in data:
    tokens = json.loads(data['workos_tokens'])
    creds = {
        'refreshToken': tokens.get('refresh_token', ''),
        'accessToken': tokens['access_token'],
        'clientId': tokens.get('client_id', 'client_GranolaMac'),
    }
elif 'cognito_tokens' in data:
    tokens = json.loads(data['cognito_tokens'])
    creds = {
        'refreshToken': tokens.get('refresh_token', ''),
        'accessToken': tokens.get('access_token', ''),
        'clientId': tokens.get('client_id', 'client_GranolaMac'),
    }
else:
    creds = {
        'refreshToken': data.get('refresh_token', ''),
        'accessToken': data.get('access_token', ''),
        'clientId': data.get('client_id', 'client_GranolaMac'),
    }

json.dump(creds, sys.stdout)
")

if [ -z "$CREDS_JSON" ]; then
  echo "Error: Failed to extract credentials from Granola desktop app" >&2
  exit 1
fi

# --- Push to target ---

push_credentials() {
  local ssh_cmd="$1"
  $ssh_cmd "mkdir -p ~/${REMOTE_CREDS_DIR} && cat > ~/${REMOTE_CREDS_FILE} && chmod 600 ~/${REMOTE_CREDS_FILE}" <<< "$CREDS_JSON"
}

case "$TARGET" in
  vagrant)
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    VAGRANT_DIR="${SCRIPT_DIR}/../vagrant"
    if [ ! -f "${VAGRANT_DIR}/Vagrantfile" ]; then
      echo "Error: No Vagrantfile found at ${VAGRANT_DIR}" >&2
      exit 1
    fi
    cd "$VAGRANT_DIR"
    push_credentials "vagrant ssh -c"
    echo "Synced Granola token to Vagrant VM"
    ;;
  ssh)
    SSH_TARGET="${2:?Usage: sync-token.sh ssh user@host}"
    push_credentials "ssh ${SSH_TARGET}"
    echo "Synced Granola token to ${SSH_TARGET}"
    ;;
  *)
    echo "Unknown target: $TARGET" >&2
    echo "Usage: sync-token.sh [vagrant|ssh user@host]" >&2
    exit 1
    ;;
esac

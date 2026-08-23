#!/usr/bin/env bash
# Restore a dump into the configured MySQL database (no GUI).
# Accepts the same files as Admin GUI: .sql.zip, .sql.gz, or .sql
# WARNING: replaces data in DB_NAME.
# Usage:
#   npm run db:restore -- ./backups/server.sql.zip
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

FILE="${1:-}"
if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo "Usage: npm run db:restore -- <path-to.sql.zip|.sql.gz|.sql>"
  exit 1
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:-family_tree}"

echo "Restoring $FILE → ${DB_NAME}@${DB_HOST}:${DB_PORT}"
echo "This OVERWRITES tables in ${DB_NAME}. Ctrl+C within 3s to abort…"
sleep 3

export MYSQL_PWD="$DB_PASSWORD"
MYSQL_ARGS=(-h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$DB_NAME")

lower="$(printf '%s' "$FILE" | tr '[:upper:]' '[:lower:]')"
case "$lower" in
  *.sql.zip|*.zip)
    if ! command -v unzip >/dev/null 2>&1; then
      echo "ERROR: butuh unzip untuk restore .zip"
      exit 1
    fi
    unzip -p "$FILE" | mysql "${MYSQL_ARGS[@]}"
    ;;
  *.sql.gz|*.gz)
    gunzip -c "$FILE" | mysql "${MYSQL_ARGS[@]}"
    ;;
  *.sql)
    mysql "${MYSQL_ARGS[@]}" < "$FILE"
    ;;
  *)
    echo "ERROR: ekstensi tidak dikenali (pakai .sql.zip, .sql.gz, atau .sql)"
    exit 1
    ;;
esac

echo "OK: restore selesai."

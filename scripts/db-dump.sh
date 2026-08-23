#!/usr/bin/env bash
# Dump full MySQL database to a compressed .sql.zip (same format as Admin GUI export).
# Usage:
#   npm run db:dump
#   npm run db:dump -- ./backups/server-$(date +%Y%m%d).sql.zip
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

OUT="${1:-./backups/db-dump-$(date +%Y%m%d-%H%M%S).sql.zip}"
mkdir -p "$(dirname "$OUT")"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:-family_tree}"

TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

SQL_NAME="family-tree.sql"
SQL_PATH="$TMP_DIR/$SQL_NAME"

echo "Dumping ${DB_NAME}@${DB_HOST}:${DB_PORT} → ${OUT}"

export MYSQL_PWD="$DB_PASSWORD"
mysqldump \
  -h "$DB_HOST" \
  -P "$DB_PORT" \
  -u "$DB_USER" \
  --single-transaction \
  --routines \
  --triggers \
  --set-gtid-purged=OFF \
  "$DB_NAME" > "$SQL_PATH"

# Prefer zip CLI; fallback to gzip (.sql.gz) if zip missing
if command -v zip >/dev/null 2>&1; then
  (cd "$TMP_DIR" && zip -q "$(basename "$OUT")" "$SQL_NAME")
  mv "$TMP_DIR/$(basename "$OUT")" "$OUT"
else
  GZ_OUT="${OUT%.sql.zip}.sql.gz"
  if [[ "$GZ_OUT" == "$OUT" ]]; then
    GZ_OUT="${OUT}.gz"
  fi
  gzip -c "$SQL_PATH" > "$GZ_OUT"
  echo "WARN: zip CLI tidak ada — menulis $GZ_OUT (masih bisa di-restore)."
  OUT="$GZ_OUT"
fi

echo "OK: $(wc -c < "$OUT" | tr -d ' ') bytes → $OUT"

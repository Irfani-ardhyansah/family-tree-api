#!/usr/bin/env bash
# Naik ke STB: build container, migration baru lewat entrypoint.
# Seeder tidak dijalankan. Nilai baru yang tetap (modul, status, jenis) lewat ENUM di migration.
# Usage (di folder repo, di STB, setelah git pull):
#   bash scripts/deploy.sh
#   npm run deploy
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="$ROOT_DIR/.env.docker"
EXAMPLE_FILE="$ROOT_DIR/.env.docker.example"
API_CONTAINER="family-suite-api"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[deploy] .env.docker belum ada. Sekali saja: cp .env.docker.example .env.docker" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "[deploy] docker tidak ada di PATH" >&2
  exit 1
fi

compose() {
  docker compose --env-file "$ENV_FILE" "$@"
}

# KEY from a dotenv file. Empty if missing. Strips one pair of quotes.
env_value() {
  local file="$1"
  local key="$2"
  local line val
  line="$(grep -E "^${key}=" "$file" | tail -n 1 || true)"
  line="${line%$'\r'}"
  val="${line#*=}"
  if [[ "$val" == \"*\" && "$val" == *\" ]]; then
    val="${val:1:$((${#val} - 2))}"
  elif [[ "$val" == \'*\' && "$val" == *\' ]]; then
    val="${val:1:$((${#val} - 2))}"
  fi
  printf '%s' "$val"
}

env_keys() {
  local file="$1"
  grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$file" | cut -d= -f1 | tr -d '\r' | sort -u
}

echo "[deploy] catatan belum shipped:"
pending_notes=(deploy/releases/pending/*.md)
if [[ -e "${pending_notes[0]}" ]]; then
  for note in "${pending_notes[@]}"; do
    echo "  - $note"
  done
else
  echo "  (tidak ada)"
fi

missing=()
while IFS= read -r key; do
  [[ -n "$key" ]] || continue
  if ! grep -qE "^${key}=" "$ENV_FILE"; then
    missing+=("$key")
  fi
done < <(env_keys "$EXAMPLE_FILE")

if ((${#missing[@]} > 0)); then
  echo "[deploy] .env.docker belum punya key dari .env.docker.example:" >&2
  for key in "${missing[@]}"; do
    echo "  - $key" >&2
  done
  echo "[deploy] tambahkan key itu, lalu jalankan ulang. Nilai contoh ada di .env.docker.example." >&2
  exit 1
fi

run_seed="$(env_value "$ENV_FILE" RUN_SEED)"
skip_migrate="$(env_value "$ENV_FILE" SKIP_MIGRATE)"

if [[ "$run_seed" == "true" ]]; then
  echo "[deploy] RUN_SEED=true menolak. Seeder dijalankan manual, bukan dari deploy." >&2
  echo "[deploy] set RUN_SEED=false. Seed demo menghapus data keluarga." >&2
  exit 1
fi

if [[ "$skip_migrate" == "true" ]]; then
  echo "[deploy] SKIP_MIGRATE=true menolak. Migration baru tidak akan jalan." >&2
  echo "[deploy] set SKIP_MIGRATE=false, lalu jalankan ulang." >&2
  exit 1
fi

api_is_running() {
  local id
  id="$(compose ps -q api 2>/dev/null || true)"
  [[ -n "$id" ]] || return 1
  local running
  running="$(docker inspect -f '{{.State.Running}}' "$id" 2>/dev/null || echo false)"
  [[ "$running" == "true" ]]
}

# Prints applied migration stems (no extension), one per line. Fails if API is down.
applied_migration_stems() {
  compose exec -T api node <<'NODE'
const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'db',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'family_tree',
    ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  const [tables] = await conn.query("SHOW TABLES LIKE 'knex_migrations'");
  if (!Array.isArray(tables) || tables.length === 0) {
    await conn.end();
    return;
  }
  const [rows] = await conn.query('SELECT name FROM knex_migrations');
  for (const row of rows) {
    console.log(String(row.name).replace(/\.js$/, ''));
  }
  await conn.end();
})().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
NODE
}

pending_migration_count() {
  local applied
  applied="$(mktemp)"
  # shellcheck disable=SC2064
  trap "rm -f '$applied'" RETURN
  if ! applied_migration_stems | tr -d '\r' | sort -u >"$applied"; then
    echo "unknown"
    return 0
  fi
  local f base
  for f in "$ROOT_DIR"/src/database/migrations/*.ts; do
    [[ -e "$f" ]] || continue
    base="$(basename "$f" .ts)"
    printf '%s\n' "$base"
  done | sort -u | comm -23 - "$applied" | wc -l | tr -d ' '
}

if api_is_running; then
  mig_count="$(pending_migration_count)"
  if [[ "$mig_count" == "unknown" ]]; then
    echo "[deploy] migration: tidak bisa dicek sekarang — tetap jalan saat container start"
  elif [[ "$mig_count" == "0" ]]; then
    echo "[deploy] migration baru: tidak ada"
  else
    echo "[deploy] migration baru: ${mig_count} — jalan saat container start"
  fi
else
  echo "[deploy] migration: database/API belum jalan — dicek saat container start"
fi

echo "[deploy] docker compose up -d --build"
compose up -d --build

echo "[deploy] menunggu API sehat..."
healthy=0
for _ in $(seq 1 120); do
  status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$API_CONTAINER" 2>/dev/null || echo missing)"
  if [[ "$status" == "healthy" ]]; then
    healthy=1
    break
  fi
  if [[ "$status" == "unhealthy" ]]; then
    break
  fi
  sleep 2
done

if [[ "$healthy" != "1" ]]; then
  echo "[deploy] API tidak sehat. Log:" >&2
  compose logs --tail=120 api >&2 || true
  exit 1
fi

echo "[deploy] health ok"
echo "[deploy] selesai. Seeder tidak dijalankan. Jalankan bagian \"Cek setelah naik\" di catatan pending, lalu pindah ke shipped dari laptop setelah kamu yakin STB sehat."

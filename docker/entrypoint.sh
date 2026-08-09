#!/bin/sh
set -eu

echo "[family-suite-api] waiting for database ${DB_HOST:-localhost}:${DB_PORT:-3306}..."

node <<'NODE'
const mysql = require('mysql2/promise');

const host = process.env.DB_HOST || 'localhost';
const port = Number(process.env.DB_PORT || 3306);
const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || '';
const database = process.env.DB_NAME || 'family_tree';
const useSsl = (process.env.DB_SSL || 'false') === 'true';

async function waitForDb() {
  const started = Date.now();
  const timeoutMs = Number(process.env.DB_WAIT_TIMEOUT_MS || 120000);

  while (Date.now() - started < timeoutMs) {
    try {
      const conn = await mysql.createConnection({
        host,
        port,
        user,
        password,
        database,
        ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
      });
      await conn.ping();
      await conn.end();
      console.log('[family-suite-api] database is ready');
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`[family-suite-api] db not ready yet: ${message}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.error('[family-suite-api] timed out waiting for database');
  process.exit(1);
}

waitForDb();
NODE

KNEX_ENV="${KNEX_ENV:-production}"

echo "[family-suite-api] running migrations (${KNEX_ENV})..."
npx knex migrate:latest --knexfile knexfile.docker.js --env "$KNEX_ENV"

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "[family-suite-api] running seeds..."
  npx knex seed:run --knexfile knexfile.docker.js --env "$KNEX_ENV"
fi

echo "[family-suite-api] starting server..."
exec node dist/server.js

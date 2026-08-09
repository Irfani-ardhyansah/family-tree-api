/**
 * Knex config for Docker/runtime — uses compiled JS under dist/
 * (avoids ts-node inside the production image).
 */
require('dotenv').config();

const useSsl =
  (process.env.DB_SSL ??
    ((process.env.NODE_ENV || 'development') === 'production' ? 'true' : 'false')) === 'true';

const shared = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'family_tree',
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  },
  migrations: {
    directory: './dist/database/migrations',
    extension: 'js',
  },
  seeds: {
    directory: './dist/database/seeds',
    extension: 'js',
  },
};

module.exports = {
  development: shared,
  production: shared,
};

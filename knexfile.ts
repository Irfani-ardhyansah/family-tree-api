import type { Knex } from 'knex';
import dotenv from 'dotenv';

dotenv.config();

const useSsl =
  (process.env.DB_SSL ??
    ((process.env.NODE_ENV || 'development') === 'production' ? 'true' : 'false')) === 'true';

const shared = {
  client: 'mysql2' as const,
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'family_tree',
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  },
  migrations: {
    directory: './src/database/migrations',
    extension: 'ts',
  },
  seeds: {
    directory: './src/database/seeds',
    extension: 'ts',
  },
};

const config: { [key: string]: Knex.Config } = {
  development: {
    ...shared,
  },
  production: {
    ...shared,
  },
};

module.exports = config;

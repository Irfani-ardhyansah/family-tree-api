import type { Knex } from 'knex';
import dotenv from 'dotenv';

dotenv.config();

const shared = {
  client: 'mysql2' as const,
  connection: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'family_tree',
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
    connection: {
      ...shared.connection,
      ssl: { rejectUnauthorized: false },
    },
  },
};

module.exports = config;

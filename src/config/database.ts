import knex, { Knex } from 'knex';
import { env } from './env';

const config: Knex.Config = {
  client: 'mysql2',
  connection: {
    host: env.db.host,
    user: env.db.user,
    password: env.db.password,
    database: env.db.name,
    ...(env.isProduction ? { ssl: { rejectUnauthorized: false } } : {}),
  },
  pool: {
    min: 0,
    max: 10,
  },
};

export const db = knex(config);

export default db;

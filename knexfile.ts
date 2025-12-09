import type { Knex } from "knex";
import dotenv from 'dotenv';

dotenv.config();
// Update with your config settings.

const config: { [key: string]: Knex.Config } = {
  development: {
    client: "mysql2",
    connection: {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME 
    },
    migrations: {
      directory: "./src/database/migrations",
      extension: "ts"
    }
  },

  production: {
    client: "mysql2",
    connection: {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: { rejectUnauthorized: false } 
    },
    migrations: {
      directory: "./src/database/migrations",
      extension: "ts"
    }
  }

};

module.exports = config;

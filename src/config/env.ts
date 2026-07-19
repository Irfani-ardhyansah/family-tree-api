import dotenv from 'dotenv';

dotenv.config();

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    return fallback;
  }
  return value;
}

function requiredInProduction(name: string, fallback: string): string {
  const value = process.env[name];
  if (value !== undefined && value !== '') {
    return value;
  }

  if ((process.env.NODE_ENV || 'development') === 'production') {
    throw new Error(`Missing required env: ${name}`);
  }

  return fallback;
}

const nodeEnv = optional('NODE_ENV', 'development');
const isProduction = nodeEnv === 'production';

const corsOrigins = optional('CORS_ORIGINS', '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const jwtSecret = requiredInProduction('JWT_SECRET', 'dev-only-change-me');

if (isProduction && jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production');
}

if (isProduction && corsOrigins.includes('*')) {
  throw new Error('CORS_ORIGINS must list explicit FE origins in production (no *)');
}

export const env = {
  nodeEnv,
  isProduction,
  port: Number(optional('PORT', '3000')),
  db: {
    host: optional('DB_HOST', 'localhost'),
    user: optional('DB_USER', 'root'),
    password: process.env.DB_PASSWORD ?? '',
    name: optional('DB_NAME', 'family_tree'),
    /** Equivalent DSN: mysql://user:pass@host:3306/dbname */
    get dsn(): string {
      const auth = this.password ? `${this.user}:${this.password}` : this.user;
      return `mysql://${auth}@${this.host}:3306/${this.name}`;
    },
  },
  corsOrigins,
  jwtSecret,
  accessTtlSeconds: Number(optional('ACCESS_TTL', '3600')),
  refreshTtlRememberSeconds: Number(optional('REFRESH_TTL_REMEMBER', '2592000')),
  refreshTtlSessionSeconds: Number(optional('REFRESH_TTL_SESSION', '86400')),
  loginRateLimitMax: Number(optional('LOGIN_RATE_LIMIT_MAX', '10')),
  loginRateLimitWindowMs: Number(optional('LOGIN_RATE_LIMIT_WINDOW_MS', String(15 * 60 * 1000))),
} as const;

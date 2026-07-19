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

export const env = {
  nodeEnv,
  isProduction,
  port: Number(optional('PORT', '3000')),
  db: {
    host: optional('DB_HOST', 'localhost'),
    user: optional('DB_USER', 'root'),
    password: process.env.DB_PASSWORD ?? '',
    name: optional('DB_NAME', 'family_tree'),
  },
  corsOrigins: optional('CORS_ORIGINS', '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwtSecret: requiredInProduction('JWT_SECRET', 'dev-only-change-me'),
  accessTtlSeconds: Number(optional('ACCESS_TTL', '3600')),
  refreshTtlRememberSeconds: Number(optional('REFRESH_TTL_REMEMBER', '2592000')),
  refreshTtlSessionSeconds: Number(optional('REFRESH_TTL_SESSION', '86400')),
} as const;

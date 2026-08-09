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
    port: Number(optional('DB_PORT', '3306')),
    user: optional('DB_USER', 'root'),
    password: process.env.DB_PASSWORD ?? '',
    name: optional('DB_NAME', 'family_tree'),
    /**
     * MySQL TLS. Default on in production (cloud), off otherwise.
     * Homelab / Docker local MySQL: set DB_SSL=false.
     */
    ssl: optional('DB_SSL', isProduction ? 'true' : 'false') === 'true',
    /** Equivalent DSN: mysql://user:pass@host:port/dbname */
    get dsn(): string {
      const auth = this.password ? `${this.user}:${this.password}` : this.user;
      return `mysql://${auth}@${this.host}:${this.port}/${this.name}`;
    },
  },
  corsOrigins,
  jwtSecret,
  accessTtlSeconds: Number(optional('ACCESS_TTL', '3600')),
  refreshTtlRememberSeconds: Number(optional('REFRESH_TTL_REMEMBER', '2592000')),
  refreshTtlSessionSeconds: Number(optional('REFRESH_TTL_SESSION', '86400')),
  loginRateLimitMax: Number(optional('LOGIN_RATE_LIMIT_MAX', '10')),
  loginRateLimitWindowMs: Number(optional('LOGIN_RATE_LIMIT_WINDOW_MS', String(15 * 60 * 1000))),
  media: {
    /** Absolute or relative dir for uploaded files (local disk adapter). */
    storageDir: optional('MEDIA_STORAGE_DIR', './uploads/media'),
    /**
     * Public base URL for `<img src>` (no trailing slash).
     * Default serves via Express static at `/media`.
     */
    publicBaseUrl: optional('MEDIA_PUBLIC_BASE_URL', `http://localhost:${optional('PORT', '3000')}/media`),
    maxFileBytes: Number(optional('MEDIA_MAX_FILE_BYTES', String(5 * 1024 * 1024))),
    /** Pending media older than this are purged by the TTL job. */
    pendingTtlMs: Number(optional('MEDIA_PENDING_TTL_MS', String(24 * 60 * 60 * 1000))),
    ttlIntervalMs: Number(optional('MEDIA_TTL_INTERVAL_MS', String(60 * 60 * 1000))),
  },
  /**
   * Web Push (VAPID). If public/private kosong di non-production → push no-op.
   * Generate: `npx web-push generate-vapid-keys`
   */
  webPush: {
    publicKey: optional('VAPID_PUBLIC_KEY', ''),
    privateKey: optional('VAPID_PRIVATE_KEY', ''),
    subject: optional('VAPID_SUBJECT', 'mailto:admin@familyroots.local'),
  },
  /** Unlock TTL setelah verifikasi password kedua (detik). Default 15 menit. */
  secondaryUnlockTtlSeconds: Number(optional('SECONDARY_UNLOCK_TTL', '900')),
} as const;

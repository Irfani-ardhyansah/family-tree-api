import cors, { CorsOptions } from 'cors';
import { env } from './env';

function uniqueOrigins(origins: string[]): string[] {
  return [...new Set(origins.filter(Boolean))];
}

function resolveAllowedOrigins(): string[] | '*' {
  const merged = uniqueOrigins([...env.corsOrigins, ...env.analytics.corsOrigins]);
  if (merged.includes('*')) {
    return '*';
  }
  return merged;
}

export function createCorsMiddleware() {
  const allowed = resolveAllowedOrigins();

  const options: CorsOptions = {
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-Id',
      'X-Session-Id',
      'X-Module-Unlock',
    ],
    exposedHeaders: ['X-Request-Id'],
    credentials: true,
    optionsSuccessStatus: 204,
  };

  if (allowed === '*') {
    if (env.isProduction) {
      throw new Error('CORS_ORIGINS cannot be * in production');
    }
    options.origin = true;
  } else {
    options.origin = (origin, callback) => {
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin not allowed: ${origin}`));
    };
  }

  return cors(options);
}

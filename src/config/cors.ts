import cors, { CorsOptions } from 'cors';
import { env } from './env';

function resolveAllowedOrigins(): string[] | '*' {
  if (env.corsOrigins.includes('*')) {
    return '*';
  }
  return env.corsOrigins;
}

export function createCorsMiddleware() {
  const allowed = resolveAllowedOrigins();

  const options: CorsOptions = {
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
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

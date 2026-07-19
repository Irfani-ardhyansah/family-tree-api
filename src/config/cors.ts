import cors from 'cors';
import { env } from './env';

export function createCorsMiddleware() {
  const origins = env.corsOrigins;

  return cors({
    origin: env.isProduction
      ? (origins.includes('*') ? false : origins)
      : origins.includes('*')
        ? true
        : origins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
}

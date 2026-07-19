import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { createCorsMiddleware } from './config/cors';
import { env } from './config/env';
import authRoutes from './modules/auth/auth.routes';
import healthRoutes from './modules/health/health.routes';
import logsRoutes from './modules/logs/logs.routes';
import { errorHandler, notFoundHandler } from './shared/errors/errorHandler';
import {
  httpAuditLogMiddleware,
  requestContextMiddleware,
} from './shared/middleware';
import {
  apiVersionHeader,
  responseHeadersMiddleware,
} from './shared/middleware/responseHeaders.middleware';

export function createApp() {
  const app = express();

  app.set('trust proxy', true);
  app.use(helmet());
  app.use(createCorsMiddleware());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(requestContextMiddleware);
  app.use(responseHeadersMiddleware);
  app.use(apiVersionHeader);
  app.use(httpAuditLogMiddleware);

  if (!env.isProduction) {
    app.use(morgan('dev'));
  }

  app.get('/', (_req, res) => {
    res.status(200).json({
      data: {
        name: 'Family Tree API',
        version: 'v1',
      },
    });
  });

  app.use('/api/v1/health', healthRoutes);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/logs', logsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { createCorsMiddleware } from './config/cors';
import { env } from './config/env';
import healthRoutes from './modules/health/health.routes';
import { errorHandler, notFoundHandler } from './shared/errors/errorHandler';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(createCorsMiddleware());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

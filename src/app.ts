import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { createCorsMiddleware } from './config/cors';
import { env } from './config/env';
import adminRoutes from './modules/core/admin/admin.routes';
import authRoutes from './modules/core/auth/auth.routes';
import healthRoutes from './modules/core/health/health.routes';
import logsRoutes from './modules/core/logs/logs.routes';
import mediaRoutes from './modules/core/media/media.routes';
import notificationsRoutes from './modules/core/notifications/notifications.routes';
import pushRoutes from './modules/core/push/push.routes';
import { mediaStorage } from './modules/core/media/media.storage';
import dashboardRoutes from './modules/family-roots/dashboard/dashboard.routes';
import eventsRoutes from './modules/family-roots/events/events.routes';
import memoriamRoutes from './modules/family-roots/memoriam/memoriam.routes';
import personsRoutes from './modules/family-roots/persons/persons.routes';
import moneyRoutes from './modules/money-track/money.routes';
import fcRoutes from './modules/family-core/fc.routes';
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
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
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

  // Public media files (local disk adapter). URLs: MEDIA_PUBLIC_BASE_URL/{storageKey}
  void mediaStorage.ensureReady();
  app.use('/media', express.static(mediaStorage.getStaticRoot(), {
    fallthrough: true,
    maxAge: env.isProduction ? '7d' : 0,
  }));

  app.get('/', (_req, res) => {
    res.status(200).json({
      data: {
        name: 'Family Roots API',
        version: 'v1',
      },
    });
  });

  app.use('/api/v1/health', healthRoutes);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/notifications', notificationsRoutes);
  app.use('/api/v1/push', pushRoutes);
  app.use('/api/v1/logs', logsRoutes);
  app.use('/api/v1/persons', personsRoutes);
  app.use('/api/v1/events', eventsRoutes);
  app.use('/api/v1/memoriam', memoriamRoutes);
  app.use('/api/v1/media', mediaRoutes);
  app.use('/api/v1/dashboard', dashboardRoutes);
  app.use('/api/v1/money', moneyRoutes);
  app.use('/api/v1/fc', fcRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

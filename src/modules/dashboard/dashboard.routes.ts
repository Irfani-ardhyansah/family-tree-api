import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/requireAuth.middleware';
import { resolveReadFocusMiddleware } from '../persons/read-focus.middleware';
import { dashboardController } from './dashboard.controller';

const dashboardRoutes = Router();

dashboardRoutes.use(requireAuth);

dashboardRoutes.get('/', resolveReadFocusMiddleware, (req, res, next) => {
  void dashboardController.get(req, res, next);
});

export default dashboardRoutes;

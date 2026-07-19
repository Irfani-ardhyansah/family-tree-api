import { Router } from 'express';
import { optionalAuth } from '../../shared/middleware/optionalAuth.middleware';
import { logsController } from './logs.controller';

const logsRoutes = Router();

logsRoutes.post('/events', optionalAuth, (req, res, next) => {
  void logsController.trackEvent(req, res, next);
});

export default logsRoutes;

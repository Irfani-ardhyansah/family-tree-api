import { Router } from 'express';
import { requireAuth } from '../../../shared/middleware/requireAuth.middleware';
import { notificationsController } from './notifications.controller';

const notificationsRoutes = Router();

notificationsRoutes.use(requireAuth);

notificationsRoutes.get('/', (req, res, next) => {
  void notificationsController.list(req, res, next);
});

notificationsRoutes.get('/unread-count', (req, res, next) => {
  void notificationsController.unreadCount(req, res, next);
});

notificationsRoutes.patch('/:id/read', (req, res, next) => {
  void notificationsController.markRead(req, res, next);
});

notificationsRoutes.post('/read-all', (req, res, next) => {
  void notificationsController.markAllRead(req, res, next);
});

export default notificationsRoutes;

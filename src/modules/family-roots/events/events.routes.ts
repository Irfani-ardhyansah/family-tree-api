import { Router } from 'express';
import { requireAuth } from '../../../shared/middleware/requireAuth.middleware';
import { resolveReadFocusMiddleware } from '../persons/read-focus.middleware';
import { eventsController } from './events.controller';

const eventsRoutes = Router();

eventsRoutes.use(requireAuth);

eventsRoutes.get('/', resolveReadFocusMiddleware, (req, res, next) => {
  void eventsController.list(req, res, next);
});

eventsRoutes.get('/:id', resolveReadFocusMiddleware, (req, res, next) => {
  void eventsController.getById(req, res, next);
});

eventsRoutes.post('/', resolveReadFocusMiddleware, (req, res, next) => {
  void eventsController.create(req, res, next);
});

eventsRoutes.patch('/:id', resolveReadFocusMiddleware, (req, res, next) => {
  void eventsController.update(req, res, next);
});

eventsRoutes.delete('/:id', resolveReadFocusMiddleware, (req, res, next) => {
  void eventsController.remove(req, res, next);
});

eventsRoutes.post('/:id/contributions', resolveReadFocusMiddleware, (req, res, next) => {
  void eventsController.addContribution(req, res, next);
});

export default eventsRoutes;

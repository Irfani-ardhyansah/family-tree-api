import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/requireAuth.middleware';
import { resolveReadFocusMiddleware } from '../persons/read-focus.middleware';
import { memoriamController } from './memoriam.controller';

const memoriamRoutes = Router();

memoriamRoutes.use(requireAuth);

memoriamRoutes.get('/deceased', resolveReadFocusMiddleware, (req, res, next) => {
  void memoriamController.listDeceased(req, res, next);
});

memoriamRoutes.get('/:deceasedId/tributes', resolveReadFocusMiddleware, (req, res, next) => {
  void memoriamController.listTributes(req, res, next);
});

memoriamRoutes.post('/:deceasedId/tributes', resolveReadFocusMiddleware, (req, res, next) => {
  void memoriamController.createTribute(req, res, next);
});

memoriamRoutes.get('/:deceasedId/prayers/me', resolveReadFocusMiddleware, (req, res, next) => {
  void memoriamController.getPrayerMe(req, res, next);
});

memoriamRoutes.get('/:deceasedId/prayers', resolveReadFocusMiddleware, (req, res, next) => {
  void memoriamController.listPrayers(req, res, next);
});

memoriamRoutes.post('/:deceasedId/prayers', resolveReadFocusMiddleware, (req, res, next) => {
  void memoriamController.recordPrayer(req, res, next);
});

memoriamRoutes.get('/:deceasedId', resolveReadFocusMiddleware, (req, res, next) => {
  void memoriamController.getDeceasedById(req, res, next);
});

export default memoriamRoutes;

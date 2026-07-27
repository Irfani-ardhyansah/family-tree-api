import { Router } from 'express';
import { requireAuth } from '../../../shared/middleware/requireAuth.middleware';
import { pushController } from './push.controller';

const pushRoutes = Router();

/** Public key boleh tanpa auth — FE butuh sebelum subscribe. */
pushRoutes.get('/vapid-public-key', (req, res, next) => {
  void pushController.getVapidPublicKey(req, res, next);
});

pushRoutes.post('/subscriptions', requireAuth, (req, res, next) => {
  void pushController.subscribe(req, res, next);
});

pushRoutes.delete('/subscriptions', requireAuth, (req, res, next) => {
  void pushController.unsubscribe(req, res, next);
});

export default pushRoutes;

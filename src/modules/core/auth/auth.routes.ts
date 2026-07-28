import { Router } from 'express';
import { loginRateLimitMiddleware } from '../../../shared/middleware/loginRateLimit.middleware';
import { requireAuth } from '../../../shared/middleware/requireAuth.middleware';
import { authController } from './auth.controller';

const authRoutes = Router();

authRoutes.post('/login', loginRateLimitMiddleware, (req, res, next) => {
  void authController.login(req, res, next);
});

authRoutes.post('/refresh', (req, res, next) => {
  void authController.refresh(req, res, next);
});

authRoutes.post('/logout', requireAuth, (req, res, next) => {
  void authController.logout(req, res, next);
});

authRoutes.get('/me', requireAuth, (req, res, next) => {
  void authController.me(req, res, next);
});

authRoutes.get('/me/options', requireAuth, (req, res, next) => {
  void authController.getOptions(req, res, next);
});

authRoutes.patch('/me/options', requireAuth, (req, res, next) => {
  void authController.upsertOption(req, res, next);
});

authRoutes.post('/secondary-password/setup', requireAuth, (req, res, next) => {
  void authController.setupSecondaryPassword(req, res, next);
});

authRoutes.post('/secondary-password/verify', requireAuth, (req, res, next) => {
  void authController.verifySecondaryPassword(req, res, next);
});

authRoutes.post('/secondary-password/change', requireAuth, (req, res, next) => {
  void authController.changeSecondaryPassword(req, res, next);
});

export default authRoutes;

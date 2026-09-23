import { Router } from 'express';
import { loginRateLimitMiddleware } from '../../../shared/middleware/loginRateLimit.middleware';
import { requireAuth } from '../../../shared/middleware/requireAuth.middleware';
import { authController } from './auth.controller';
import { webauthnController } from './webauthn/webauthn.controller';

const authRoutes = Router();

authRoutes.post('/login', loginRateLimitMiddleware, (req, res, next) => {
  void authController.login(req, res, next);
});

authRoutes.post('/webauthn/login/options', loginRateLimitMiddleware, (req, res, next) => {
  void webauthnController.loginOptions(req, res, next);
});

authRoutes.post('/webauthn/login/verify', loginRateLimitMiddleware, (req, res, next) => {
  void webauthnController.loginVerify(req, res, next);
});

authRoutes.post('/webauthn/register/options', requireAuth, (req, res, next) => {
  void webauthnController.registerOptions(req, res, next);
});

authRoutes.post('/webauthn/register/verify', requireAuth, (req, res, next) => {
  void webauthnController.registerVerify(req, res, next);
});

authRoutes.get('/webauthn/credentials', requireAuth, (req, res, next) => {
  void webauthnController.listOwn(req, res, next);
});

authRoutes.patch('/webauthn/credentials/:id', requireAuth, (req, res, next) => {
  void webauthnController.updateOwn(req, res, next);
});

authRoutes.delete('/webauthn/credentials/:id', requireAuth, (req, res, next) => {
  void webauthnController.deleteOwn(req, res, next);
});

authRoutes.post('/webauthn/unlock/options', requireAuth, (req, res, next) => {
  void webauthnController.unlockOptions(req, res, next);
});

authRoutes.post('/webauthn/unlock/verify', requireAuth, (req, res, next) => {
  void webauthnController.unlockVerify(req, res, next);
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

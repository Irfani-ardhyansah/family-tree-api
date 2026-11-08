import { Router } from 'express';
import { loginRateLimitMiddleware } from '../../../shared/middleware/loginRateLimit.middleware';
import { requireAuth, requireSessionAuth } from '../../../shared/middleware/requireAuth.middleware';
import { authController } from './auth.controller';
import { mcpTokenController } from './mcp-tokens/mcp-token.controller';
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

authRoutes.post('/webauthn/register/options', requireSessionAuth, (req, res, next) => {
  void webauthnController.registerOptions(req, res, next);
});

authRoutes.post('/webauthn/register/verify', requireSessionAuth, (req, res, next) => {
  void webauthnController.registerVerify(req, res, next);
});

authRoutes.get('/webauthn/credentials', requireSessionAuth, (req, res, next) => {
  void webauthnController.listOwn(req, res, next);
});

authRoutes.patch('/webauthn/credentials/:id', requireSessionAuth, (req, res, next) => {
  void webauthnController.updateOwn(req, res, next);
});

authRoutes.delete('/webauthn/credentials/:id', requireSessionAuth, (req, res, next) => {
  void webauthnController.deleteOwn(req, res, next);
});

authRoutes.post('/webauthn/unlock/options', requireSessionAuth, (req, res, next) => {
  void webauthnController.unlockOptions(req, res, next);
});

authRoutes.post('/webauthn/unlock/verify', requireSessionAuth, (req, res, next) => {
  void webauthnController.unlockVerify(req, res, next);
});

authRoutes.post('/refresh', (req, res, next) => {
  void authController.refresh(req, res, next);
});

authRoutes.post('/logout', requireSessionAuth, (req, res, next) => {
  void authController.logout(req, res, next);
});

authRoutes.get('/me', requireAuth, (req, res, next) => {
  void authController.me(req, res, next);
});

authRoutes.get('/me/options', requireAuth, (req, res, next) => {
  void authController.getOptions(req, res, next);
});

authRoutes.patch('/me/options', requireSessionAuth, (req, res, next) => {
  void authController.upsertOption(req, res, next);
});

authRoutes.post('/secondary-password/setup', requireSessionAuth, (req, res, next) => {
  void authController.setupSecondaryPassword(req, res, next);
});

authRoutes.post('/secondary-password/verify', requireSessionAuth, (req, res, next) => {
  void authController.verifySecondaryPassword(req, res, next);
});

authRoutes.post('/secondary-password/change', requireSessionAuth, (req, res, next) => {
  void authController.changeSecondaryPassword(req, res, next);
});

// Token MCP: hanya bisa dibuat/dihapus dari sesi aplikasi, bukan dari token MCP.
authRoutes.get('/mcp-tokens', requireSessionAuth, (req, res, next) => {
  void mcpTokenController.listOwn(req, res, next);
});

authRoutes.post('/mcp-tokens', requireSessionAuth, (req, res, next) => {
  void mcpTokenController.create(req, res, next);
});

authRoutes.delete('/mcp-tokens/:id', requireSessionAuth, (req, res, next) => {
  void mcpTokenController.revokeOwn(req, res, next);
});

export default authRoutes;

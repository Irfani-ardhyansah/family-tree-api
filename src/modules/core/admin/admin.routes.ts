import { Router } from 'express';
import { requireAuth } from '../../../shared/middleware/requireAuth.middleware';
import { requireAdmin } from '../../../shared/middleware/requireAdmin.middleware';
import { mediaUploadMiddleware } from '../media/media.upload.middleware';
import { adminController } from './admin.controller';

const adminRoutes = Router();

adminRoutes.use(requireAuth);
adminRoutes.use((req, res, next) => {
  void requireAdmin(req, res, next);
});

adminRoutes.get('/dashboard', (req, res, next) => {
  void adminController.getDashboard(req, res, next);
});

adminRoutes.get('/modules/status', (req, res, next) => {
  void adminController.listModuleStatuses(req, res, next);
});

adminRoutes.patch('/modules/:moduleId/status', (req, res, next) => {
  void adminController.toggleModuleStatus(req, res, next);
});

adminRoutes.get('/audit-logs', (req, res, next) => {
  void adminController.listAuditLogs(req, res, next);
});

adminRoutes.get('/audit-logs/:id', (req, res, next) => {
  void adminController.getAuditLog(req, res, next);
});

adminRoutes.get('/sessions', (req, res, next) => {
  void adminController.listSessions(req, res, next);
});

adminRoutes.post('/sessions/:sessionId/revoke', (req, res, next) => {
  void adminController.revokeSession(req, res, next);
});

adminRoutes.get('/users', (req, res, next) => {
  void adminController.listUsers(req, res, next);
});

adminRoutes.get('/broadcasts', (req, res, next) => {
  void adminController.listBroadcasts(req, res, next);
});

adminRoutes.post('/broadcasts', (req, res, next) => {
  void adminController.createBroadcast(req, res, next);
});

adminRoutes.get('/settings', (req, res, next) => {
  void adminController.getSettings(req, res, next);
});

adminRoutes.put('/settings', (req, res, next) => {
  void adminController.updateSettings(req, res, next);
});

adminRoutes.post('/settings/logo', mediaUploadMiddleware, (req, res, next) => {
  void adminController.uploadLogo(req, res, next);
});

adminRoutes.get('/backups', (req, res, next) => {
  void adminController.listBackups(req, res, next);
});

adminRoutes.get('/backups/:id', (req, res, next) => {
  void adminController.getBackup(req, res, next);
});

adminRoutes.post('/backups', (req, res, next) => {
  void adminController.createBackup(req, res, next);
});

export default adminRoutes;

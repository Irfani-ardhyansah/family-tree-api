import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/requireAuth.middleware';
import { requireModuleUnlock } from '../../shared/middleware/requireModuleUnlock.middleware';
import { calendarEventTypesController } from './calendar-event-types/calendar-event-types.controller';
import { documentTypesController } from './document-types/document-types.controller';
import { documentsController } from './documents/documents.controller';
import { membersController } from './members/members.controller';

const fcRoutes = Router();

fcRoutes.use(requireAuth);
fcRoutes.use(requireModuleUnlock('core'));

fcRoutes.get('/members', (req, res, next) => {
  void membersController.list(req, res, next);
});

fcRoutes.get('/document-types', (req, res, next) => {
  void documentTypesController.list(req, res, next);
});
fcRoutes.post('/document-types', (req, res, next) => {
  void documentTypesController.create(req, res, next);
});
fcRoutes.patch('/document-types/:id', (req, res, next) => {
  void documentTypesController.update(req, res, next);
});
fcRoutes.delete('/document-types/:id', (req, res, next) => {
  void documentTypesController.remove(req, res, next);
});

fcRoutes.get('/calendar-event-types', (req, res, next) => {
  void calendarEventTypesController.list(req, res, next);
});
fcRoutes.post('/calendar-event-types', (req, res, next) => {
  void calendarEventTypesController.create(req, res, next);
});
fcRoutes.patch('/calendar-event-types/:id', (req, res, next) => {
  void calendarEventTypesController.update(req, res, next);
});
fcRoutes.delete('/calendar-event-types/:id', (req, res, next) => {
  void calendarEventTypesController.remove(req, res, next);
});

fcRoutes.get('/documents/reminders', (req, res, next) => {
  void documentsController.reminders(req, res, next);
});
fcRoutes.get('/documents', (req, res, next) => {
  void documentsController.list(req, res, next);
});
fcRoutes.get('/documents/:id', (req, res, next) => {
  void documentsController.getById(req, res, next);
});
fcRoutes.post('/documents', (req, res, next) => {
  void documentsController.create(req, res, next);
});
fcRoutes.patch('/documents/:id', (req, res, next) => {
  void documentsController.update(req, res, next);
});
fcRoutes.delete('/documents/:id', (req, res, next) => {
  void documentsController.remove(req, res, next);
});

export default fcRoutes;

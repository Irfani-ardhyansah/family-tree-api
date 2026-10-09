import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/requireAuth.middleware';
import { taskBoardWorkplaceController } from './task-board.workplace.controller';

const workplaceRoutes = Router();

workplaceRoutes.use(requireAuth);

workplaceRoutes.get('/', (req, res, next) => {
  void taskBoardWorkplaceController.list(req, res, next);
});

workplaceRoutes.post('/', (req, res, next) => {
  void taskBoardWorkplaceController.create(req, res, next);
});

workplaceRoutes.put('/:id', (req, res, next) => {
  void taskBoardWorkplaceController.update(req, res, next);
});

workplaceRoutes.patch('/:id/archive', (req, res, next) => {
  void taskBoardWorkplaceController.archive(req, res, next);
});

workplaceRoutes.patch('/:id/unarchive', (req, res, next) => {
  void taskBoardWorkplaceController.unarchive(req, res, next);
});

workplaceRoutes.delete('/:id', (req, res, next) => {
  void taskBoardWorkplaceController.remove(req, res, next);
});

export default workplaceRoutes;

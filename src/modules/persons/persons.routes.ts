import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/requireAuth.middleware';
import { personsController } from './persons.controller';

const personsRoutes = Router();

personsRoutes.use(requireAuth);

personsRoutes.get('/', (req, res, next) => {
  void personsController.list(req, res, next);
});

personsRoutes.get('/:id', (req, res, next) => {
  void personsController.getById(req, res, next);
});

personsRoutes.post('/', (req, res, next) => {
  void personsController.create(req, res, next);
});

personsRoutes.put('/:id', (req, res, next) => {
  void personsController.update(req, res, next);
});

personsRoutes.delete('/:id', (req, res, next) => {
  void personsController.remove(req, res, next);
});

export default personsRoutes;

import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/requireAuth.middleware';
import { personsController } from './persons.controller';
import { resolveReadFocusMiddleware } from './read-focus.middleware';

const personsRoutes = Router();

personsRoutes.use(requireAuth);

personsRoutes.get('/map', resolveReadFocusMiddleware, (req, res, next) => {
  void personsController.map(req, res, next);
});

personsRoutes.get('/', resolveReadFocusMiddleware, (req, res, next) => {
  void personsController.list(req, res, next);
});

personsRoutes.get('/:id', resolveReadFocusMiddleware, (req, res, next) => {
  void personsController.getById(req, res, next);
});

personsRoutes.post('/', (req, res, next) => {
  void personsController.create(req, res, next);
});

personsRoutes.patch('/:id', resolveReadFocusMiddleware, (req, res, next) => {
  void personsController.patchAddress(req, res, next);
});

personsRoutes.put('/:id', (req, res, next) => {
  void personsController.update(req, res, next);
});

personsRoutes.delete('/:id', (req, res, next) => {
  void personsController.remove(req, res, next);
});

export default personsRoutes;

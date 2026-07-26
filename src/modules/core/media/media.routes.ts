import { Router } from 'express';
import { requireAuth } from '../../../shared/middleware/requireAuth.middleware';
import { resolveReadFocusMiddleware } from '../../family-roots/persons/read-focus.middleware';
import { mediaController } from './media.controller';
import { mediaUploadMiddleware } from './media.upload.middleware';

const mediaRoutes = Router();

mediaRoutes.use(requireAuth);

mediaRoutes.post(
  '/upload',
  resolveReadFocusMiddleware,
  mediaUploadMiddleware,
  (req, res, next) => {
    void mediaController.upload(req, res, next);
  },
);

mediaRoutes.post('/cleanup', resolveReadFocusMiddleware, (req, res, next) => {
  void mediaController.cleanup(req, res, next);
});

mediaRoutes.delete('/:mediaId', resolveReadFocusMiddleware, (req, res, next) => {
  void mediaController.deleteOne(req, res, next);
});

export default mediaRoutes;

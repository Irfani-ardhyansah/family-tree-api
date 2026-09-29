import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../../shared/middleware/requireAuth.middleware';
import { taskBoardController } from './task-board.controller';

const taskBoardRoutes = Router();

taskBoardRoutes.use(requireAuth);

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// List tasks
taskBoardRoutes.get('/', (req, res, next) => {
  void taskBoardController.list(req, res, next);
});

// Get task by ID
taskBoardRoutes.get('/:id', (req, res, next) => {
  void taskBoardController.getById(req, res, next);
});

// Riwayat aksi task (status, deskripsi, revisi)
taskBoardRoutes.get('/:id/history', (req, res, next) => {
  void taskBoardController.getHistory(req, res, next);
});

// Daftar revisi (task anak) dari sebuah task
taskBoardRoutes.get('/:id/revisions', (req, res, next) => {
  void taskBoardController.getRevisions(req, res, next);
});

// Create task
taskBoardRoutes.post('/', (req, res, next) => {
  void taskBoardController.create(req, res, next);
});

// Update task
taskBoardRoutes.put('/:id', (req, res, next) => {
  void taskBoardController.update(req, res, next);
});

// Delete task
taskBoardRoutes.delete('/:id', (req, res, next) => {
  void taskBoardController.delete(req, res, next);
});

// Upload image for task
taskBoardRoutes.post('/:id/images', upload.single('file'), (req, res, next) => {
  void taskBoardController.uploadImage(req, res, next);
});

export default taskBoardRoutes;

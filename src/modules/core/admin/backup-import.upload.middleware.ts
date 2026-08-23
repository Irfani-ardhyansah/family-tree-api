import multer from 'multer';
import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';

const ALLOWED_EXT = ['.json', '.sql', '.sql.gz', '.sql.zip', '.gz', '.zip'];

function hasAllowedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return ALLOWED_EXT.some((ext) => lower.endsWith(ext));
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'application/json' ||
      file.mimetype === 'application/octet-stream' ||
      file.mimetype === 'application/zip' ||
      file.mimetype === 'application/x-zip-compressed' ||
      file.mimetype === 'application/gzip' ||
      file.mimetype === 'application/x-gzip' ||
      file.mimetype === 'application/sql' ||
      file.mimetype === 'text/plain' ||
      hasAllowedExtension(file.originalname);
    if (!ok) {
      cb(
        new AppError(
          400,
          ErrorCodes.VALIDATION_ERROR,
          'File harus .json, .sql.zip, .sql.gz, atau .sql.',
        ),
      );
      return;
    }
    cb(null, true);
  },
});

export function backupImportUploadMiddleware(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      next(
        new AppError(
          400,
          ErrorCodes.VALIDATION_ERROR,
          err.code === 'LIMIT_FILE_SIZE' ? 'File backup maksimal 200 MB.' : err.message,
        ),
      );
      return;
    }
    if (err) {
      next(err);
      return;
    }
    next();
  });
}

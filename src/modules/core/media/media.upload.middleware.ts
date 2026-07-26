import multer from 'multer';
import { NextFunction, Request, Response } from 'express';
import { env } from '../../../config/env';
import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { ALLOWED_MIME_TYPES } from './media.constants';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.media.maxFileBytes,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(
        new AppError(
          400,
          ErrorCodes.MEDIA_VALIDATION_FAILED,
          'Format harus image/jpeg, image/png, image/webp, atau image/gif.',
        ),
      );
      return;
    }
    cb(null, true);
  },
});

function toMediaUploadError(err: unknown): AppError | unknown {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return new AppError(
        400,
        ErrorCodes.MEDIA_VALIDATION_FAILED,
        `Ukuran file maksimal ${Math.floor(env.media.maxFileBytes / (1024 * 1024))} MB.`,
      );
    }
    return new AppError(
      400,
      ErrorCodes.MEDIA_VALIDATION_FAILED,
      `Upload gagal: ${err.message}`,
    );
  }
  return err;
}

export function mediaUploadMiddleware(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (err: unknown) => {
    if (err) {
      next(toMediaUploadError(err));
      return;
    }
    next();
  });
}

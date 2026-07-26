import multer from 'multer';
import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../../../shared/errors/AppError';
import { ErrorCodes } from '../../../../shared/errors/errorCodes';
import { PERSON_IMPORT_MAX_FILE_BYTES } from './person-import.constants';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: PERSON_IMPORT_MAX_FILE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    const okMime =
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/json' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.mimetype === 'text/plain' ||
      file.mimetype === 'application/octet-stream';
    const okExt = name.endsWith('.csv') || name.endsWith('.json');
    if (!okMime && !okExt) {
      cb(
        new AppError(
          400,
          ErrorCodes.PERSON_IMPORT_UNSUPPORTED_FORMAT,
          'File harus berformat .csv atau .json.',
        ),
      );
      return;
    }
    cb(null, true);
  },
});

function toUploadError(err: unknown): unknown {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return new AppError(
        400,
        ErrorCodes.PERSON_IMPORT_TOO_LARGE,
        `Ukuran file maksimal ${Math.floor(PERSON_IMPORT_MAX_FILE_BYTES / (1024 * 1024))} MB.`,
      );
    }
    return new AppError(
      400,
      ErrorCodes.PERSON_IMPORT_VALIDATION_FAILED,
      `Upload gagal: ${err.message}`,
    );
  }
  return err;
}

/** Optional single file field `file` — JSON body tanpa file juga diizinkan. */
export function personImportUploadMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  upload.single('file')(req, res, (err: unknown) => {
    if (err) {
      next(toUploadError(err));
      return;
    }
    next();
  });
}

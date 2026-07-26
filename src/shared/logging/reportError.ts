import { Request } from 'express';
import { logsService } from '../../modules/core/logs/logs.service';
import { LogCategory, LogStatus } from '../../modules/core/logs/logs.types';
import { extractErrorLocation, serializeUnknownError } from './errorLocation';
import { appendAppLogLine } from './fileLogger';

export type ReportedError = {
  requestId: string | null;
  name: string;
  message: string;
  file: string | null;
  line: number | null;
  column: number | null;
  frame: string | null;
};

/**
 * Persist unexpected error ke:
 * 1) logs/app.log (file, ala Laravel)
 * 2) app_logs (category=error) untuk query di DB
 */
export async function reportUnexpectedError(
  error: unknown,
  req?: Request,
  extras?: Record<string, unknown>,
): Promise<ReportedError> {
  const serialized = serializeUnknownError(error);
  const location = extractErrorLocation(error);
  const requestId = req?.requestId ?? null;
  const path = req ? `${req.method} ${req.originalUrl.split('?')[0]}` : null;

  const reported: ReportedError = {
    requestId,
    name: serialized.name,
    message: serialized.message,
    file: location.file,
    line: location.line,
    column: location.column,
    frame: location.frame,
  };

  const metadata = {
    errorName: serialized.name,
    errorMessage: serialized.message,
    stack: serialized.stack,
    file: location.file,
    line: location.line,
    column: location.column,
    frame: location.frame,
    requestId,
    ...(extras ?? {}),
  };

  const shortMessage = location.file
    ? `${serialized.name}: ${serialized.message} @ ${location.file}:${location.line}`
    : `${serialized.name}: ${serialized.message}`;

  await appendAppLogLine('ERROR', shortMessage, {
    path,
    requestId,
    file: location.file,
    line: location.line,
    column: location.column,
    stack: serialized.stack,
    ...extras,
  });

  if (req) {
    await logsService.recordFromRequest(req, {
      category: LogCategory.ERROR,
      action: 'exception.unhandled',
      status: LogStatus.FAILURE,
      resourceType: 'http',
      httpMethod: req.method,
      path: req.originalUrl.split('?')[0] ?? req.path,
      httpStatus: 500,
      message: shortMessage.slice(0, 512),
      metadata,
    });
  } else {
    await logsService.record({
      category: LogCategory.ERROR,
      action: 'exception.unhandled',
      status: LogStatus.FAILURE,
      message: shortMessage.slice(0, 512),
      metadata,
    });
  }

  return reported;
}

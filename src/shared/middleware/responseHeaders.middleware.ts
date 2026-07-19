import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../shared/utils/response';

/** Attach X-Request-Id on every API response for FE tracing */
export function responseHeadersMiddleware(_req: Request, res: Response, next: NextFunction): void {
  const requestId = _req.requestId;
  if (requestId) {
    res.setHeader('X-Request-Id', requestId);
  }
  next();
}

/** CORS preflight short-circuit helper — cors() already handles OPTIONS; this documents intent */
export function apiVersionHeader(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-API-Version', 'v1');
  next();
}

export { sendData };

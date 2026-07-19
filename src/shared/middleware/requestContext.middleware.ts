import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

export function requestContextMiddleware(req: Request, _res: Response, next: NextFunction): void {
  req.requestId = req.headers['x-request-id']?.toString() || randomUUID();
  next();
}

import { Response } from 'express';

export function sendData<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json({ data });
}

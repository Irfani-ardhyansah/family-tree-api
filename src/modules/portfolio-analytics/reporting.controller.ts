import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../shared/utils/response';
import { reportingService } from './reporting.service';

function query(req: Request): Record<string, unknown> {
  return req.query as Record<string, unknown>;
}

export class ReportingController {
  async overview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendData(res, await reportingService.overview(query(req)));
    } catch (error) {
      next(error);
    }
  }

  async timeseries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendData(res, await reportingService.timeseries(query(req)));
    } catch (error) {
      next(error);
    }
  }

  async geo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendData(res, await reportingService.geo(query(req)));
    } catch (error) {
      next(error);
    }
  }

  async pages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendData(res, await reportingService.pages(query(req)));
    } catch (error) {
      next(error);
    }
  }

  async sections(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendData(res, await reportingService.sections(query(req)));
    } catch (error) {
      next(error);
    }
  }

  async clicks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendData(res, await reportingService.clicks(query(req)));
    } catch (error) {
      next(error);
    }
  }

  async outbounds(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendData(res, await reportingService.outbounds(query(req)));
    } catch (error) {
      next(error);
    }
  }

  async referrers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendData(res, await reportingService.referrers(query(req)));
    } catch (error) {
      next(error);
    }
  }

  async sessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendData(res, await reportingService.sessions(query(req)));
    } catch (error) {
      next(error);
    }
  }

  async sessionById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendData(res, await reportingService.sessionById(req.params.id ?? ''));
    } catch (error) {
      next(error);
    }
  }
}

export const reportingController = new ReportingController();

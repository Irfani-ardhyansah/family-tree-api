import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../../../shared/utils/response';
import { personImportService } from './person-import.service';

export class PersonImportController {
  template(_req: Request, res: Response): void {
    const csv = personImportService.getTemplateCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="persons-import-template.csv"');
    res.status(200).send(csv);
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await personImportService.createJob(req.auth!.familyId, req.auth!.personId, {
        file: req.file,
        body: req.body as Record<string, unknown>,
        query: req.query as Record<string, unknown>,
      });
      sendData(res, data, 202);
    } catch (error) {
      next(error);
    }
  }

  async getJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await personImportService.getJob(
        req.auth!.familyId,
        req.auth!.personId,
        req.params.jobId,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const personImportController = new PersonImportController();

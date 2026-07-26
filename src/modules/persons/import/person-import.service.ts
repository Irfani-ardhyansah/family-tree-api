import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { personsRepository } from '../persons.repository';
import { PERSON_IMPORT_TEMPLATE_CSV } from './person-import.constants';
import { createPersonImportJobId } from './person-import.id';
import {
  detectFormatFromFilename,
  normalizeJsonPayload,
  parseCsvToNormalizedRows,
  parseJsonToNormalizedRows,
} from './person-import.parse';
import { personImportRepository } from './person-import.repository';
import {
  PersonImportFormat,
  PersonImportJobResponse,
  PersonImportNormalizedRow,
} from './person-import.types';
import { enqueuePersonImportJob } from './person-import.worker';

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return new Date(value).toISOString();
}

function mapJobResponse(
  row: NonNullable<Awaited<ReturnType<typeof personImportRepository.findById>>>,
): PersonImportJobResponse {
  return {
    jobId: row.id,
    status: row.status,
    dryRun: Boolean(row.dry_run),
    format: row.format,
    progress: {
      percent: row.progress_percent,
      processed: row.processed,
      total: row.total,
    },
    message: row.message,
    errors: personImportRepository.getErrors(row),
    result: personImportRepository.getResult(row),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    startedAt: toIso(row.started_at),
    finishedAt: toIso(row.finished_at),
  };
}

function parseDryRunFlag(raw: unknown): boolean {
  if (raw === true || raw === 'true' || raw === '1' || raw === 1) {
    return true;
  }
  return false;
}

export class PersonImportService {
  getTemplateCsv(): string {
    return PERSON_IMPORT_TEMPLATE_CSV;
  }

  private async assertAdmin(familyId: number, personId: number): Promise<void> {
    const person = await personsRepository.findById(familyId, personId);
    if (!person) {
      throw new AppError(404, ErrorCodes.PERSON_NOT_FOUND, 'Person tidak ditemukan.');
    }
    if (person.role !== 'admin') {
      throw new AppError(
        403,
        ErrorCodes.PERSON_IMPORT_FORBIDDEN,
        'Hanya admin keluarga yang boleh mengimpor data person.',
      );
    }
  }

  private resolvePayload(
    req: {
      file?: Express.Multer.File;
      body?: Record<string, unknown>;
    },
  ): { format: PersonImportFormat; rows: PersonImportNormalizedRow[] } {
    const file = req.file;
    if (file?.buffer) {
      const content = file.buffer.toString('utf8');
      const fromName = detectFormatFromFilename(file.originalname);
      const format: PersonImportFormat =
        fromName ??
        (content.trimStart().startsWith('{') || content.trimStart().startsWith('[')
          ? 'json'
          : 'csv');

      if (format === 'json') {
        return { format, rows: parseJsonToNormalizedRows(content) };
      }
      return { format, rows: parseCsvToNormalizedRows(content) };
    }

    const body = req.body ?? {};
    if (body.persons !== undefined || Array.isArray(body)) {
      return {
        format: 'json',
        rows: normalizeJsonPayload(Array.isArray(body) ? body : body),
      };
    }

    throw new AppError(
      400,
      ErrorCodes.PERSON_IMPORT_VALIDATION_FAILED,
      'Kirim file CSV/JSON (field `file`) atau JSON body { "persons": [...] }.',
    );
  }

  async createJob(
    familyId: number,
    personId: number,
    req: {
      file?: Express.Multer.File;
      body?: Record<string, unknown>;
      query?: Record<string, unknown>;
    },
  ): Promise<PersonImportJobResponse> {
    await this.assertAdmin(familyId, personId);

    const dryRun = parseDryRunFlag(req.query?.dryRun ?? req.body?.dryRun);
    const { format, rows } = this.resolvePayload(req);

    const jobId = createPersonImportJobId();
    await personImportRepository.insertJob({
      id: jobId,
      familyId,
      createdByPersonId: personId,
      dryRun,
      format,
      payload: rows,
      total: rows.length,
    });

    enqueuePersonImportJob(jobId);

    const created = await personImportRepository.findById(jobId);
    if (!created) {
      throw new AppError(500, ErrorCodes.INTERNAL_ERROR, 'Gagal membuat job import.');
    }
    return mapJobResponse(created);
  }

  async getJob(
    familyId: number,
    personId: number,
    jobId: string,
  ): Promise<PersonImportJobResponse> {
    await this.assertAdmin(familyId, personId);

    if (!jobId.startsWith('imp_')) {
      throw new AppError(404, ErrorCodes.PERSON_IMPORT_JOB_NOT_FOUND, 'Job import tidak ditemukan.');
    }

    const job = await personImportRepository.findByIdForFamily(jobId, familyId);
    if (!job) {
      throw new AppError(404, ErrorCodes.PERSON_IMPORT_JOB_NOT_FOUND, 'Job import tidak ditemukan.');
    }

    // Creator or any family admin can poll
    return mapJobResponse(job);
  }
}

export const personImportService = new PersonImportService();

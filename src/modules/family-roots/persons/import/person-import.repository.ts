import db from '../../../../config/database';
import { Tables } from '../../../../shared/database/tables';
import {
  PersonImportError,
  PersonImportFormat,
  PersonImportJobResult,
  PersonImportJobRow,
  PersonImportJobStatus,
  PersonImportNormalizedRow,
} from './person-import.types';

function parseJsonField<T>(value: T | string | null | undefined): T | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    return JSON.parse(value) as T;
  }
  return value;
}

export class PersonImportRepository {
  async insertJob(input: {
    id: string;
    familyId: number;
    createdByPersonId: number;
    dryRun: boolean;
    format: PersonImportFormat;
    payload: PersonImportNormalizedRow[];
    total: number;
  }): Promise<void> {
    // mysql2 expands JS arrays as multi-value binds — always stringify JSON columns.
    await db(Tables.PERSON_IMPORT_JOBS).insert({
      id: input.id,
      family_id: input.familyId,
      created_by_person_id: input.createdByPersonId,
      dry_run: input.dryRun,
      format: input.format,
      status: 'queued',
      progress_percent: 0,
      processed: 0,
      total: input.total,
      message: 'Menunggu antrian…',
      payload: JSON.stringify(input.payload),
      errors: null,
      result: null,
    });
  }

  async findById(jobId: string): Promise<PersonImportJobRow | undefined> {
    return db(Tables.PERSON_IMPORT_JOBS).where({ id: jobId }).first<PersonImportJobRow>();
  }

  async findByIdForFamily(
    jobId: string,
    familyId: number,
  ): Promise<PersonImportJobRow | undefined> {
    return db(Tables.PERSON_IMPORT_JOBS)
      .where({ id: jobId, family_id: familyId })
      .first<PersonImportJobRow>();
  }

  async updateProgress(
    jobId: string,
    patch: {
      status?: PersonImportJobStatus;
      progressPercent?: number;
      processed?: number;
      message?: string | null;
      startedAt?: Date | null;
      finishedAt?: Date | null;
      errors?: PersonImportError[] | null;
      result?: PersonImportJobResult | null;
    },
  ): Promise<void> {
    const update: Record<string, unknown> = {
      updated_at: db.fn.now(),
    };
    if (patch.status !== undefined) {
      update.status = patch.status;
    }
    if (patch.progressPercent !== undefined) {
      update.progress_percent = patch.progressPercent;
    }
    if (patch.processed !== undefined) {
      update.processed = patch.processed;
    }
    if (patch.message !== undefined) {
      update.message = patch.message;
    }
    if (patch.startedAt !== undefined) {
      update.started_at = patch.startedAt;
    }
    if (patch.finishedAt !== undefined) {
      update.finished_at = patch.finishedAt;
    }
    if (patch.errors !== undefined) {
      update.errors = patch.errors === null ? null : JSON.stringify(patch.errors);
    }
    if (patch.result !== undefined) {
      update.result = patch.result === null ? null : JSON.stringify(patch.result);
    }

    await db(Tables.PERSON_IMPORT_JOBS).where({ id: jobId }).update(update);
  }

  async listStuckProcessing(): Promise<PersonImportJobRow[]> {
    return db(Tables.PERSON_IMPORT_JOBS)
      .whereIn('status', ['validating', 'importing'])
      .select<PersonImportJobRow[]>('*');
  }

  async listQueued(): Promise<PersonImportJobRow[]> {
    return db(Tables.PERSON_IMPORT_JOBS)
      .where({ status: 'queued' })
      .orderBy('created_at', 'asc')
      .select<PersonImportJobRow[]>('*');
  }

  getPayload(row: PersonImportJobRow): PersonImportNormalizedRow[] {
    return parseJsonField<PersonImportNormalizedRow[]>(row.payload) ?? [];
  }

  getErrors(row: PersonImportJobRow): PersonImportError[] {
    return parseJsonField<PersonImportError[]>(row.errors) ?? [];
  }

  getResult(row: PersonImportJobRow): PersonImportJobResult | null {
    return parseJsonField<PersonImportJobResult>(row.result);
  }
}

export const personImportRepository = new PersonImportRepository();

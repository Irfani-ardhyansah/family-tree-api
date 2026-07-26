import { reportUnexpectedError } from '../../../shared/logging/reportError';
import { UpsertPersonInput } from '../persons.types';
import { personsRepository } from '../persons.repository';
import { personImportRepository } from './person-import.repository';
import {
  buildPreview,
  validateImportRowsAgainstDb,
  validateImportRowsStructural,
} from './person-import.validate';
import { PersonImportJobResult, PersonImportNormalizedRow } from './person-import.types';

const queue: string[] = [];
let pumping = false;

function toUpsertInput(
  row: PersonImportNormalizedRow,
  parents: { fatherId: number | null; motherId: number | null; spouseIds: number[] },
): UpsertPersonInput {
  return {
    fullName: row.fullName,
    nickname: row.nickname,
    gender: row.gender,
    birthDate: row.birthDate,
    deathDate: row.deathDate,
    status: row.status,
    religion: row.religion,
    occupation: row.occupation,
    phone: row.phone,
    phoneAlt: row.phoneAlt,
    address: row.address,
    fatherId: parents.fatherId,
    motherId: parents.motherId,
    spouseIds: parents.spouseIds,
    role: row.role,
  };
}

function resolveParents(
  row: PersonImportNormalizedRow,
  idByTempId: Map<string, number>,
): { fatherId: number | null; motherId: number | null; spouseIds: number[] } {
  const fatherId =
    row.fatherId ?? (row.fatherTempId ? (idByTempId.get(row.fatherTempId) ?? null) : null);
  const motherId =
    row.motherId ?? (row.motherTempId ? (idByTempId.get(row.motherTempId) ?? null) : null);
  const spouseFromTemp = row.spouseTempIds
    .map((tempId) => idByTempId.get(tempId))
    .filter((id): id is number => typeof id === 'number');
  const spouseIds = [...new Set([...row.spouseIds, ...spouseFromTemp])];
  return { fatherId, motherId, spouseIds };
}

async function processJob(jobId: string): Promise<void> {
  const job = await personImportRepository.findById(jobId);
  if (!job || job.status !== 'queued') {
    return;
  }

  const dryRun = Boolean(job.dry_run);
  const rows = personImportRepository.getPayload(job);

  await personImportRepository.updateProgress(jobId, {
    status: 'validating',
    progressPercent: 5,
    processed: 0,
    message: 'Memvalidasi data…',
    startedAt: new Date(),
  });

  const structuralErrors = validateImportRowsStructural(rows);
  await personImportRepository.updateProgress(jobId, {
    progressPercent: 15,
    message: 'Memeriksa relasi ke data existing…',
  });

  const dbErrors = await validateImportRowsAgainstDb(job.family_id, rows);
  const errors = [...structuralErrors, ...dbErrors];

  if (errors.length > 0) {
    await personImportRepository.updateProgress(jobId, {
      status: 'failed',
      progressPercent: 100,
      processed: rows.length,
      message: 'Validasi gagal.',
      errors,
      finishedAt: new Date(),
    });
    return;
  }

  const preview = buildPreview(rows);

  if (dryRun) {
    const result: PersonImportJobResult = {
      dryRun: true,
      rowCount: rows.length,
      createdCount: 0,
      idByTempId: {},
      preview,
      persons: [],
    };
    await personImportRepository.updateProgress(jobId, {
      status: 'completed',
      progressPercent: 100,
      processed: rows.length,
      message: 'Dry-run selesai. Data valid.',
      errors: [],
      result,
      finishedAt: new Date(),
    });
    return;
  }

  await personImportRepository.updateProgress(jobId, {
    status: 'importing',
    progressPercent: 30,
    message: 'Menyimpan persons…',
  });

  const idByTempId = new Map<string, number>();

  try {
    // Pass 1: create without parent/spouse links
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const personId = await personsRepository.createPerson(
        job.family_id,
        toUpsertInput(row, { fatherId: null, motherId: null, spouseIds: [] }),
      );
      idByTempId.set(row.tempId, personId);
      const processed = i + 1;
      const percent = 30 + Math.floor((processed / rows.length) * 40);
      await personImportRepository.updateProgress(jobId, {
        progressPercent: percent,
        processed,
        message: `Menyimpan persons (${processed}/${rows.length})…`,
      });
    }

    await personImportRepository.updateProgress(jobId, {
      progressPercent: 75,
      message: 'Menghubungkan ayah/ibu…',
    });

    // Pass 2: link parents + spouses
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const personId = idByTempId.get(row.tempId);
      if (!personId) {
        continue;
      }
      const parents = resolveParents(row, idByTempId);
      await personsRepository.updatePerson(
        job.family_id,
        personId,
        toUpsertInput(row, parents),
      );
      const processed = i + 1;
      const percent = 75 + Math.floor((processed / rows.length) * 20);
      await personImportRepository.updateProgress(jobId, {
        progressPercent: Math.min(percent, 99),
        processed,
        message: `Menghubungkan relasi (${processed}/${rows.length})…`,
      });
    }

    const idByTempIdRecord = Object.fromEntries(idByTempId.entries());
    const persons = rows.map((row) => {
      const id = idByTempId.get(row.tempId)!;
      const parents = resolveParents(row, idByTempId);
      return {
        id,
        tempId: row.tempId,
        fullName: row.fullName,
        fatherId: parents.fatherId,
        motherId: parents.motherId,
        spouseIds: parents.spouseIds,
      };
    });

    const result: PersonImportJobResult = {
      dryRun: false,
      rowCount: rows.length,
      createdCount: rows.length,
      idByTempId: idByTempIdRecord,
      preview,
      persons,
    };

    await personImportRepository.updateProgress(jobId, {
      status: 'completed',
      progressPercent: 100,
      processed: rows.length,
      message: `Import selesai. ${rows.length} person ditambahkan.`,
      errors: [],
      result,
      finishedAt: new Date(),
    });
  } catch (error) {
    await reportUnexpectedError(error, undefined, {
      jobId,
      familyId: job.family_id,
      action: 'person.import.worker',
    });
    for (const createdId of idByTempId.values()) {
      await personsRepository.softDelete(job.family_id, createdId).catch(() => undefined);
    }
    await personImportRepository.updateProgress(jobId, {
      status: 'failed',
      progressPercent: 100,
      message: 'Import gagal saat menyimpan data.',
      errors: [
        {
          row: 0,
          message: error instanceof Error ? error.message : 'Terjadi kesalahan saat import.',
        },
      ],
      finishedAt: new Date(),
    });
  }
}

async function pump(): Promise<void> {
  if (pumping) {
    return;
  }
  pumping = true;
  try {
    while (queue.length > 0) {
      const jobId = queue.shift();
      if (!jobId) {
        break;
      }
      try {
        await processJob(jobId);
      } catch (error) {
        await reportUnexpectedError(error, undefined, {
          jobId,
          action: 'person.import.worker.pump',
        });
        await personImportRepository.updateProgress(jobId, {
          status: 'failed',
          progressPercent: 100,
          message: 'Import gagal (worker error).',
          errors: [{ row: 0, message: 'Terjadi kesalahan pada worker import.' }],
          finishedAt: new Date(),
        }).catch(() => undefined);
      }
    }
  } finally {
    pumping = false;
  }
}

export function enqueuePersonImportJob(jobId: string): void {
  queue.push(jobId);
  setImmediate(() => {
    void pump();
  });
}

/** Mark interrupted jobs failed; re-queue leftover queued jobs after boot. */
export async function recoverPersonImportJobs(): Promise<void> {
  const stuck = await personImportRepository.listStuckProcessing();
  for (const job of stuck) {
    await personImportRepository.updateProgress(job.id, {
      status: 'failed',
      progressPercent: 100,
      message: 'Import terhenti karena server restart. Silakan upload ulang.',
      errors: [
        {
          row: 0,
          message: 'Job terhenti (server restart). Upload ulang untuk mencoba lagi.',
        },
      ],
      finishedAt: new Date(),
    });
  }

  const queued = await personImportRepository.listQueued();
  for (const job of queued) {
    enqueuePersonImportJob(job.id);
  }
}

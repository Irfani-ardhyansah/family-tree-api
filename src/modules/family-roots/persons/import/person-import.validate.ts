import { formatBirthDate } from '../../../core/auth/auth.mapper';
import { personsRepository } from '../persons.repository';
import { isValidTempIdShape } from './person-import.parse';
import {
  PersonImportError,
  PersonImportNormalizedRow,
  PersonImportPreviewItem,
} from './person-import.types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function pushError(
  errors: PersonImportError[],
  row: PersonImportNormalizedRow,
  field: string,
  message: string,
): void {
  errors.push({
    row: row.row,
    tempId: row.tempId || undefined,
    field,
    message,
  });
}

/**
 * Structural + cross-row validation (no DB). Returns errors; empty = OK structurally.
 */
export function validateImportRowsStructural(
  rows: PersonImportNormalizedRow[],
): PersonImportError[] {
  const errors: PersonImportError[] = [];
  const tempIds = new Map<string, number>();

  for (const row of rows) {
    if (!row.tempId) {
      pushError(errors, row, 'tempId', 'tempId wajib diisi.');
    } else if (!isValidTempIdShape(row.tempId)) {
      pushError(
        errors,
        row,
        'tempId',
        'tempId hanya boleh huruf/angka/underscore/dash (max 64).',
      );
    } else if (tempIds.has(row.tempId)) {
      pushError(errors, row, 'tempId', `tempId "${row.tempId}" duplikat.`);
    } else {
      tempIds.set(row.tempId, row.row);
    }

    if (!row.fullName.trim()) {
      pushError(errors, row, 'fullName', 'Nama lengkap wajib diisi.');
    }

    if (row.gender !== 'male' && row.gender !== 'female') {
      pushError(errors, row, 'gender', 'Gender harus male atau female.');
    }

    if (!DATE_RE.test(row.birthDate)) {
      pushError(errors, row, 'birthDate', 'Tanggal lahir harus YYYY-MM-DD.');
    }

    if (row.deathDate && !DATE_RE.test(row.deathDate)) {
      pushError(errors, row, 'deathDate', 'Tanggal meninggal harus YYYY-MM-DD.');
    }

    if (row.status !== 'alive' && row.status !== 'deceased') {
      pushError(errors, row, 'status', 'Status harus alive atau deceased.');
    }

    if (row.fatherTempId && row.fatherId) {
      pushError(errors, row, 'fatherTempId', 'Jangan isi fatherTempId dan fatherId bersamaan.');
    }
    if (row.motherTempId && row.motherId) {
      pushError(errors, row, 'motherTempId', 'Jangan isi motherTempId dan motherId bersamaan.');
    }

    if (row.fatherTempId === row.tempId) {
      pushError(errors, row, 'fatherTempId', 'Person tidak boleh menjadi ayah dirinya sendiri.');
    }
    if (row.motherTempId === row.tempId) {
      pushError(errors, row, 'motherTempId', 'Person tidak boleh menjadi ibu dirinya sendiri.');
    }
  }

  for (const row of rows) {
    if (row.fatherTempId && !tempIds.has(row.fatherTempId)) {
      pushError(
        errors,
        row,
        'fatherTempId',
        `fatherTempId "${row.fatherTempId}" tidak ditemukan di file.`,
      );
    }
    if (row.motherTempId && !tempIds.has(row.motherTempId)) {
      pushError(
        errors,
        row,
        'motherTempId',
        `motherTempId "${row.motherTempId}" tidak ditemukan di file.`,
      );
    }
    for (const spouseTempId of row.spouseTempIds) {
      if (!tempIds.has(spouseTempId)) {
        pushError(
          errors,
          row,
          'spouseTempIds',
          `spouseTempId "${spouseTempId}" tidak ditemukan di file.`,
        );
      }
      if (spouseTempId === row.tempId) {
        pushError(errors, row, 'spouseTempIds', 'Person tidak boleh menjadi pasangan dirinya sendiri.');
      }
    }
  }

  // Parent birth dates within file
  const byTempId = new Map(rows.map((r) => [r.tempId, r]));
  for (const row of rows) {
    if (!DATE_RE.test(row.birthDate)) {
      continue;
    }
    if (row.fatherTempId) {
      const father = byTempId.get(row.fatherTempId);
      if (father && DATE_RE.test(father.birthDate) && father.birthDate >= row.birthDate) {
        pushError(
          errors,
          row,
          'fatherTempId',
          'Tanggal lahir ayah harus sebelum tanggal lahir person.',
        );
      }
    }
    if (row.motherTempId) {
      const mother = byTempId.get(row.motherTempId);
      if (mother && DATE_RE.test(mother.birthDate) && mother.birthDate >= row.birthDate) {
        pushError(
          errors,
          row,
          'motherTempId',
          'Tanggal lahir ibu harus sebelum tanggal lahir person.',
        );
      }
    }
  }

  return errors;
}

/**
 * Validate existing DB person refs (fatherId/motherId/spouseIds) + birth order vs DB parents.
 */
export async function validateImportRowsAgainstDb(
  familyId: number,
  rows: PersonImportNormalizedRow[],
): Promise<PersonImportError[]> {
  const errors: PersonImportError[] = [];
  const existingIds = new Set<number>();

  for (const row of rows) {
    for (const id of [row.fatherId, row.motherId, ...row.spouseIds]) {
      if (typeof id === 'number') {
        existingIds.add(id);
      }
    }
  }

  const birthById = new Map<number, string>();
  for (const id of existingIds) {
    const person = await personsRepository.findById(familyId, id);
    if (!person) {
      // Annotate later per-row
      birthById.set(id, '');
    } else {
      birthById.set(id, formatBirthDate(person.birth_date));
    }
  }

  for (const row of rows) {
    if (row.fatherId !== null) {
      const birth = birthById.get(row.fatherId);
      if (birth === undefined || birth === '') {
        pushError(
          errors,
          row,
          'fatherId',
          `fatherId ${row.fatherId} tidak ditemukan di keluarga.`,
        );
      } else if (DATE_RE.test(row.birthDate) && birth >= row.birthDate) {
        pushError(
          errors,
          row,
          'fatherId',
          'Tanggal lahir ayah harus sebelum tanggal lahir person.',
        );
      }
    }

    if (row.motherId !== null) {
      const birth = birthById.get(row.motherId);
      if (birth === undefined || birth === '') {
        pushError(
          errors,
          row,
          'motherId',
          `motherId ${row.motherId} tidak ditemukan di keluarga.`,
        );
      } else if (DATE_RE.test(row.birthDate) && birth >= row.birthDate) {
        pushError(
          errors,
          row,
          'motherId',
          'Tanggal lahir ibu harus sebelum tanggal lahir person.',
        );
      }
    }

    for (const spouseId of row.spouseIds) {
      const birth = birthById.get(spouseId);
      if (birth === undefined || birth === '') {
        pushError(
          errors,
          row,
          'spouseIds',
          `spouseId ${spouseId} tidak ditemukan di keluarga.`,
        );
      }
    }
  }

  return errors;
}

export function buildPreview(rows: PersonImportNormalizedRow[]): PersonImportPreviewItem[] {
  return rows.map((row) => ({
    tempId: row.tempId,
    fullName: row.fullName,
    gender: row.gender === 'female' ? 'female' : 'male',
    birthDate: row.birthDate,
    fatherTempId: row.fatherTempId,
    motherTempId: row.motherTempId,
    spouseTempIds: row.spouseTempIds,
    fatherId: row.fatherId,
    motherId: row.motherId,
    spouseIds: row.spouseIds,
  }));
}

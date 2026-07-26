import { describe, expect, it } from 'vitest';
import { PersonImportNormalizedRow } from './person-import.types';
import { validateImportRowsStructural } from './person-import.validate';

function row(partial: Partial<PersonImportNormalizedRow> & Pick<PersonImportNormalizedRow, 'row' | 'tempId' | 'fullName' | 'gender' | 'birthDate'>): PersonImportNormalizedRow {
  return {
    nickname: null,
    deathDate: null,
    status: 'alive',
    religion: null,
    occupation: null,
    phone: null,
    phoneAlt: null,
    address: null,
    fatherTempId: null,
    motherTempId: null,
    spouseTempIds: [],
    fatherId: null,
    motherId: null,
    spouseIds: [],
    role: 'member',
    ...partial,
  };
}

describe('validateImportRowsStructural', () => {
  it('accepts a small valid tree', () => {
    const errors = validateImportRowsStructural([
      row({ row: 1, tempId: 'ayah', fullName: 'Budi', gender: 'male', birthDate: '1975-01-15', spouseTempIds: ['ibu'] }),
      row({ row: 2, tempId: 'ibu', fullName: 'Rina', gender: 'female', birthDate: '1978-06-30', spouseTempIds: ['ayah'] }),
      row({
        row: 3,
        tempId: 'anak',
        fullName: 'Dimas',
        gender: 'male',
        birthDate: '2000-04-21',
        fatherTempId: 'ayah',
        motherTempId: 'ibu',
      }),
    ]);
    expect(errors).toEqual([]);
  });

  it('rejects missing fatherTempId', () => {
    const errors = validateImportRowsStructural([
      row({
        row: 1,
        tempId: 'anak',
        fullName: 'Dimas',
        gender: 'male',
        birthDate: '2000-04-21',
        fatherTempId: 'ayahx',
      }),
    ]);
    expect(errors.some((e) => e.message.includes('tidak ditemukan'))).toBe(true);
  });

  it('rejects parent born after child', () => {
    const errors = validateImportRowsStructural([
      row({ row: 1, tempId: 'ayah', fullName: 'Budi', gender: 'male', birthDate: '2005-01-01' }),
      row({
        row: 2,
        tempId: 'anak',
        fullName: 'Dimas',
        gender: 'male',
        birthDate: '2000-04-21',
        fatherTempId: 'ayah',
      }),
    ]);
    expect(errors.some((e) => e.message.includes('sebelum tanggal lahir'))).toBe(true);
  });

  it('rejects duplicate tempId and mixed father refs', () => {
    const errors = validateImportRowsStructural([
      row({ row: 1, tempId: 'a', fullName: 'A', gender: 'male', birthDate: '1970-01-01' }),
      row({
        row: 2,
        tempId: 'a',
        fullName: 'B',
        gender: 'male',
        birthDate: '1980-01-01',
        fatherTempId: 'a',
        fatherId: 9,
      }),
    ]);
    expect(errors.some((e) => e.message.includes('duplikat'))).toBe(true);
    expect(errors.some((e) => e.message.includes('bersamaan'))).toBe(true);
  });
});

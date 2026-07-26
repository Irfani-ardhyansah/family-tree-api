import { describe, expect, it } from 'vitest';
import { AppError } from '../../../shared/errors/AppError';
import {
  normalizeJsonPayload,
  parseCsvRows,
  parseCsvToNormalizedRows,
} from './person-import.parse';

describe('person-import.parse', () => {
  it('parses quoted CSV fields', () => {
    const rows = parseCsvRows('a,b\n"x,y",z\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['x,y', 'z'],
    ]);
  });

  it('normalizes CSV import rows + spouse pipe list', () => {
    const csv = [
      'tempId,fullName,nickname,gender,birthDate,deathDate,status,religion,occupation,phone,phoneAlt,street,district,city,province,postalCode,country,fatherTempId,motherTempId,spouseTempIds,role',
      // after religion: 9 empty contact/address + empty father + empty mother + spouse + role
      'ayah,Budi,,male,1975-01-15,,alive,islam,,,,,,,,,,,,ibu,member',
      'ibu,Rina,,female,1978-06-30,,alive,islam,,,,,,,,,,,,ayah,member',
      'anak,Dimas,,male,2000-04-21,,alive,islam,,,,,,,,,,ayah,ibu,,member',
    ].join('\n');

    const rows = parseCsvToNormalizedRows(csv);
    expect(rows).toHaveLength(3);
    expect(rows[0].spouseTempIds).toEqual(['ibu']);
    expect(rows[2].fatherTempId).toBe('ayah');
    expect(rows[2].motherTempId).toBe('ibu');
  });

  it('normalizes JSON { persons }', () => {
    const rows = normalizeJsonPayload({
      persons: [
        {
          tempId: 'a',
          fullName: 'A',
          gender: 'male',
          birthDate: '1990-01-01',
          spouseTempIds: ['b'],
        },
      ],
    });
    expect(rows[0].tempId).toBe('a');
    expect(rows[0].spouseTempIds).toEqual(['b']);
  });

  it('rejects CSV without required headers', () => {
    expect(() => parseCsvToNormalizedRows('foo,bar\n1,2\n')).toThrow(AppError);
  });
});

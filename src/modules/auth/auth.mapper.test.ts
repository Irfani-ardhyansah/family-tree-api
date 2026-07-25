import { describe, expect, it } from 'vitest';
import { buildAllowedFocusPersons, isLegalAge, toAuthPersonSummary } from './auth.mapper';
import { PersonAuthRow } from './auth.types';

function person(partial: Partial<PersonAuthRow> & Pick<PersonAuthRow, 'id' | 'full_name'>): PersonAuthRow {
  return {
    family_id: 1,
    nickname: null,
    gender: 'male',
    birth_date: '1999-03-21',
    status: 'alive',
    photo_url: null,
    ...partial,
  };
}

describe('auth.mapper', () => {
  describe('isLegalAge', () => {
    it('returns true when age is above 17', () => {
      expect(isLegalAge('1999-03-21', new Date('2026-07-19'))).toBe(true);
      expect(isLegalAge('2008-07-18', new Date('2026-07-19'))).toBe(true);
    });

    it('returns false when age is 17 or below', () => {
      expect(isLegalAge('2008-07-20', new Date('2026-07-19'))).toBe(false);
      expect(isLegalAge('2010-01-01', new Date('2026-07-19'))).toBe(false);
    });

    it('returns true on 18th birthday', () => {
      expect(isLegalAge('2008-07-19', new Date('2026-07-19'))).toBe(true);
    });
  });

  describe('buildAllowedFocusPersons', () => {
    const self = person({
      id: 83,
      full_name: 'Mochamad Irfani Ardhyansah',
      nickname: 'Kamu',
      gender: 'male',
    });
    const spouse = person({
      id: 84,
      full_name: 'Siti Aminah',
      nickname: 'Aminah',
      gender: 'female',
      photo_url: 'https://cdn.example.com/p/84.jpg',
    });

    it('includes self then allowed spouses', () => {
      expect(buildAllowedFocusPersons(self, [84], [spouse])).toEqual([
        {
          id: 83,
          fullName: 'Mochamad Irfani Ardhyansah',
          nickname: 'Kamu',
          gender: 'male',
          photoUrl: null,
          relation: 'self',
        },
        {
          id: 84,
          fullName: 'Siti Aminah',
          nickname: 'Aminah',
          gender: 'female',
          photoUrl: 'https://cdn.example.com/p/84.jpg',
          relation: 'spouse',
        },
      ]);
    });

    it('returns only self when unmarried', () => {
      expect(buildAllowedFocusPersons(self, [], [])).toEqual([
        {
          id: 83,
          fullName: 'Mochamad Irfani Ardhyansah',
          nickname: 'Kamu',
          gender: 'male',
          photoUrl: null,
          relation: 'self',
        },
      ]);
    });

    it('skips missing spouse rows without error', () => {
      expect(buildAllowedFocusPersons(self, [84], [])).toEqual([
        {
          id: 83,
          fullName: 'Mochamad Irfani Ardhyansah',
          nickname: 'Kamu',
          gender: 'male',
          photoUrl: null,
          relation: 'self',
        },
      ]);
    });

    it('keeps spouseIds order and ignores self id in spouseIds', () => {
      const spouseB = person({ id: 90, full_name: 'Spouse B', gender: 'female' });
      const result = buildAllowedFocusPersons(self, [90, 83, 84], [spouse, spouseB]);
      expect(result.map((p) => p.id)).toEqual([83, 90, 84]);
      expect(result.map((p) => p.relation)).toEqual(['self', 'spouse', 'spouse']);
    });
  });

  describe('toAuthPersonSummary', () => {
    it('embeds allowedFocusPersons synced with spouseIds', () => {
      const self = person({ id: 83, full_name: 'Self', nickname: 'Me' });
      const spouse = person({ id: 84, full_name: 'Spouse', nickname: 'Sp', gender: 'female' });
      const summary = toAuthPersonSummary(self, [84], [spouse]);

      expect(summary.spouseIds).toEqual([84]);
      expect(summary.isMarried).toBe(true);
      expect(summary.allowedFocusPersons.map((p) => p.id)).toEqual([83, 84]);
    });
  });
});

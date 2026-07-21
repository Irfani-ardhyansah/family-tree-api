import { describe, expect, it } from 'vitest';
import { isLegalAge } from './auth.mapper';

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
});

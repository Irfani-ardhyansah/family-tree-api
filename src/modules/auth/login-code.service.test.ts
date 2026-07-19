import { describe, expect, it } from 'vitest';
import {
  buildBirthDateSuffix,
  buildLoginCode,
  buildNameAbbrev,
  isValidFormat,
  normalize,
} from './login-code.service';

describe('login-code.service', () => {
  describe('buildNameAbbrev', () => {
    it('uses full single-word name', () => {
      expect(buildNameAbbrev('Mia')).toBe('MIA');
    });

    it('uses initials for multi-word name', () => {
      expect(buildNameAbbrev('Mulyono Raka')).toBe('MR');
    });

    it('prefers nickname over full name', () => {
      expect(buildNameAbbrev('Mulyono Raka', 'Raka')).toBe('RAKA');
    });

    it('strips Indonesian titles from words', () => {
      expect(buildNameAbbrev('H. Mulyono Raka')).toBe('MR');
      expect(buildNameAbbrev('H. Wijaya')).toBe('WIJAYA');
      expect(buildNameAbbrev('Hj. Citra Maharani', 'Ibu')).toBe('IBU');
    });

    it('handles nickname with spaces', () => {
      expect(buildNameAbbrev('H. Andi Pratama', 'Kak Andi')).toBe('KAKANDI');
    });
  });

  describe('buildBirthDateSuffix', () => {
    it('formats DDMMYY from ISO date', () => {
      expect(buildBirthDateSuffix('1999-03-21')).toBe('210399');
      expect(buildBirthDateSuffix('1945-08-17')).toBe('170845');
      expect(buildBirthDateSuffix('2000-08-22')).toBe('220800');
    });
  });

  describe('buildLoginCode', () => {
    it('matches documented examples', () => {
      expect(buildLoginCode({ fullName: 'Mia', birthDate: '1999-03-21' })).toBe('MIA210399');
      expect(buildLoginCode({ fullName: 'Mulyono Raka', birthDate: '1945-08-17' })).toBe('MR170845');
      expect(
        buildLoginCode({ fullName: 'Mulyono Raka', nickname: 'Raka', birthDate: '1945-08-17' }),
      ).toBe('RAKA170845');
    });

    it('matches seed smoke accounts', () => {
      expect(buildLoginCode({ fullName: 'Mulyono Raka', birthDate: '1945-08-17' })).toBe('MR170845');
      expect(
        buildLoginCode({ fullName: 'Irfa Ardhyansah', nickname: 'Kamu', birthDate: '2000-08-22' }),
      ).toBe('KAMU220800');
      expect(
        buildLoginCode({ fullName: 'H. Budi Ardhyansah', nickname: 'Ayah', birthDate: '1975-01-20' }),
      ).toBe('AYAH200175');
      expect(
        buildLoginCode({ fullName: 'Hj. Citra Maharani', nickname: 'Ibu', birthDate: '1976-10-12' }),
      ).toBe('IBU121076');
      expect(buildLoginCode({ fullName: 'H. Wijaya', birthDate: '1950-05-08' })).toBe('WIJAYA080550');
      expect(
        buildLoginCode({ fullName: 'H. Andi Pratama', nickname: 'Kak Andi', birthDate: '1998-03-14' }),
      ).toBe('KAKANDI140398');
      expect(
        buildLoginCode({ fullName: 'Hj. Ayu Kirana', nickname: 'Ayu', birthDate: '2001-05-17' }),
      ).toBe('AYU170501');
    });
  });

  describe('normalize', () => {
    it('trims, uppercases, and removes spaces', () => {
      expect(normalize('  mr 170845 ')).toBe('MR170845');
    });
  });

  describe('isValidFormat', () => {
    it('accepts valid codes', () => {
      expect(isValidFormat('MR170845')).toBe(true);
      expect(isValidFormat('KAMU220800')).toBe(true);
      expect(isValidFormat('  mr170845 ')).toBe(true);
    });

    it('rejects invalid codes', () => {
      expect(isValidFormat('ABC')).toBe(false);
      expect(isValidFormat('123456')).toBe(false);
      expect(isValidFormat('')).toBe(false);
    });
  });
});

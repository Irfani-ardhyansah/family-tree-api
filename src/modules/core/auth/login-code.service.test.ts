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

    it('ignores nickname — always derives from fullName', () => {
      expect(buildNameAbbrev('Mulyono Raka')).toBe('MR');
      expect(buildNameAbbrev('Mochamad Irfani Ardhyansah')).toBe('MIA');
    });

    it('strips Indonesian titles from words', () => {
      expect(buildNameAbbrev('H. Mulyono Raka')).toBe('MR');
      expect(buildNameAbbrev('H. Wijaya')).toBe('WIJAYA');
      expect(buildNameAbbrev('Hj. Citra Maharani')).toBe('CM');
    });

    it('uses fullName initials when nickname is set on person', () => {
      expect(buildNameAbbrev('H. Andi Pratama')).toBe('AP');
      expect(buildNameAbbrev('H. Budi Ardhyansah')).toBe('BA');
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
      ).toBe('MR170845');
    });

    it('matches seed smoke accounts', () => {
      expect(buildLoginCode({ fullName: 'Mulyono Raka', birthDate: '1945-08-17' })).toBe('MR170845');
      expect(
        buildLoginCode({ fullName: 'Mochamad Irfani Ardhyansah', birthDate: '1999-03-21' }),
      ).toBe('MIA210399');
      expect(
        buildLoginCode({ fullName: 'H. Budi Ardhyansah', nickname: 'Ayah', birthDate: '1975-01-20' }),
      ).toBe('BA200175');
      expect(
        buildLoginCode({ fullName: 'Hj. Citra Maharani', nickname: 'Ibu', birthDate: '1976-10-12' }),
      ).toBe('CM121076');
      expect(buildLoginCode({ fullName: 'H. Wijaya', birthDate: '1950-05-08' })).toBe('WIJAYA080550');
      expect(
        buildLoginCode({ fullName: 'H. Andi Pratama', nickname: 'Kak Andi', birthDate: '1998-03-14' }),
      ).toBe('AP140398');
      expect(
        buildLoginCode({ fullName: 'Hj. Ayu Kirana', nickname: 'Ayu', birthDate: '2001-05-17' }),
      ).toBe('AK170501');
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
      expect(isValidFormat('MIA210399')).toBe(true);
      expect(isValidFormat('  mr170845 ')).toBe(true);
    });

    it('rejects invalid codes', () => {
      expect(isValidFormat('ABC')).toBe(false);
      expect(isValidFormat('123456')).toBe(false);
      expect(isValidFormat('')).toBe(false);
    });
  });
});

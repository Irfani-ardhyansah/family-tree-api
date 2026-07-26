import { describe, expect, it } from 'vitest';
import { AppError } from '../../../shared/errors/AppError';
import {
  assertParentBornBeforeChild,
  assertParentGender,
  parseOptionalParentId,
} from './person-parent-validation.service';

describe('assertParentBornBeforeChild', () => {
  it('accepts parent born before child', () => {
    expect(() => assertParentBornBeforeChild('1999-03-21', '1975-01-20', 'ayah')).not.toThrow();
    expect(() => assertParentBornBeforeChild('1999-03-21', '1976-10-12', 'ibu')).not.toThrow();
  });

  it('rejects same birth date', () => {
    expect(() => assertParentBornBeforeChild('1999-03-21', '1999-03-21', 'ayah')).toThrow(AppError);
  });

  it('rejects parent born after child', () => {
    expect(() => assertParentBornBeforeChild('1990-01-01', '2000-01-01', 'ibu')).toThrow(AppError);
  });
});

describe('assertParentGender', () => {
  it('accepts male father and female mother', () => {
    expect(() => assertParentGender('male', 'ayah')).not.toThrow();
    expect(() => assertParentGender('female', 'ibu')).not.toThrow();
  });

  it('rejects female father and male mother', () => {
    expect(() => assertParentGender('female', 'ayah')).toThrow(AppError);
    expect(() => assertParentGender('male', 'ibu')).toThrow(AppError);
  });
});

describe('parseOptionalParentId', () => {
  it('allows empty parent ids', () => {
    expect(parseOptionalParentId(null, 'ayah')).toBeNull();
    expect(parseOptionalParentId(undefined, 'ibu')).toBeNull();
    expect(parseOptionalParentId('', 'ayah')).toBeNull();
  });

  it('accepts positive integer parent ids', () => {
    expect(parseOptionalParentId(12, 'ayah')).toBe(12);
  });

  it('rejects invalid parent ids', () => {
    expect(() => parseOptionalParentId(0, 'ayah')).toThrow(AppError);
    expect(() => parseOptionalParentId(1.5, 'ibu')).toThrow(AppError);
    expect(() => parseOptionalParentId('12', 'ayah')).toThrow(AppError);
  });
});

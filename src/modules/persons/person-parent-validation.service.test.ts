import { describe, expect, it } from 'vitest';
import { AppError } from '../../shared/errors/AppError';
import { assertParentBornBeforeChild } from './person-parent-validation.service';

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

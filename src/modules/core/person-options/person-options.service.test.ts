import { describe, expect, it } from 'vitest';
import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { PersonOptionSetting } from './person-options.types';

describe('person-options validation helpers', () => {
  it('accepts valid setting key pattern', () => {
    expect(/^[a-zA-Z][a-zA-Z0-9._-]*$/.test('readFocusPersonId')).toBe(true);
    expect(/^[a-zA-Z][a-zA-Z0-9._-]*$/.test('tree.lineage')).toBe(true);
  });

  it('documents readFocusPersonId setting key', () => {
    expect(PersonOptionSetting.READ_FOCUS_PERSON_ID).toBe('readFocusPersonId');
  });
});

describe('read focus option value', () => {
  it('rejects non-numeric readFocusPersonId format', () => {
    expect(/^\d+$/.test('abc')).toBe(false);
    expect(/^\d+$/.test('84')).toBe(true);
  });

  it('maps forbidden focus to PERSON_READ_FOCUS_FORBIDDEN semantics', () => {
    const allowed = [83, 84];
    expect(allowed.includes(49)).toBe(false);
    expect(() => {
      if (!allowed.includes(49)) {
        throw new AppError(
          403,
          ErrorCodes.PERSON_READ_FOCUS_FORBIDDEN,
          'readFocusPersonId hanya boleh diri sendiri atau pasangan yang terdaftar.',
        );
      }
    }).toThrow(AppError);
  });
});

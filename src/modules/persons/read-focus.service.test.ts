import { describe, expect, it } from 'vitest';
import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';
import {
  buildReadFocusMeta,
  getAllowedReadFocusPersonIds,
  parseFocusPersonIdParam,
  resolveReadFocusPersonId,
} from './read-focus.service';

describe('read-focus.service', () => {
  describe('resolveReadFocusPersonId', () => {
    const viewerId = 83;
    const spouseIds = [84];

    it('defaults to viewer when param omitted', () => {
      expect(resolveReadFocusPersonId(viewerId, spouseIds)).toBe(83);
    });

    it('allows viewer id', () => {
      expect(resolveReadFocusPersonId(viewerId, spouseIds, 83)).toBe(83);
    });

    it('allows spouse id', () => {
      expect(resolveReadFocusPersonId(viewerId, spouseIds, 84)).toBe(84);
    });

    it('rejects non-spouse id', () => {
      try {
        resolveReadFocusPersonId(viewerId, spouseIds, 49);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(ErrorCodes.PERSON_READ_FOCUS_FORBIDDEN);
        expect((error as AppError).statusCode).toBe(403);
      }
    });
  });

  describe('buildReadFocusMeta', () => {
    it('returns focus and allowed ids', () => {
      expect(buildReadFocusMeta(83, [84], 84)).toEqual({
        focusPersonId: 84,
        allowedFocusPersonIds: [83, 84],
      });
    });
  });

  describe('getAllowedReadFocusPersonIds', () => {
    it('returns self and spouses without duplicates', () => {
      expect(getAllowedReadFocusPersonIds(83, [84])).toEqual([83, 84]);
      expect(getAllowedReadFocusPersonIds(83, [])).toEqual([83]);
    });
  });

  describe('parseFocusPersonIdParam', () => {
    it('parses valid id', () => {
      expect(parseFocusPersonIdParam('84')).toBe(84);
    });

    it('returns undefined when omitted', () => {
      expect(parseFocusPersonIdParam(undefined)).toBeUndefined();
    });

    it('throws on invalid id', () => {
      expect(() => parseFocusPersonIdParam('abc')).toThrow(AppError);
    });
  });
});

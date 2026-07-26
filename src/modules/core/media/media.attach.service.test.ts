import { describe, expect, it } from 'vitest';
import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { isManagedMediaUrl } from './media.storage';

describe('media.storage isManagedMediaUrl', () => {
  it('accepts URLs under configured public base (including purpose subdirs)', () => {
    expect(isManagedMediaUrl('http://localhost:3000/media/events/med_abc.jpg')).toBe(true);
    expect(isManagedMediaUrl('http://localhost:3000/media/memoriam/med_abc.jpg')).toBe(true);
    expect(isManagedMediaUrl('http://localhost:3000/media/persons/med_abc.jpg')).toBe(true);
  });

  it('rejects external and data URLs', () => {
    expect(isManagedMediaUrl('https://cdn.example.com/x.jpg')).toBe(false);
    expect(isManagedMediaUrl('data:image/jpeg;base64,aaa')).toBe(false);
  });
});

describe('media attach validation helpers', () => {
  it('AppError codes match MEDIA contract', () => {
    const err = new AppError(400, ErrorCodes.MEDIA_VALIDATION_FAILED, 'bad');
    expect(err.code).toBe('MEDIA_VALIDATION_FAILED');
    expect(ErrorCodes.MEDIA_DELETE_FORBIDDEN).toBe('MEDIA_DELETE_FORBIDDEN');
    expect(ErrorCodes.MEDIA_LIMIT_EXCEEDED).toBe('MEDIA_LIMIT_EXCEEDED');
  });
});

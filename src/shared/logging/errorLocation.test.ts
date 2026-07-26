import { describe, expect, it } from 'vitest';
import { extractErrorLocation, serializeUnknownError } from './errorLocation';

describe('extractErrorLocation', () => {
  it('picks first non-node_modules frame', () => {
    const error = new Error('boom');
    error.stack = [
      'Error: boom',
      '    at Object.<anonymous> (/Users/me/app/node_modules/foo/index.js:1:1)',
      '    at PersonImportService.createJob (/Users/me/app/src/modules/persons/import/person-import.service.ts:120:15)',
    ].join('\n');

    expect(extractErrorLocation(error)).toEqual({
      file: '/Users/me/app/src/modules/persons/import/person-import.service.ts',
      line: 120,
      column: 15,
      frame:
        'at PersonImportService.createJob (/Users/me/app/src/modules/persons/import/person-import.service.ts:120:15)',
    });
  });

  it('serializes Error and non-Error', () => {
    expect(serializeUnknownError(new Error('x')).message).toBe('x');
    expect(serializeUnknownError('plain').name).toBe('NonError');
  });
});

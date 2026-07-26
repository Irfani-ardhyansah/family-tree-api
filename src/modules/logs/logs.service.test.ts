import { describe, expect, it } from 'vitest';
import { isAllowedNavigationPath, normalizeNavigationPath } from './navigation-paths';
import { logsService } from './logs.service';

describe('navigation-paths', () => {
  it('normalizes trailing slash and query', () => {
    expect(normalizeNavigationPath('/family/map/')).toBe('/family/map');
    expect(normalizeNavigationPath('/events?tab=upcoming')).toBe('/events');
  });

  it('allows core app pages including map, events, memoriam', () => {
    expect(isAllowedNavigationPath('/tree')).toBe(true);
    expect(isAllowedNavigationPath('/family/map')).toBe(true);
    expect(isAllowedNavigationPath('/events')).toBe(true);
    expect(isAllowedNavigationPath('/events/5')).toBe(true);
    expect(isAllowedNavigationPath('/in-memoriam')).toBe(true);
    expect(isAllowedNavigationPath('/in-memoriam/17')).toBe(true);
    expect(isAllowedNavigationPath('/in-memoriam/17/doa')).toBe(true);
    expect(isAllowedNavigationPath('/persons/49')).toBe(true);
  });

  it('rejects unknown paths', () => {
    expect(isAllowedNavigationPath('/unknown')).toBe(false);
    expect(isAllowedNavigationPath('/api/v1/events')).toBe(false);
  });
});

describe('logsService.inferAuditAction', () => {
  it('maps persons map read', () => {
    expect(logsService.inferAuditAction('GET', '/api/v1/persons/map')).toBe('person.map.read');
  });

  it('maps persons import actions', () => {
    expect(logsService.inferAuditAction('GET', '/api/v1/persons/import/template')).toBe(
      'person.import.template',
    );
    expect(logsService.inferAuditAction('POST', '/api/v1/persons/import')).toBe(
      'person.import.enqueue',
    );
    expect(
      logsService.inferAuditAction('GET', '/api/v1/persons/import/jobs/imp_abc'),
    ).toBe('person.import.job.read');
  });

  it('maps events CRUD and read', () => {
    expect(logsService.inferAuditAction('GET', '/api/v1/events')).toBe('event.read');
    expect(logsService.inferAuditAction('POST', '/api/v1/events')).toBe('event.create');
    expect(logsService.inferAuditAction('PATCH', '/api/v1/events/1')).toBe('event.update');
    expect(logsService.inferAuditAction('POST', '/api/v1/events/1/contributions')).toBe(
      'event.contribution.create',
    );
  });

  it('maps memoriam read and write', () => {
    expect(logsService.inferAuditAction('GET', '/api/v1/memoriam/deceased')).toBe('memorial.read');
    expect(logsService.inferAuditAction('POST', '/api/v1/memoriam/17/tributes')).toBe(
      'memorial.tribute.create',
    );
    expect(logsService.inferAuditAction('PATCH', '/api/v1/memoriam/17/tributes/3')).toBe(
      'memorial.tribute.update',
    );
    expect(logsService.inferAuditAction('DELETE', '/api/v1/memoriam/17/tributes/3')).toBe(
      'memorial.tribute.delete',
    );
    expect(logsService.inferAuditAction('POST', '/api/v1/memoriam/17/prayers')).toBe(
      'memorial.prayer.create',
    );
  });
});

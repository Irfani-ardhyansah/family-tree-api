import { describe, expect, it } from 'vitest';
import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';
import { hasTreeFilterParams, parseTreeFilterQuery } from './tree-filter-query.service';

describe('tree-filter-query.service', () => {
  it('returns applied=false when no filter params', () => {
    const result = parseTreeFilterQuery({ view: 'tree', focusPersonId: '83' });
    expect(result.applied).toBe(false);
    expect(result.filter).toEqual({
      lineage: 'both',
      generationsUp: 4,
      showSpouses: false,
      showSiblings: false,
      showChildren: false,
    });
  });

  it('detects filter params presence', () => {
    expect(hasTreeFilterParams({ view: 'tree' })).toBe(false);
    expect(hasTreeFilterParams({ lineage: 'paternal' })).toBe(true);
    expect(hasTreeFilterParams({ showChildren: 'true' })).toBe(true);
  });

  it('parses full preset with defaults for omitted params', () => {
    const result = parseTreeFilterQuery({
      lineage: 'both',
      showSpouses: 'true',
    });

    expect(result.applied).toBe(true);
    expect(result.filter).toEqual({
      lineage: 'both',
      generationsUp: 4,
      showSpouses: true,
      showSiblings: false,
      showChildren: false,
    });
  });

  it('rejects invalid lineage', () => {
    expect(() => parseTreeFilterQuery({ lineage: 'invalid' })).toThrow(AppError);
    try {
      parseTreeFilterQuery({ lineage: 'invalid' });
    } catch (error) {
      expect((error as AppError).code).toBe(ErrorCodes.TREE_FILTER_INVALID);
    }
  });

  it('rejects invalid generationsUp', () => {
    expect(() => parseTreeFilterQuery({ generationsUp: '0' })).toThrow(AppError);
    expect(() => parseTreeFilterQuery({ generationsUp: '13' })).toThrow(AppError);
    expect(() => parseTreeFilterQuery({ generationsUp: 'abc' })).toThrow(AppError);
  });

  it('rejects invalid boolean params', () => {
    expect(() => parseTreeFilterQuery({ showSpouses: 'yes' })).toThrow(AppError);
  });

  it('accepts boolean aliases 1/0', () => {
    const result = parseTreeFilterQuery({
      showSpouses: '1',
      showSiblings: '0',
      showChildren: 'true',
    });
    expect(result.filter.showSpouses).toBe(true);
    expect(result.filter.showSiblings).toBe(false);
    expect(result.filter.showChildren).toBe(true);
  });
});

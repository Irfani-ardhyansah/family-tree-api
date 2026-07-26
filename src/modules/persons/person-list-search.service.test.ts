import { describe, expect, it } from 'vitest';
import {
  matchesPersonWordSearch,
  parseListSearchQuery,
  tokenizeSearchWords,
} from './person-list-search.service';

describe('person-list-search', () => {
  it('tokenizes words and strips punctuation', () => {
    expect(tokenizeSearchWords('  Mulyono Basuki  ')).toEqual(['mulyono', 'basuki']);
    expect(tokenizeSearchWords('H. Basuki Mulyono')).toEqual(['h', 'basuki', 'mulyono']);
  });

  it('matches regardless of word order (AND)', () => {
    const person = { full_name: 'Basuki Mulyono', nickname: null };
    expect(matchesPersonWordSearch(person, 'Mulyono Basuki')).toBe(true);
    expect(matchesPersonWordSearch(person, 'Basuki Mulyono')).toBe(true);
    expect(matchesPersonWordSearch(person, 'Mulyono')).toBe(true);
    expect(matchesPersonWordSearch(person, 'Basuki Widodo')).toBe(false);
  });

  it('does not match partial letter prefixes', () => {
    const person = { full_name: 'Mulyono Basuki', nickname: 'Yon' };
    expect(matchesPersonWordSearch(person, 'Mul')).toBe(false);
    expect(matchesPersonWordSearch(person, 'Bas')).toBe(false);
    expect(matchesPersonWordSearch(person, 'Yon')).toBe(true);
  });

  it('parses q query', () => {
    expect(parseListSearchQuery('  Mulyono  ')).toBe('Mulyono');
    expect(parseListSearchQuery('')).toBeUndefined();
    expect(parseListSearchQuery(undefined)).toBeUndefined();
  });
});

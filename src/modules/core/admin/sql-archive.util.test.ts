import { describe, expect, it } from 'vitest';
import {
  extractSqlFromArchive,
  unzipFirstFile,
  zipOneFile,
} from './sql-archive.util';
import { gzipSync } from 'zlib';

describe('sql-archive.util', () => {
  it('round-trips a single-file zip', () => {
    const sql = Buffer.from('-- MySQL dump\nCREATE TABLE t (id INT);\n', 'utf8');
    const zip = zipOneFile('family-tree.sql', sql);
    const extracted = unzipFirstFile(zip);
    expect(extracted.name).toBe('family-tree.sql');
    expect(extracted.data.equals(sql)).toBe(true);
  });

  it('extracts .sql.zip / .sql.gz / .sql', () => {
    const sql = Buffer.from('SET NAMES utf8mb4;\nDROP TABLE IF EXISTS x;\n', 'utf8');
    const zip = zipOneFile('dump.sql', sql);
    expect(extractSqlFromArchive(zip, 'a.sql.zip').equals(sql)).toBe(true);
    expect(extractSqlFromArchive(gzipSync(sql), 'a.sql.gz').equals(sql)).toBe(true);
    expect(extractSqlFromArchive(sql, 'a.sql').equals(sql)).toBe(true);
  });
});

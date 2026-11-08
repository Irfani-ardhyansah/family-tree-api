import { describe, expect, it } from 'vitest';
import {
  buildMcpTokenHint,
  generateMcpToken,
  hashMcpToken,
  isMcpTokenActive,
  parseMcpTokenLabel,
  parseMcpUnlockModules,
  parseStoredUnlockModules,
} from './mcp-token.helpers';

describe('mcp-token.helpers', () => {
  describe('generateMcpToken', () => {
    it('memakai prefix frmcp_ dan cukup panjang', () => {
      const token = generateMcpToken();
      expect(token.startsWith('frmcp_')).toBe(true);
      expect(token.length).toBeGreaterThan(40);
    });

    it('menghasilkan token berbeda', () => {
      expect(generateMcpToken()).not.toBe(generateMcpToken());
    });
  });

  describe('hashMcpToken', () => {
    it('deterministik dan sha256 hex', () => {
      const token = 'frmcp_contoh';
      expect(hashMcpToken(token)).toBe(hashMcpToken(token));
      expect(hashMcpToken(token)).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('buildMcpTokenHint', () => {
    it('menyembunyikan sebagian token', () => {
      const hint = buildMcpTokenHint('frmcp_abcdefghijklmnopqrstuvwxyz1234');
      expect(hint).toBe('frmcp_abcdef...1234');
    });
  });

  describe('parseMcpTokenLabel', () => {
    it('default MCP kalau kosong', () => {
      expect(parseMcpTokenLabel(undefined)).toBe('MCP');
      expect(parseMcpTokenLabel('   ')).toBe('MCP');
    });

    it('trim label dan menolak yang terlalu panjang', () => {
      expect(parseMcpTokenLabel('  Discord  ')).toBe('Discord');
      expect(() => parseMcpTokenLabel('x'.repeat(61))).toThrow();
    });
  });

  describe('parseMcpUnlockModules', () => {
    it('undefined = warisi unlock header', () => {
      expect(parseMcpUnlockModules(undefined)).toBeNull();
    });

    it('null dan array kosong = tanpa modul', () => {
      expect(parseMcpUnlockModules(null)).toEqual([]);
      expect(parseMcpUnlockModules([])).toEqual([]);
    });

    it('normalisasi, dedupe, dan lowercase', () => {
      expect(parseMcpUnlockModules(['MONEY', 'money', 'core'])).toEqual(['money', 'core']);
    });

    it('menolak modul admin dan modul asing', () => {
      expect(() => parseMcpUnlockModules(['admin'])).toThrow();
      expect(() => parseMcpUnlockModules(['roots'])).toThrow();
      expect(() => parseMcpUnlockModules('money')).toThrow();
    });
  });

  describe('parseStoredUnlockModules', () => {
    it('membaca array dan string JSON', () => {
      expect(parseStoredUnlockModules(['money', 'admin'])).toEqual(['money']);
      expect(parseStoredUnlockModules('["core","money"]')).toEqual(['core', 'money']);
    });

    it('aman untuk nilai rusak', () => {
      expect(parseStoredUnlockModules('bukan json')).toEqual([]);
      expect(parseStoredUnlockModules(null)).toEqual([]);
    });
  });

  describe('isMcpTokenActive', () => {
    const base = {
      id: 1,
      family_id: 1,
      person_id: 1,
      label: 'MCP',
      token_hash: 'x',
      token_hint: 'frmcp_x',
      unlock_modules: [],
      last_used_at: null,
      created_at: '2026-11-07T00:00:00.000Z',
    };

    it('aktif kalau belum dicabut dan belum kedaluwarsa', () => {
      expect(isMcpTokenActive({ ...base, expires_at: null, revoked_at: null })).toBe(true);
      expect(
        isMcpTokenActive({
          ...base,
          expires_at: '2026-11-08T00:00:00.000Z',
          revoked_at: null,
        }),
      ).toBe(true);
    });

    it('tidak aktif kalau dicabut atau kedaluwarsa', () => {
      expect(
        isMcpTokenActive({
          ...base,
          expires_at: null,
          revoked_at: '2026-11-07T00:00:00.000Z',
        }),
      ).toBe(false);
      expect(
        isMcpTokenActive({
          ...base,
          expires_at: '2026-11-06T00:00:00.000Z',
          revoked_at: null,
        }),
      ).toBe(false);
    });
  });
});

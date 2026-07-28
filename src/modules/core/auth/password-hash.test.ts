import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password-hash';

describe('password-hash', () => {
  it('hashes and verifies', async () => {
    const hash = await hashPassword('rahasia123');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('rahasia123', hash)).toBe(true);
    expect(await verifyPassword('salah', hash)).toBe(false);
  });
});

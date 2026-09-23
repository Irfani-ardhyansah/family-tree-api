import { describe, expect, it } from 'vitest';
import { AppError } from '../../../../shared/errors/AppError';
import {
  challengeFromClientData,
  parseAdminCredentialPatch,
  parseLabel,
  parseUserLabelPatch,
  toAuthenticationResponse,
} from './webauthn.parser';

describe('webauthn.parser', () => {
  it('trims a label and rejects empty or long values', () => {
    expect(parseLabel('  Telunjuk kanan  ')).toBe('Telunjuk kanan');
    expect(() => parseLabel('   ')).toThrow(AppError);
    expect(() => parseLabel('x'.repeat(41))).toThrow(AppError);
  });

  it('rejects enabled on a user patch', () => {
    expect(parseUserLabelPatch({ label: 'Jempol kiri' })).toBe('Jempol kiri');
    expect(() => parseUserLabelPatch({ label: 'Jempol kiri', enabled: true })).toThrow(AppError);
  });

  it('accepts admin label or enabled patches', () => {
    expect(parseAdminCredentialPatch({ enabled: false })).toEqual({ enabled: false });
    expect(parseAdminCredentialPatch({ label: 'HP', enabled: true })).toEqual({
      label: 'HP',
      enabled: true,
    });
    expect(() => parseAdminCredentialPatch({})).toThrow(AppError);
    expect(() => parseAdminCredentialPatch({ enabled: 'false' })).toThrow(AppError);
  });

  it('reads the challenge from clientDataJSON', () => {
    const clientDataJSON = Buffer.from(
      JSON.stringify({ type: 'webauthn.get', challenge: 'abc123', origin: 'http://localhost:5173' }),
    ).toString('base64url');
    expect(challengeFromClientData(clientDataJSON)).toBe('abc123');
    expect(challengeFromClientData('not-json')).toBeNull();
  });

  it('strips remember before treating the body as an assertion', () => {
    const assertion = toAuthenticationResponse({
      id: 'cred',
      rawId: 'cred',
      type: 'public-key',
      remember: true,
      response: {
        clientDataJSON: 'e30',
        authenticatorData: 'e30',
        signature: 'e30',
      },
      clientExtensionResults: {},
    });
    expect(assertion.id).toBe('cred');
    expect(assertion).not.toHaveProperty('remember');
  });
});

import { AppError } from '../../../../shared/errors/AppError';
import { ErrorCodes } from '../../../../shared/errors/errorCodes';
import {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';

const LABEL_MAX = 40;

function asRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Payload tidak valid.');
  }
  return body as Record<string, unknown>;
}

export function parseLabel(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'label wajib diisi.');
  }
  const label = raw.trim();
  if (label.length < 1) {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'label wajib diisi.');
  }
  if (label.length > LABEL_MAX) {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'label maksimal 40 karakter.');
  }
  return label;
}

export function parseRegisterLabel(body: unknown): string {
  return parseLabel(asRecord(body).label);
}

export function parseUserLabelPatch(body: unknown): string {
  const record = asRecord(body);
  if ('enabled' in record) {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'User tidak bisa mengubah status perangkat.');
  }
  return parseLabel(record.label);
}

export function parseAdminCredentialPatch(body: unknown): { label?: string; enabled?: boolean } {
  const record = asRecord(body);
  const patch: { label?: string; enabled?: boolean } = {};

  if ('label' in record) {
    patch.label = parseLabel(record.label);
  }
  if ('enabled' in record) {
    if (typeof record.enabled !== 'boolean') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'enabled harus boolean.');
    }
    patch.enabled = record.enabled;
  }
  if (patch.label === undefined && patch.enabled === undefined) {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'label atau enabled wajib diisi.');
  }
  return patch;
}

export function parseCredentialIdParam(raw: string): number {
  if (!/^\d+$/.test(raw)) {
    throw new AppError(404, ErrorCodes.BIOMETRIC_CREDENTIAL_NOT_FOUND, 'Biometrik tidak ditemukan.');
  }
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new AppError(404, ErrorCodes.BIOMETRIC_CREDENTIAL_NOT_FOUND, 'Biometrik tidak ditemukan.');
  }
  return id;
}

export function challengeFromClientData(clientDataJSON: string): string | null {
  try {
    const json = JSON.parse(Buffer.from(clientDataJSON, 'base64url').toString('utf8')) as {
      challenge?: unknown;
    };
    return typeof json.challenge === 'string' && json.challenge.length > 0 ? json.challenge : null;
  } catch {
    return null;
  }
}

export function toAuthenticationResponse(body: unknown): AuthenticationResponseJSON {
  const record = asRecord(body);
  const response = record.response;
  if (
    typeof record.id !== 'string' ||
    typeof record.rawId !== 'string' ||
    record.type !== 'public-key' ||
    !response ||
    typeof response !== 'object' ||
    Array.isArray(response)
  ) {
    throw new AppError(401, ErrorCodes.BIOMETRIC_VERIFICATION_FAILED, 'Verifikasi biometrik gagal.');
  }

  const assertion = response as Record<string, unknown>;
  if (
    typeof assertion.clientDataJSON !== 'string' ||
    typeof assertion.authenticatorData !== 'string' ||
    typeof assertion.signature !== 'string'
  ) {
    throw new AppError(401, ErrorCodes.BIOMETRIC_VERIFICATION_FAILED, 'Verifikasi biometrik gagal.');
  }

  const extensions = record.clientExtensionResults;
  return {
    id: record.id,
    rawId: record.rawId,
    type: 'public-key',
    authenticatorAttachment:
      record.authenticatorAttachment === 'platform' || record.authenticatorAttachment === 'cross-platform'
        ? record.authenticatorAttachment
        : undefined,
    clientExtensionResults:
      extensions && typeof extensions === 'object' && !Array.isArray(extensions)
        ? (extensions as AuthenticationResponseJSON['clientExtensionResults'])
        : {},
    response: {
      clientDataJSON: assertion.clientDataJSON,
      authenticatorData: assertion.authenticatorData,
      signature: assertion.signature,
      userHandle: typeof assertion.userHandle === 'string' ? assertion.userHandle : undefined,
    },
  };
}

export function toRegistrationResponse(body: unknown): RegistrationResponseJSON {
  const record = asRecord(body);
  const response = record.response;
  if (
    typeof record.id !== 'string' ||
    typeof record.rawId !== 'string' ||
    record.type !== 'public-key' ||
    !response ||
    typeof response !== 'object' ||
    Array.isArray(response)
  ) {
    throw new AppError(401, ErrorCodes.BIOMETRIC_VERIFICATION_FAILED, 'Verifikasi biometrik gagal.');
  }

  const attestation = response as Record<string, unknown>;
  if (typeof attestation.clientDataJSON !== 'string' || typeof attestation.attestationObject !== 'string') {
    throw new AppError(401, ErrorCodes.BIOMETRIC_VERIFICATION_FAILED, 'Verifikasi biometrik gagal.');
  }

  const extensions = record.clientExtensionResults;
  const transports = Array.isArray(attestation.transports)
    ? attestation.transports.filter((item): item is string => typeof item === 'string')
    : undefined;

  return {
    id: record.id,
    rawId: record.rawId,
    type: 'public-key',
    authenticatorAttachment:
      record.authenticatorAttachment === 'platform' || record.authenticatorAttachment === 'cross-platform'
        ? record.authenticatorAttachment
        : undefined,
    clientExtensionResults:
      extensions && typeof extensions === 'object' && !Array.isArray(extensions)
        ? (extensions as RegistrationResponseJSON['clientExtensionResults'])
        : {},
    response: {
      clientDataJSON: attestation.clientDataJSON,
      attestationObject: attestation.attestationObject,
      transports,
    },
  };
}

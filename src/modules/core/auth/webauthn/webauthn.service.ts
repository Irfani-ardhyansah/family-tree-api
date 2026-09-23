import { Request } from 'express';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { env } from '../../../../config/env';
import { AppError } from '../../../../shared/errors/AppError';
import { ErrorCodes } from '../../../../shared/errors/errorCodes';
import { adminAuditService } from '../../admin/admin-audit.service';
import { moduleStatusService } from '../../admin/module-status.service';
import { authRepository } from '../auth.repository';
import { authService } from '../auth.service';
import { LoginResponse } from '../auth.types';
import { SENSITIVE_MODULES } from '../secondary-password.constants';
import { secondaryPasswordRepository } from '../secondary-password.repository';
import { tokenService } from '../token.service';
import {
  challengeFromClientData,
  parseAdminCredentialPatch,
  parseRegisterLabel,
  parseUserLabelPatch,
  toAuthenticationResponse,
  toRegistrationResponse,
} from './webauthn.parser';
import { webauthnRepository } from './webauthn.repository';
import {
  CredentialRow,
  WebauthnAdminCredentialItem,
  WebauthnCredentialItem,
} from './webauthn.types';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const NOT_FOUND = 'Biometrik tidak ditemukan.';

function toIso(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
}

function toIsoOrNull(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseTransports(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (typeof value === 'string' && value.length > 0) {
    try {
      return parseTransports(JSON.parse(value) as unknown);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function toPublicKey(value: Buffer): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(new ArrayBuffer(value.byteLength));
  copy.set(value);
  return copy as Uint8Array<ArrayBuffer>;
}

function toItem(row: CredentialRow): WebauthnCredentialItem {
  return {
    id: Number(row.id),
    label: row.label,
    enabled: Boolean(row.enabled),
    createdAt: toIso(row.created_at),
    lastUsedAt: toIsoOrNull(row.last_used_at),
  };
}

function toAdminItem(row: CredentialRow): WebauthnAdminCredentialItem {
  return {
    ...toItem(row),
    personId: Number(row.person_id),
    personName: row.person_name ?? '',
  };
}

function disabledError(): AppError {
  return new AppError(403, ErrorCodes.BIOMETRIC_DISABLED, 'Login biometrik dimatikan admin.');
}

function notFoundError(): AppError {
  return new AppError(404, ErrorCodes.BIOMETRIC_CREDENTIAL_NOT_FOUND, NOT_FOUND);
}

export class WebauthnService {
  async loginOptions(): Promise<Awaited<ReturnType<typeof generateAuthenticationOptions>>> {
    const enabled = await webauthnRepository.anyModuleEnabled('biometric');
    if (!enabled) {
      throw disabledError();
    }

    const options = await generateAuthenticationOptions({
      rpID: env.webauthn.rpId,
      allowCredentials: [],
      userVerification: 'required',
      timeout: CHALLENGE_TTL_MS,
    });
    await webauthnRepository.saveChallenge({
      personId: null,
      kind: 'login',
      challenge: options.challenge,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    });
    return options;
  }

  async loginVerify(req: Request, body: unknown): Promise<LoginResponse> {
    const assertion = toAuthenticationResponse(body);
    const challenge = challengeFromClientData(assertion.response.clientDataJSON);
    if (!challenge) {
      throw new AppError(
        400,
        ErrorCodes.BIOMETRIC_CHALLENGE_EXPIRED,
        'Sesi verifikasi kedaluwarsa. Ulangi dari awal.',
      );
    }

    const consumed = await webauthnRepository.consumeChallenge({
      challenge,
      kind: 'login',
      personId: null,
    });
    if (!consumed) {
      throw new AppError(
        400,
        ErrorCodes.BIOMETRIC_CHALLENGE_EXPIRED,
        'Sesi verifikasi kedaluwarsa. Ulangi dari awal.',
      );
    }

    const row = await webauthnRepository.findByCredentialId(assertion.id);
    if (!row) {
      throw notFoundError();
    }

    const moduleOn = await moduleStatusService.isEnabled(row.family_id, 'biometric');
    if (!moduleOn) {
      throw disabledError();
    }
    if (!Boolean(row.enabled)) {
      throw new AppError(
        403,
        ErrorCodes.BIOMETRIC_CREDENTIAL_DISABLED,
        'Perangkat ini dinonaktifkan admin.',
      );
    }

    let verified = false;
    let newCounter = Number(row.counter);
    try {
      const result = await verifyAuthenticationResponse({
        response: assertion,
        expectedChallenge: challenge,
        expectedOrigin: env.webauthn.origin,
        expectedRPID: env.webauthn.rpId,
        requireUserVerification: true,
        credential: {
          id: row.credential_id,
          publicKey: toPublicKey(row.public_key),
          counter: Number(row.counter),
          transports: parseTransports(row.transports),
        },
      });
      verified = result.verified;
      newCounter = result.authenticationInfo.newCounter;
    } catch {
      verified = false;
    }

    if (!verified) {
      throw new AppError(401, ErrorCodes.BIOMETRIC_VERIFICATION_FAILED, 'Verifikasi biometrik gagal.');
    }

    await webauthnRepository.markUsed(Number(row.id), newCounter);

    const person = await authRepository.findPersonById(row.person_id);
    if (!person || person.status !== 'alive') {
      throw new AppError(401, ErrorCodes.BIOMETRIC_VERIFICATION_FAILED, 'Verifikasi biometrik gagal.');
    }

    const remember = Boolean(body && typeof body === 'object' && (body as { remember?: unknown }).remember === true);
    return authService.establishSession(req, person, remember, {
      path: '/api/v1/auth/webauthn/login/verify',
      logAction: 'auth.webauthn.login',
      logMessage: 'Login biometrik berhasil',
      auditSummary: 'Login biometrik berhasil',
    });
  }

  async unlockOptions(personId: number, familyId: number) {
    await this.assertCanUnlock(personId, familyId);
    const rows = await webauthnRepository.listByPerson(personId);
    const active = rows.filter((row) => Boolean(row.enabled));
    if (active.length === 0) {
      throw notFoundError();
    }

    const options = await generateAuthenticationOptions({
      rpID: env.webauthn.rpId,
      allowCredentials: active.map((item) => ({
        id: item.credential_id,
        transports: parseTransports(item.transports),
      })),
      userVerification: 'required',
      timeout: CHALLENGE_TTL_MS,
    });
    await webauthnRepository.saveChallenge({
      personId,
      kind: 'unlock',
      challenge: options.challenge,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    });
    return options;
  }

  async unlockVerify(personId: number, familyId: number, body: unknown) {
    await this.assertCanUnlock(personId, familyId);

    const assertion = toAuthenticationResponse(body);
    const challenge = challengeFromClientData(assertion.response.clientDataJSON);
    if (!challenge) {
      throw new AppError(
        400,
        ErrorCodes.BIOMETRIC_CHALLENGE_EXPIRED,
        'Sesi verifikasi kedaluwarsa. Ulangi dari awal.',
      );
    }

    const consumed = await webauthnRepository.consumeChallenge({
      challenge,
      kind: 'unlock',
      personId,
    });
    if (!consumed) {
      throw new AppError(
        400,
        ErrorCodes.BIOMETRIC_CHALLENGE_EXPIRED,
        'Sesi verifikasi kedaluwarsa. Ulangi dari awal.',
      );
    }

    const row = await webauthnRepository.findByCredentialId(assertion.id);
    if (!row || Number(row.person_id) !== personId || Number(row.family_id) !== familyId) {
      throw notFoundError();
    }
    if (!Boolean(row.enabled)) {
      throw new AppError(
        403,
        ErrorCodes.BIOMETRIC_CREDENTIAL_DISABLED,
        'Perangkat ini dinonaktifkan admin.',
      );
    }

    let verified = false;
    let newCounter = Number(row.counter);
    try {
      const result = await verifyAuthenticationResponse({
        response: assertion,
        expectedChallenge: challenge,
        expectedOrigin: env.webauthn.origin,
        expectedRPID: env.webauthn.rpId,
        requireUserVerification: true,
        credential: {
          id: row.credential_id,
          publicKey: toPublicKey(row.public_key),
          counter: Number(row.counter),
          transports: parseTransports(row.transports),
        },
      });
      verified = result.verified;
      newCounter = result.authenticationInfo.newCounter;
    } catch {
      verified = false;
    }

    if (!verified) {
      throw new AppError(401, ErrorCodes.BIOMETRIC_VERIFICATION_FAILED, 'Verifikasi biometrik gagal.');
    }

    await webauthnRepository.markUsed(Number(row.id), newCounter);
    const unlock = tokenService.signModuleUnlock(personId, familyId);
    return {
      unlockToken: unlock.unlockToken,
      expiresIn: unlock.expiresIn,
      modules: [...SENSITIVE_MODULES],
    };
  }

  async registerOptions(personId: number, familyId: number) {
    await this.assertCanRegister(personId, familyId);
    const person = await authRepository.findPersonById(personId);
    if (!person || person.status !== 'alive') {
      throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Autentikasi diperlukan.');
    }

    const existing = await webauthnRepository.listCredentialIdsByPerson(personId);
    const displayName = person.full_name.trim() || `Person ${person.id}`;
    const userIdBytes = Buffer.from(String(person.id), 'utf8');
    const userID = new Uint8Array(new ArrayBuffer(userIdBytes.byteLength));
    userID.set(userIdBytes);
    const options = await generateRegistrationOptions({
      rpName: env.webauthn.rpName,
      rpID: env.webauthn.rpId,
      userName: displayName,
      userDisplayName: displayName,
      userID: userID as Uint8Array<ArrayBuffer>,
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'required',
        userVerification: 'required',
      },
      excludeCredentials: existing.map((item) => ({
        id: item.credentialId,
        transports: parseTransports(item.transports),
      })),
      timeout: CHALLENGE_TTL_MS,
    });

    await webauthnRepository.saveChallenge({
      personId,
      kind: 'register',
      challenge: options.challenge,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    });
    return options;
  }

  async registerVerify(personId: number, familyId: number, body: unknown): Promise<WebauthnCredentialItem> {
    const label = parseRegisterLabel(body);
    await this.assertCanRegister(personId, familyId);

    const attestation = toRegistrationResponse(body);
    const challenge = challengeFromClientData(attestation.response.clientDataJSON);
    if (!challenge) {
      throw new AppError(
        400,
        ErrorCodes.BIOMETRIC_CHALLENGE_EXPIRED,
        'Sesi verifikasi kedaluwarsa. Ulangi dari awal.',
      );
    }

    const consumed = await webauthnRepository.consumeChallenge({
      challenge,
      kind: 'register',
      personId,
    });
    if (!consumed) {
      throw new AppError(
        400,
        ErrorCodes.BIOMETRIC_CHALLENGE_EXPIRED,
        'Sesi verifikasi kedaluwarsa. Ulangi dari awal.',
      );
    }

    let registration: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
    try {
      registration = await verifyRegistrationResponse({
        response: attestation,
        expectedChallenge: challenge,
        expectedOrigin: env.webauthn.origin,
        expectedRPID: env.webauthn.rpId,
        requireUserVerification: true,
      });
    } catch {
      throw new AppError(401, ErrorCodes.BIOMETRIC_VERIFICATION_FAILED, 'Verifikasi biometrik gagal.');
    }

    if (!registration.verified) {
      throw new AppError(401, ErrorCodes.BIOMETRIC_VERIFICATION_FAILED, 'Verifikasi biometrik gagal.');
    }

    const credential = registration.registrationInfo.credential;
    const inserted = await webauthnRepository.insertCredential({
      familyId,
      personId,
      label,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? attestation.response.transports ?? null,
    });

    if (!inserted.ok && inserted.reason === 'limit') {
      throw new AppError(409, ErrorCodes.BIOMETRIC_LIMIT_REACHED, 'Maksimal 2 perangkat. Hapus satu perangkat dulu.');
    }
    if (!inserted.ok) {
      throw new AppError(409, ErrorCodes.BIOMETRIC_CREDENTIAL_EXISTS, 'Perangkat ini sudah terdaftar.');
    }

    const row = await webauthnRepository.findById(inserted.id);
    if (!row) {
      throw notFoundError();
    }
    return toItem(row);
  }

  async listOwn(personId: number): Promise<{ items: WebauthnCredentialItem[] }> {
    const rows = await webauthnRepository.listByPerson(personId);
    return { items: rows.map(toItem) };
  }

  async updateOwnLabel(personId: number, id: number, body: unknown): Promise<WebauthnCredentialItem> {
    const label = parseUserLabelPatch(body);
    const updated = await webauthnRepository.updateOwnedLabel(personId, id, label);
    if (!updated) {
      throw notFoundError();
    }
    const row = await webauthnRepository.findOwned(personId, id);
    if (!row) {
      throw notFoundError();
    }
    return toItem(row);
  }

  async deleteOwn(personId: number, id: number): Promise<{ deleted: true }> {
    const deleted = await webauthnRepository.deleteOwned(personId, id);
    if (!deleted) {
      throw notFoundError();
    }
    return { deleted: true };
  }

  async listFamily(familyId: number): Promise<{ items: WebauthnAdminCredentialItem[] }> {
    const rows = await webauthnRepository.listByFamily(familyId);
    return { items: rows.map(toAdminItem) };
  }

  async updateFamily(
    familyId: number,
    actorPersonId: number,
    id: number,
    body: unknown,
  ): Promise<WebauthnAdminCredentialItem> {
    const patch = parseAdminCredentialPatch(body);
    const current = await webauthnRepository.findInFamily(familyId, id);
    if (!current) {
      throw notFoundError();
    }

    const updated = await webauthnRepository.updateInFamily(familyId, id, patch);
    if (!updated) {
      throw notFoundError();
    }
    const row = await webauthnRepository.findInFamily(familyId, id);
    if (!row) {
      throw notFoundError();
    }

    await adminAuditService.record({
      familyId,
      actorPersonId,
      moduleId: 'admin',
      action: 'update',
      summary: 'Biometrik diperbarui',
      before: { id, label: current.label, enabled: Boolean(current.enabled) },
      after: { id, label: row.label, enabled: Boolean(row.enabled) },
    });

    return toAdminItem(row);
  }

  async deleteFamily(familyId: number, actorPersonId: number, id: number): Promise<{ deleted: true }> {
    const current = await webauthnRepository.findInFamily(familyId, id);
    if (!current) {
      throw notFoundError();
    }
    const deleted = await webauthnRepository.deleteInFamily(familyId, id);
    if (!deleted) {
      throw notFoundError();
    }

    await adminAuditService.record({
      familyId,
      actorPersonId,
      moduleId: 'admin',
      action: 'delete',
      summary: 'Biometrik dihapus',
      before: {
        id,
        personId: Number(current.person_id),
        label: current.label,
        enabled: Boolean(current.enabled),
      },
    });

    return { deleted: true };
  }

  private async assertCanUnlock(personId: number, familyId: number): Promise<void> {
    const enabled = await moduleStatusService.isEnabled(familyId, 'biometric');
    if (!enabled) {
      throw disabledError();
    }
    const isSet = await secondaryPasswordRepository.isSet(personId);
    if (!isSet) {
      throw new AppError(
        409,
        ErrorCodes.SECONDARY_PASSWORD_NOT_SET,
        'Password kedua belum diatur. Lakukan setup terlebih dahulu.',
      );
    }
  }

  private async assertCanRegister(personId: number, familyId: number): Promise<void> {
    const enabled = await moduleStatusService.isEnabled(familyId, 'biometric');
    if (!enabled) {
      throw disabledError();
    }
    const count = await webauthnRepository.countByPerson(personId);
    if (count >= 2) {
      throw new AppError(409, ErrorCodes.BIOMETRIC_LIMIT_REACHED, 'Maksimal 2 perangkat. Hapus satu perangkat dulu.');
    }
  }
}

export const webauthnService = new WebauthnService();

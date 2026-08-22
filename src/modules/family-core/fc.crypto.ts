import crypto from 'crypto';
import { env } from '../../config/env';
import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';

function resolveKey(): Buffer {
  const raw = env.fcDocumentNumberKey.trim();
  let key: Buffer | null = null;

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex');
  } else {
    try {
      const decoded = Buffer.from(raw, 'base64');
      if (decoded.length === 32) key = decoded;
    } catch {
      key = null;
    }
  }

  if (!key || key.length !== 32) {
    throw new AppError(
      500,
      ErrorCodes.INTERNAL_ERROR,
      'FC_DOCUMENT_NUMBER_KEY harus 32-byte (base64 atau hex 64 karakter).',
    );
  }
  return key;
}

export function encryptDocumentNumber(plaintext: string): {
  cipher: string;
  iv: string;
} {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', resolveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    cipher: Buffer.concat([encrypted, tag]).toString('base64'),
    iv: iv.toString('base64'),
  };
}

export function decryptDocumentNumber(cipherB64: string, ivB64: string): string {
  const raw = Buffer.from(cipherB64, 'base64');
  if (raw.length < 17) {
    throw new AppError(500, ErrorCodes.INTERNAL_ERROR, 'Cipher nomor dokumen tidak valid.');
  }
  const data = raw.subarray(0, raw.length - 16);
  const tag = raw.subarray(raw.length - 16);
  const iv = Buffer.from(ivB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', resolveKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function maskDocumentNumber(plaintext: string): string {
  const trimmed = plaintext.trim();
  if (trimmed.length <= 4) return '*'.repeat(Math.max(trimmed.length, 4));
  return `${'*'.repeat(Math.min(trimmed.length - 4, 8))}${trimmed.slice(-4)}`;
}

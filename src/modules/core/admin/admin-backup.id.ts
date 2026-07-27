import { randomBytes } from 'crypto';

export function createBackupJobId(): string {
  return `bak_${randomBytes(12).toString('hex')}`;
}

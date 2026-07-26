import { randomBytes } from 'crypto';

export function createPersonImportJobId(): string {
  return `imp_${randomBytes(12).toString('hex')}`;
}

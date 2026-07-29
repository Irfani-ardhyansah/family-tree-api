import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';
import type { MoneyTransferKind } from './money.constants';
import type { MoneyPocketRow, MoneyWorkspaceRow } from './money.types';

/**
 * Validate transfer kind against pocket ownership rules.
 * Pure helper — safe to unit test.
 */
export function assertTransferKindAllowed(
  kind: MoneyTransferKind,
  workspace: MoneyWorkspaceRow,
  from: MoneyPocketRow,
  to: MoneyPocketRow,
): void {
  if (from.id === to.id) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      'fromPocketId dan toPocketId harus berbeda.',
    );
  }

  if (kind === 'interpersonal') {
    if (workspace.mode !== 'couple') {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        'Transfer interpersonal hanya untuk mode couple.',
      );
    }
    if (from.owner_type !== 'person' || to.owner_type !== 'person') {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        'Transfer interpersonal harus antar pocket personal.',
      );
    }
    if (
      from.owner_person_id == null ||
      to.owner_person_id == null ||
      from.owner_person_id === to.owner_person_id
    ) {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        'Transfer interpersonal harus antar person berbeda.',
      );
    }
    return;
  }

  // interpocket: same person, or personal ↔ joint
  const samePerson =
    from.owner_person_id != null &&
    to.owner_person_id != null &&
    from.owner_person_id === to.owner_person_id;
  const involvesJoint = from.owner_type === 'joint' || to.owner_type === 'joint';

  if (!samePerson && !involvesJoint) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      'Transfer interpocket hanya untuk pocket person yang sama, atau personal ↔ joint.',
    );
  }

  if (involvesJoint && workspace.mode !== 'couple') {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      'Transfer ke/dari joint pocket hanya untuk mode couple.',
    );
  }
}

export function changePercent(current: number, previous: number): number {
  if (previous === 0) {
    if (current === 0) return 0;
    return 100;
  }
  return Math.round(((current - previous) / previous) * 100);
}

export function jakartaYearMonth(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  return `${year}-${month}`;
}

export function parseYearMonth(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      `${field} harus format YYYY-MM.`,
    );
  }
  const [y, m] = value.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, `${field} bukan periode valid.`);
  }
  return value;
}

export function previousYearMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, 1));
  date.setUTCMonth(date.getUTCMonth() - 1);
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

export function yearMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, 1));
  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function monthDateRange(yearMonth: string): { from: string; to: string } {
  const [y, m] = yearMonth.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return {
    from: `${y}-${mm}-01`,
    to: `${y}-${mm}-${String(lastDay).padStart(2, '0')}`,
  };
}

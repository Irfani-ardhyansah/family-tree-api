export const MONEY_PERSON_ROLES = ['husband', 'wife', 'self'] as const;
export type MoneyPersonRole = (typeof MONEY_PERSON_ROLES)[number];

export const MONEY_WORKSPACE_MODES = ['single', 'couple'] as const;
export type MoneyWorkspaceMode = (typeof MONEY_WORKSPACE_MODES)[number];

export const MONEY_ACCOUNT_TYPES = ['bank', 'ewallet', 'cash'] as const;
export type MoneyAccountType = (typeof MONEY_ACCOUNT_TYPES)[number];

export const MONEY_POCKET_OWNER_TYPES = ['person', 'joint'] as const;
export type MoneyPocketOwnerType = (typeof MONEY_POCKET_OWNER_TYPES)[number];

export const MONEY_POCKET_CATEGORIES = [
  'transaksi',
  'tabungan',
  'investasi',
  'custom',
] as const;
export type MoneyPocketCategory = (typeof MONEY_POCKET_CATEGORIES)[number];

export const MONEY_CATEGORY_TYPES = ['income', 'expense'] as const;
export type MoneyCategoryType = (typeof MONEY_CATEGORY_TYPES)[number];

export const MONEY_TRANSACTION_TYPES = [
  'income',
  'expense',
  'opening_balance',
  'adjustment',
] as const;
export type MoneyTransactionType = (typeof MONEY_TRANSACTION_TYPES)[number];

export const MONEY_TRANSFER_KINDS = ['interpersonal', 'interpocket'] as const;
export type MoneyTransferKind = (typeof MONEY_TRANSFER_KINDS)[number];

export const MONEY_DASHBOARD_SCOPES = ['all', 'person'] as const;
export type MoneyDashboardScope = (typeof MONEY_DASHBOARD_SCOPES)[number];

export const MONEY_WISHLIST_PRIORITIES = ['low', 'medium', 'high'] as const;
export type MoneyWishlistPriority = (typeof MONEY_WISHLIST_PRIORITIES)[number];

export const MONEY_DEBT_DIRECTIONS = ['utang', 'piutang'] as const;
export type MoneyDebtDirection = (typeof MONEY_DEBT_DIRECTIONS)[number];

export const MONEY_DEBT_STATUSES = ['open', 'partial', 'paid'] as const;
export type MoneyDebtStatus = (typeof MONEY_DEBT_STATUSES)[number];

export const MONEY_REMINDER_TYPES = [
  'debt_due',
  'budget_near',
  'budget_over',
  'balance_mismatch',
] as const;
export type MoneyReminderType = (typeof MONEY_REMINDER_TYPES)[number];

export const CASH_ACCOUNT_NAME = 'Tunai';
export const CASH_POCKET_NAME = 'Tunai';

export const BUDGET_NEAR_THRESHOLD_PCT = 80;

export const DEFAULT_POCKETS: ReadonlyArray<{
  name: string;
  category: Exclude<MoneyPocketCategory, 'custom'>;
}> = [
  { name: 'Transaksi', category: 'transaksi' },
  { name: 'Tabungan', category: 'tabungan' },
  { name: 'Investasi', category: 'investasi' },
];

export const SEED_EXPENSE_CATEGORIES = [
  'Makan',
  'Transport',
  'Tagihan',
  'Hiburan',
  'Belanja',
  'Kesehatan',
  'Pendidikan',
  'Lainnya',
] as const;

export const SEED_INCOME_CATEGORIES = [
  'Gaji',
  'Bonus',
  'Freelance',
  'Hasil Investasi',
  'Lainnya',
] as const;

export const AUDIT_ENTITY_TYPES = {
  TRANSACTION: 'transaction',
  TRANSFER: 'transfer',
  CASH_WITHDRAWAL: 'cash_withdrawal',
  ADJUSTMENT: 'adjustment',
  DEBT_PAYMENT: 'debt_payment',
} as const;

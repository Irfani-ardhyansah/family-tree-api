import type {
  MoneyAccountType,
  MoneyCategoryType,
  MoneyDebtDirection,
  MoneyDebtStatus,
  MoneyPersonRole,
  MoneyPocketCategory,
  MoneyPocketOwnerType,
  MoneyReminderType,
  MoneyTransactionType,
  MoneyTransferKind,
  MoneyWishlistPriority,
  MoneyWorkspaceMode,
} from './money.constants';

export type MoneyWorkspaceRow = {
  id: number;
  family_id: number;
  mode: MoneyWorkspaceMode;
  couple_linked_at: Date | string | null;
  /** Sticky: true while demo/sample data may still be shown; cleared permanently after wipe. */
  has_sample_data: boolean | number;
  created_at: Date | string;
  updated_at: Date | string;
};

export type MoneyPersonRow = {
  id: number;
  workspace_id: number;
  name: string;
  role: MoneyPersonRole;
  user_id: number | null;
  family_roots_person_id: number | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type MoneyCoupleLinkRow = {
  id: number;
  workspace_id: number;
  person_a_id: number;
  person_b_id: number;
  linked_at: Date | string;
};

export type MoneyAccountRow = {
  id: number;
  workspace_id: number;
  person_id: number;
  name: string;
  type: MoneyAccountType;
  bank_name: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type MoneyPocketRow = {
  id: number;
  workspace_id: number;
  account_id: number;
  owner_type: MoneyPocketOwnerType;
  owner_person_id: number | null;
  category: MoneyPocketCategory;
  name: string;
  goal_amount: number | string | null;
  goal_date: string | null;
  is_system: boolean | number;
  archived_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type MoneyCategoryRow = {
  id: number;
  workspace_id: number;
  name: string;
  type: MoneyCategoryType;
  icon: string | null;
  sort_order: number;
  is_system: boolean | number;
  deleted_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type MoneyTransactionRow = {
  id: number;
  workspace_id: number;
  pocket_id: number;
  category_id: number | null;
  type: MoneyTransactionType;
  amount: number | string;
  date: string;
  note: string | null;
  attachment_media_id: string | null;
  created_by_person_id: number;
  created_at: Date | string;
  updated_at: Date | string;
};

export type MoneyTransferRow = {
  id: number;
  workspace_id: number;
  kind: MoneyTransferKind;
  from_pocket_id: number;
  to_pocket_id: number;
  amount: number | string;
  date: string;
  note: string | null;
  created_by_person_id: number;
  created_at: Date | string;
  updated_at: Date | string;
};

export type MoneyCashWithdrawalRow = {
  id: number;
  workspace_id: number;
  from_account_id: number;
  from_pocket_id: number;
  to_cash_account_id: number;
  to_cash_pocket_id: number;
  amount: number | string;
  date: string;
  note: string | null;
  attachment_media_id: string | null;
  created_by_person_id: number;
  created_at: Date | string;
  updated_at: Date | string;
};

export type MoneyContext = {
  workspace: MoneyWorkspaceRow;
  actor: MoneyPersonRow;
};

export type MoneyPersonDto = {
  id: number;
  name: string;
  role: MoneyPersonRole;
  userId: number | null;
  familyRootsPersonId: number | null;
};

export type MoneySetupResponse = {
  isConfigured: boolean;
  mode: MoneyWorkspaceMode | null;
  persons: MoneyPersonDto[];
  coupleLinkedAt: string | null;
  needsOpeningBalances: boolean;
  /** FE: tampilkan "Hapus Data Contoh" hanya jika true. Permanen false setelah wipe. */
  hasSampleData: boolean;
};

export type MoneyWorkspaceResetResponse = MoneySetupResponse & {
  reset: {
    mode: 'wipe' | 'reseed';
    keepSetup: boolean;
    hasSampleData: boolean;
    deleted: Record<string, number>;
  };
};

export type MoneyAccountDto = {
  id: number;
  personId: number;
  name: string;
  type: MoneyAccountType;
  bankName: string | null;
  /**
   * true jika boleh dihapus tanpa cascade (kosong).
   * FE tetap boleh selalu tampilkan Hapus dengan `?cascade=true`.
   */
  canDelete: boolean;
  deleteBlockedReason: string | null;
};

export type MoneyPocketAccountDto = {
  id: number;
  name: string;
  type: MoneyAccountType;
};

export type MoneyPocketDto = {
  id: number;
  accountId: number;
  ownerType: MoneyPocketOwnerType;
  ownerPersonId: number | null;
  category: MoneyPocketCategory;
  name: string;
  goalAmount: number | null;
  goalDate: string | null;
  isSystem: boolean;
  archivedAt: string | null;
  balance: number;
  account: MoneyPocketAccountDto;
  /** false → FE sembunyikan aksi archive (pocket sistem / sudah archived / masih ada saldo) */
  canArchive: boolean;
  /** false → FE sembunyikan aksi hard-delete (pocket sistem) */
  canDelete: boolean;
};

export type MoneyCategoryDto = {
  id: number;
  name: string;
  type: MoneyCategoryType;
  icon: string | null;
  sortOrder: number;
  isSystem: boolean;
  /** false → FE sembunyikan icon hapus (sistem / sudah dipakai transaksi) */
  canDelete: boolean;
  deleteBlockedReason: string | null;
};

export type MoneyTransactionDto = {
  id: number;
  pocketId: number;
  pocketName?: string | null;
  accountName?: string | null;
  categoryId: number | null;
  categoryName?: string | null;
  categoryIcon?: string | null;
  type: MoneyTransactionType;
  amount: number;
  date: string;
  note: string | null;
  attachmentMediaId: string | null;
  createdByPersonId: number;
  personId?: number | null;
  personName?: string | null;
  balanceAfter?: number;
};

export type MoneyActivityKind =
  | 'income'
  | 'expense'
  | 'transfer'
  | 'cash_withdrawal';

export type MoneyActivityItemDto = {
  id: string;
  kind: MoneyActivityKind;
  title: string;
  categoryName: string | null;
  categoryId: number | null;
  personId: number | null;
  personName: string | null;
  /** Kantong asal (atau satu-satunya kantong untuk income/expense). */
  pocketLabel: string;
  pocketId: number | null;
  fromPocketLabel?: string | null;
  toPocketId?: number | null;
  toPocketLabel?: string | null;
  amount: number;
  date: string;
  signed: 'pos' | 'neg' | 'neutral';
  link: string;
};

export type MoneyTransferDto = {
  id: number;
  kind: MoneyTransferKind;
  fromPocketId: number;
  toPocketId: number;
  fromPocketLabel?: string | null;
  toPocketLabel?: string | null;
  amount: number;
  date: string;
  note: string | null;
  createdByPersonId: number;
};

export type MoneyCashWithdrawalDto = {
  id: number;
  fromAccountId: number;
  fromPocketId: number;
  toCashAccountId: number;
  toCashPocketId: number;
  fromPocketLabel?: string | null;
  toPocketLabel?: string | null;
  amount: number;
  date: string;
  note: string | null;
  attachmentMediaId: string | null;
  createdByPersonId: number;
};

export type MoneyBalancingPocketDto = {
  pocketId: number;
  name: string;
  accountName: string;
  ownerPersonId: number | null;
  recordedBalance: number;
};

export type MoneyBalancingCheckItemDto = {
  pocketId: number;
  recordedBalance: number;
  actualBalance: number;
  diff: number;
};

export type MoneyDashboardResponse = {
  period: { yearMonth: string; label: string };
  scope: 'all' | 'person';
  mode: MoneyWorkspaceMode;
  summary: {
    income: number;
    expense: number;
    net: number;
    incomeChangePct: number;
    expenseChangePct: number;
    totalSavings: number;
  };
  persons: Array<{
    id: number;
    name: string;
    role: MoneyPersonRole;
    initial: string;
    totalBalance: number;
    pockets: Array<{
      id: number;
      name: string;
      category: MoneyPocketCategory;
      balance: number;
      accountName: string;
    }>;
  }>;
  jointPockets: Array<{
    id: number;
    name: string;
    balance: number;
    goalAmount: number | null;
    goalDate: string | null;
    progressPct: number | null;
  }>;
  recentActivity: Array<{
    id: string;
    kind: 'income' | 'expense' | 'transfer' | 'cash_withdrawal';
    title: string;
    meta: string;
    amount: number;
    signed: 'pos' | 'neg' | 'neutral';
  }>;
  alerts: MoneyReminderDto[];
  reminders: MoneyReminderDto[];
};

export type MoneyWishlistRow = {
  id: number;
  workspace_id: number;
  person_id: number | null;
  name: string;
  estimated_price: number | string;
  priority: MoneyWishlistPriority;
  linked_pocket_id: number | null;
  image_media_id: string | null;
  purchased_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type MoneyWishlistDto = {
  id: number;
  personId: number | null;
  name: string;
  estimatedPrice: number;
  priority: MoneyWishlistPriority;
  linkedPocketId: number | null;
  imageMediaId: string | null;
  purchasedAt: string | null;
  progressAmount?: number;
  progressPct?: number;
};

export type MoneyDebtRow = {
  id: number;
  workspace_id: number;
  person_id: number;
  counterparty_name: string;
  direction: MoneyDebtDirection;
  amount: number | string;
  date: string;
  due_date: string | null;
  status: MoneyDebtStatus;
  note: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type MoneyDebtPaymentRow = {
  id: number;
  workspace_id: number;
  debt_id: number;
  amount: number | string;
  date: string;
  note: string | null;
  created_by_person_id: number;
  created_at: Date | string;
  updated_at: Date | string;
};

export type MoneyDebtPaymentDto = {
  id: number;
  amount: number;
  date: string;
  note: string | null;
  createdByPersonId: number;
};

export type MoneyDebtDto = {
  id: number;
  personId: number;
  counterpartyName: string;
  direction: MoneyDebtDirection;
  /** Human label for direction: "Utang" | "Piutang" */
  directionLabel: string;
  amount: number;
  date: string;
  dueDate: string | null;
  status: MoneyDebtStatus;
  note: string | null;
  paidTotal?: number;
  remaining?: number;
  /** e.g. "Sisa piutang" | "Sisa utang" */
  remainingLabel?: string;
  payments?: MoneyDebtPaymentDto[];
};

export type MoneyBudgetRow = {
  id: number;
  workspace_id: number;
  category_id: number;
  year_month: string;
  limit_amount: number | string;
  created_at: Date | string;
  updated_at: Date | string;
};

export type MoneyBudgetDto = {
  id: number;
  categoryId: number;
  categoryName: string;
  yearMonth: string;
  limitAmount: number;
  spentAmount: number;
  remaining: number;
  pctUsed: number;
};

export type MoneyAuditLogRow = {
  id: number;
  workspace_id: number;
  actor_person_id: number;
  action: 'create' | 'update' | 'delete';
  entity_type: string;
  entity_id: number;
  before: string | Record<string, unknown> | null;
  after: string | Record<string, unknown> | null;
  created_at: Date | string;
};

export type MoneyAuditLogDto = {
  id: number;
  actorPersonId: number;
  actorName: string;
  action: 'create' | 'update' | 'delete';
  entityType: string;
  entityId: number;
  before: unknown;
  after: unknown;
  createdAt: string;
};

export type MoneyReminderDto = {
  id: string;
  type: MoneyReminderType;
  title: string;
  body: string;
  dueAt: string | null;
  relatedType: string;
  relatedId: number;
  /** Relative FE path for navigation, e.g. `/money/debts/9` */
  link: string;
};

export type MoneyPaginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type MoneyMonthlyReportResponse = {
  period: {
    yearMonth: string;
    label: string;
    from: string;
    to: string;
  };
  previousPeriod: {
    yearMonth: string;
    label: string;
  };
  scope: 'all' | 'person';
  summary: {
    income: number;
    expense: number;
    net: number;
    savingsRatePct: number;
    incomeChangePct: number;
    expenseChangePct: number;
    netChangePct: number;
    txnCount: number;
    expenseTxnCount: number;
    incomeTxnCount: number;
  };
  previousSummary: {
    income: number;
    expense: number;
    net: number;
  };
  daily: Array<{
    date: string;
    income: number;
    expense: number;
    net: number;
    cumulativeNet: number;
  }>;
  byCategory: {
    expense: Array<{
      categoryId: number | null;
      categoryName: string;
      amount: number;
      pct: number;
      count: number;
    }>;
    income: Array<{
      categoryId: number | null;
      categoryName: string;
      amount: number;
      pct: number;
      count: number;
    }>;
  };
  byPocket: Array<{
    pocketId: number;
    pocketName: string;
    accountName: string;
    personId: number | null;
    personName: string | null;
    income: number;
    expense: number;
    net: number;
  }>;
  byPerson: Array<{
    personId: number;
    personName: string;
    income: number;
    expense: number;
    net: number;
  }>;
  moves: {
    transfer: { count: number; amount: number };
    cashWithdrawal: { count: number; amount: number };
  };
  topExpenseDays: Array<{
    date: string;
    expense: number;
    income: number;
  }>;
  debtsOpen: {
    utangRemaining: number;
    piutangRemaining: number;
    dueSoonCount: number;
    openCount: number;
  };
};

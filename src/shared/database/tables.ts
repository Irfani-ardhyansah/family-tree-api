/**
 * Canonical DB table names for the super-app domain prefixes:
 *   core_ → Shared / Auth
 *   fr_   → Family Roots
 *   fc_   → Family Core
 *   mt_   → Money Track
 *   hh_   → Household (future)
 */
export const Tables = {
  // core_
  FAMILIES: 'core_families',
  PERSONS: 'core_persons',
  PERSON_DETAILS: 'core_person_details',
  FAMILY_MEMBERS: 'core_family_members',
  REFRESH_TOKENS: 'core_refresh_tokens',
  PERSON_OPTIONS: 'core_person_options',
  APP_LOGS: 'core_app_logs',
  MEDIA: 'core_media',
  MODULE_STATUSES: 'core_module_statuses',
  ADMIN_AUDIT_LOGS: 'core_admin_audit_logs',
  BROADCASTS: 'core_broadcasts',
  NOTIFICATIONS: 'core_notifications',
  BACKUP_JOBS: 'core_backup_jobs',
  PUSH_SUBSCRIPTIONS: 'core_push_subscriptions',
  SECONDARY_PASSWORDS: 'core_secondary_passwords',

  // fr_ (Family Roots)
  PERSON_LINEAGE: 'fr_person_lineage',
  PERSON_SPOUSES: 'fr_person_spouses',
  PERSON_ADDRESSES: 'fr_person_addresses',
  EVENTS: 'fr_events',
  EVENT_PERSONS: 'fr_event_persons',
  EVENT_ATTENDEES: 'fr_event_attendees',
  EVENT_CONTRIBUTIONS: 'fr_event_contributions',
  EVENT_PHOTOS: 'fr_event_photos',
  MEMORIAM_TRIBUTES: 'fr_memoriam_tributes',
  MEMORIAM_TRIBUTE_PHOTOS: 'fr_memoriam_tribute_photos',
  MEMORIAM_PRAYERS: 'fr_memoriam_prayers',
  PERSON_IMPORT_JOBS: 'fr_person_import_jobs',

  // fc_ (Family Core)
  FC_DOCUMENT_TYPES: 'fc_document_types',
  FC_CALENDAR_EVENT_TYPES: 'fc_calendar_event_types',
  FC_DOCUMENTS: 'fc_documents',
  FC_DOCUMENT_FILES: 'fc_document_files',

  // mt_ (Money Track)
  MONEY_WORKSPACES: 'mt_workspaces',
  MONEY_PERSONS: 'mt_persons',
  MONEY_COUPLE_LINKS: 'mt_couple_links',
  MONEY_ACCOUNTS: 'mt_accounts',
  MONEY_POCKETS: 'mt_pockets',
  MONEY_CATEGORIES: 'mt_categories',
  MONEY_TRANSACTIONS: 'mt_transactions',
  MONEY_TRANSFERS: 'mt_transfers',
  MONEY_CASH_WITHDRAWALS: 'mt_cash_withdrawals',
  MONEY_WISHLIST_ITEMS: 'mt_wishlist_items',
  MONEY_DEBTS: 'mt_debts',
  MONEY_DEBT_PAYMENTS: 'mt_debt_payments',
  MONEY_BUDGETS: 'mt_budgets',
  MONEY_AUDIT_LOGS: 'mt_audit_logs',
} as const;

export type TableName = (typeof Tables)[keyof typeof Tables];

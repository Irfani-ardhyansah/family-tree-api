/**
 * Canonical DB table names for the super-app domain prefixes:
 *   core_ → Shared / Auth
 *   fr_   → Family Roots
 *   fc_   → Family Core (future)
 *   mt_   → Money Track (future)
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
} as const;

export type TableName = (typeof Tables)[keyof typeof Tables];

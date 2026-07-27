export const ADMIN_MODULE_IDS = ['roots', 'core', 'money', 'household'] as const;
export type AdminModuleId = (typeof ADMIN_MODULE_IDS)[number];

export const ADMIN_AUDIT_MODULE_IDS = [
  ...ADMIN_MODULE_IDS,
  'admin',
  'auth',
] as const;
export type AdminAuditModuleId = (typeof ADMIN_AUDIT_MODULE_IDS)[number];

export const ADMIN_AUDIT_ACTIONS = [
  'create',
  'update',
  'delete',
  'login',
  'logout',
  'toggle_module',
  'force_logout',
  'broadcast',
  'backup',
  'settings',
] as const;
export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number];

export const MODULE_LABELS: Record<AdminModuleId, string> = {
  roots: 'Family Roots',
  core: 'Family Core',
  money: 'Money Track',
  household: 'Household',
};

export function isAdminModuleId(value: string): value is AdminModuleId {
  return (ADMIN_MODULE_IDS as readonly string[]).includes(value);
}

export function isAdminAuditAction(value: string): value is AdminAuditAction {
  return (ADMIN_AUDIT_ACTIONS as readonly string[]).includes(value);
}

export function isAdminAuditModuleId(value: string): value is AdminAuditModuleId {
  return (ADMIN_AUDIT_MODULE_IDS as readonly string[]).includes(value);
}

/** Modul yang wajib double-password (setup + unlock). */
export const SENSITIVE_MODULES = ['admin', 'money', 'household'] as const;
export type SensitiveModule = (typeof SENSITIVE_MODULES)[number];

export function isSensitiveModule(value: string): value is SensitiveModule {
  return (SENSITIVE_MODULES as readonly string[]).includes(value);
}

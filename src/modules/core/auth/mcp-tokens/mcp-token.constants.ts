/** Prefix token MCP. Dibedakan dari JWT akses aplikasi (yang diawali `eyJ`). */
export const MCP_TOKEN_PREFIX = 'frmcp_';

/** Maksimal token aktif per person. */
export const MCP_TOKEN_MAX_ACTIVE = 5;

/** Panjang maksimal label token. */
export const MCP_TOKEN_LABEL_MAX = 60;

/** Label default kalau user tidak mengisi. */
export const MCP_TOKEN_DEFAULT_LABEL = 'MCP';

/**
 * Modul yang otomatis diberikan ke semua token MCP.
 * Money Track otomatis; tidak butuh checkbox atau password kedua.
 */
export const MCP_DEFAULT_MODULES = ['money'] as const;
export type McpDefaultModule = (typeof MCP_DEFAULT_MODULES)[number];

/**
 * Modul opsional yang boleh di-"trust" ke token MCP.
 * `admin` sengaja tidak boleh: token MCP tidak untuk mengelola admin/token lain.
 */
export const MCP_OPTIONAL_MODULES = ['core', 'household'] as const;
export type McpOptionalModule = (typeof MCP_OPTIONAL_MODULES)[number];

/** Semua modul yang dikenal token MCP (default + opsional). */
export const MCP_UNLOCK_MODULES = [
  ...MCP_DEFAULT_MODULES,
  ...MCP_OPTIONAL_MODULES,
] as const;
export type McpUnlockModule = (typeof MCP_UNLOCK_MODULES)[number];

export function isMcpDefaultModule(value: string): value is McpDefaultModule {
  return (MCP_DEFAULT_MODULES as readonly string[]).includes(value);
}

export function isMcpOptionalModule(value: string): value is McpOptionalModule {
  return (MCP_OPTIONAL_MODULES as readonly string[]).includes(value);
}

export function isMcpUnlockModule(value: string): value is McpUnlockModule {
  return (MCP_UNLOCK_MODULES as readonly string[]).includes(value);
}

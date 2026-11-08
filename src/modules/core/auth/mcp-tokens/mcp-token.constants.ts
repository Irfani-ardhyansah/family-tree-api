/** Prefix token MCP. Dibedakan dari JWT akses aplikasi (yang diawali `eyJ`). */
export const MCP_TOKEN_PREFIX = 'frmcp_';

/** Maksimal token aktif per person. */
export const MCP_TOKEN_MAX_ACTIVE = 5;

/** Panjang maksimal label token. */
export const MCP_TOKEN_LABEL_MAX = 60;

/** Label default kalau user tidak mengisi. */
export const MCP_TOKEN_DEFAULT_LABEL = 'MCP';

/**
 * Modul sensitif yang boleh di-"trust" ke token MCP.
 * `admin` sengaja tidak boleh: token MCP tidak untuk mengelola admin/token lain.
 */
export const MCP_UNLOCK_MODULES = ['money', 'core', 'household'] as const;
export type McpUnlockModule = (typeof MCP_UNLOCK_MODULES)[number];

export function isMcpUnlockModule(value: string): value is McpUnlockModule {
  return (MCP_UNLOCK_MODULES as readonly string[]).includes(value);
}

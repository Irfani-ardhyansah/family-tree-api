declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      auth?: {
        personId: number;
        familyId: number;
        /** `session` = JWT aplikasi; `mcp` = token MCP. */
        authType?: 'session' | 'mcp';
        /** Diisi kalau authType = mcp. */
        mcpTokenId?: number;
        /** Modul yang sudah "trusted" lewat token MCP. */
        mcpUnlockModules?: Array<'admin' | 'core' | 'money' | 'household'>;
        /** Set by requireAdmin when role === admin */
        isAdmin?: boolean;
        role?: 'admin' | 'member';
        /** Sensitive modules unlocked via X-Module-Unlock */
        moduleUnlock?: Array<'admin' | 'core' | 'money' | 'household'>;
      };
      /** Set by resolveReadFocusMiddleware on GET /persons */
      readFocus?: {
        focusPersonId: number;
        allowedFocusPersonIds: number[];
      };
      analyticsForceBot?: boolean;
    }
  }
}

export {};

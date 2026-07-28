declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      auth?: {
        personId: number;
        familyId: number;
        /** Set by requireAdmin when role === admin */
        isAdmin?: boolean;
        role?: 'admin' | 'member';
        /** Sensitive modules unlocked via X-Module-Unlock */
        moduleUnlock?: Array<'admin' | 'money' | 'household'>;
      };
      /** Set by resolveReadFocusMiddleware on GET /persons */
      readFocus?: {
        focusPersonId: number;
        allowedFocusPersonIds: number[];
      };
    }
  }
}

export {};

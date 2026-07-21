declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      auth?: {
        personId: number;
        familyId: number;
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

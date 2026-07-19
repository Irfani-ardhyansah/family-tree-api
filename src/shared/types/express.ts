declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      auth?: {
        personId: number;
        familyId: number;
      };
    }
  }
}

export {};

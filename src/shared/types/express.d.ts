export {};

declare global {
  namespace Express {
    interface Request {
      auth?: {
        personId: number;
        familyId: number;
      };
    }
  }
}

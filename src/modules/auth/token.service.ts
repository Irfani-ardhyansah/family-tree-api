import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

export type AccessTokenPayload = {
  personId: number;
  familyId: number;
};

export class TokenService {
  hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  generateRefreshToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  signAccessToken(personId: number, familyId: number): { accessToken: string; expiresIn: number } {
    const expiresIn = env.accessTtlSeconds;
    const accessToken = jwt.sign({ familyId }, env.jwtSecret, {
      subject: String(personId),
      expiresIn,
    });

    return { accessToken, expiresIn };
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload & { familyId?: number };

    const personId = Number(payload.sub);
    const familyId = Number(payload.familyId);

    if (!personId || !familyId) {
      throw new Error('Invalid token payload');
    }

    return { personId, familyId };
  }

  getRefreshExpiry(remember: boolean): Date {
    const ttlSeconds = remember ? env.refreshTtlRememberSeconds : env.refreshTtlSessionSeconds;
    return new Date(Date.now() + ttlSeconds * 1000);
  }
}

export const tokenService = new TokenService();

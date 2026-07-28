import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../../config/env';
import { SENSITIVE_MODULES, SensitiveModule } from './secondary-password.constants';

export type AccessTokenPayload = {
  personId: number;
  familyId: number;
};

export type ModuleUnlockPayload = {
  personId: number;
  familyId: number;
  modules: SensitiveModule[];
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

  signModuleUnlock(
    personId: number,
    familyId: number,
    modules: SensitiveModule[] = [...SENSITIVE_MODULES],
  ): { unlockToken: string; expiresIn: number } {
    const expiresIn = env.secondaryUnlockTtlSeconds;
    const unlockToken = jwt.sign(
      {
        typ: 'module_unlock',
        familyId,
        modules,
      },
      env.jwtSecret,
      {
        subject: String(personId),
        expiresIn,
      },
    );
    return { unlockToken, expiresIn };
  }

  verifyModuleUnlock(token: string): ModuleUnlockPayload {
    const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload & {
      typ?: string;
      familyId?: number;
      modules?: string[];
    };

    if (payload.typ !== 'module_unlock') {
      throw new Error('Invalid unlock token type');
    }

    const personId = Number(payload.sub);
    const familyId = Number(payload.familyId);
    const modules = Array.isArray(payload.modules)
      ? payload.modules.filter((m): m is SensitiveModule =>
          (SENSITIVE_MODULES as readonly string[]).includes(m),
        )
      : [];

    if (!personId || !familyId || modules.length === 0) {
      throw new Error('Invalid unlock token payload');
    }

    return { personId, familyId, modules };
  }

  getRefreshExpiry(remember: boolean): Date {
    const ttlSeconds = remember ? env.refreshTtlRememberSeconds : env.refreshTtlSessionSeconds;
    return new Date(Date.now() + ttlSeconds * 1000);
  }
}

export const tokenService = new TokenService();

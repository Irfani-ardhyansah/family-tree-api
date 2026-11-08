import { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import { ErrorCodes } from '../errors/errorCodes';
import { tokenService } from '../../modules/core/auth/token.service';
import { mcpTokenService } from '../../modules/core/auth/mcp-tokens/mcp-token.service';
import { MCP_TOKEN_PREFIX } from '../../modules/core/auth/mcp-tokens/mcp-token.constants';

type AuthContext = NonNullable<Request['auth']>;

async function authenticateBearer(req: Request): Promise<AuthContext> {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Autentikasi diperlukan.');
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Autentikasi diperlukan.');
  }

  if (token.startsWith(MCP_TOKEN_PREFIX)) {
    const context = await mcpTokenService.verifyToken(token);
    return {
      personId: context.personId,
      familyId: context.familyId,
      authType: 'mcp',
      mcpTokenId: context.tokenId,
      mcpUnlockModules: context.unlockModules,
    };
  }

  try {
    const payload = tokenService.verifyAccessToken(token);
    return {
      personId: payload.personId,
      familyId: payload.familyId,
      authType: 'session',
    };
  } catch {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Token tidak valid atau kedaluwarsa.');
  }
}

/** Require valid Bearer JWT OR MCP token; sets req.auth. */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    req.auth = await authenticateBearer(req);
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Require session JWT aplikasi. Token MCP tidak boleh mengelola token lain,
 * mengubah kredensial/keamanan akun, atau mengakses endpoint admin.
 */
export async function requireSessionAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const auth = await authenticateBearer(req);
    if (auth.authType !== 'session') {
      throw new AppError(
        403,
        ErrorCodes.FORBIDDEN,
        'Token MCP tidak boleh mengakses endpoint ini. Gunakan sesi aplikasi.',
      );
    }
    req.auth = auth;
    next();
  } catch (error) {
    next(error);
  }
}

export { optionalAuth } from './optionalAuth.middleware';

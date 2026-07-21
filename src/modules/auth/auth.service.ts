import { Request } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';
import { LogCategory, LogStatus } from '../logs/logs.types';
import { logsService } from '../logs/logs.service';
import { buildLoginCode, isValidFormat, normalize } from './login-code.service';
import { authRepository } from './auth.repository';
import { toAuthMeResponse, toAuthPersonSummary, formatBirthDate } from './auth.mapper';
import { AuthMeResponse, LoginResponse, PersonAuthRow, RefreshResponse } from './auth.types';
import { tokenService } from './token.service';

const CODE_NOT_FOUND_MESSAGE =
  'Kode tidak ditemukan. Periksa singkatan nama dan tanggal lahir Anda.';
const CODE_INVALID_FORMAT_MESSAGE =
  'Format kode salah. Contoh: MR170845 atau MIA210399 …';

export class AuthService {
  private async issueTokenPair(
    person: PersonAuthRow,
    remember: boolean,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const refreshToken = tokenService.generateRefreshToken();
    const tokenHash = tokenService.hashRefreshToken(refreshToken);
    const expiresAt = tokenService.getRefreshExpiry(remember);

    await authRepository.insertRefreshToken({
      personId: person.id,
      tokenHash,
      expiresAt,
    });

    const { accessToken, expiresIn } = tokenService.signAccessToken(person.id, person.family_id);
    return { accessToken, refreshToken, expiresIn };
  }

  async login(req: Request, rawCode: unknown, remember = false): Promise<LoginResponse> {
    if (typeof rawCode !== 'string' || rawCode.trim().length === 0) {
      throw new AppError(400, ErrorCodes.CODE_REQUIRED, 'Kode masuk wajib diisi.');
    }

    const normalized = normalize(rawCode);
    if (!isValidFormat(normalized)) {
      throw new AppError(400, ErrorCodes.CODE_INVALID_FORMAT, CODE_INVALID_FORMAT_MESSAGE);
    }

    const persons = await authRepository.findAlivePersons();
    const person = persons.find(
      (row) =>
        buildLoginCode({
          fullName: row.full_name,
          nickname: row.nickname,
          birthDate: formatBirthDate(row.birth_date),
        }) === normalized,
    );

    if (!person) {
      await logsService.recordFromRequest(req, {
        category: LogCategory.AUTH,
        action: 'auth.login',
        status: LogStatus.FAILURE,
        resourceType: 'auth',
        httpMethod: 'POST',
        path: '/api/v1/auth/login',
        message: 'Login gagal — kode tidak ditemukan',
        metadata: { codeLength: normalized.length },
      });
      throw new AppError(401, ErrorCodes.CODE_NOT_FOUND, CODE_NOT_FOUND_MESSAGE);
    }

    const tokens = await this.issueTokenPair(person, remember);
    const spouseIds = await authRepository.findSpouseIdsByPersonId(person.id);

    await logsService.recordFromRequest(req, {
      category: LogCategory.AUTH,
      action: 'auth.login',
      status: LogStatus.SUCCESS,
      actorPersonId: person.id,
      familyId: person.family_id,
      resourceType: 'person',
      resourceId: person.id,
      httpMethod: 'POST',
      path: '/api/v1/auth/login',
      message: 'Login berhasil',
      metadata: { remember },
    });

    return {
      ...tokens,
      person: toAuthPersonSummary(person, spouseIds),
    };
  }

  async me(personId: number): Promise<AuthMeResponse> {
    const person = await authRepository.findPersonById(personId);
    if (!person || person.status !== 'alive') {
      throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Autentikasi diperlukan.');
    }

    const spouseIds = await authRepository.findSpouseIdsByPersonId(personId);
    return toAuthMeResponse(person, spouseIds);
  }

  async refresh(refreshToken: unknown): Promise<RefreshResponse> {
    if (typeof refreshToken !== 'string' || refreshToken.trim().length === 0) {
      throw new AppError(400, ErrorCodes.REFRESH_TOKEN_REQUIRED, 'Refresh token wajib diisi.');
    }

    const tokenHash = tokenService.hashRefreshToken(refreshToken.trim());
    const stored = await authRepository.findActiveRefreshToken(tokenHash);

    if (!stored) {
      throw new AppError(401, ErrorCodes.REFRESH_TOKEN_INVALID, 'Refresh token tidak valid atau kedaluwarsa.');
    }

    const person = await authRepository.findPersonById(stored.person_id);
    if (!person || person.status !== 'alive') {
      await authRepository.revokeRefreshToken(tokenHash);
      throw new AppError(401, ErrorCodes.REFRESH_TOKEN_INVALID, 'Refresh token tidak valid atau kedaluwarsa.');
    }

    await authRepository.revokeRefreshToken(tokenHash);

    const remember = false;
    const tokens = await this.issueTokenPair(person, remember);

    return tokens;
  }

  async logout(req: Request, refreshToken: unknown): Promise<void> {
    if (typeof refreshToken === 'string' && refreshToken.trim().length > 0) {
      await authRepository.revokeRefreshToken(tokenService.hashRefreshToken(refreshToken.trim()));
    }

    await logsService.recordFromRequest(req, {
      category: LogCategory.AUTH,
      action: 'auth.logout',
      status: LogStatus.SUCCESS,
      resourceType: 'auth',
      httpMethod: 'POST',
      path: '/api/v1/auth/logout',
      message: 'Logout berhasil',
    });
  }
}

export const authService = new AuthService();

import { Request } from 'express';
import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { LogCategory, LogStatus } from '../logs/logs.types';
import { logsService } from '../logs/logs.service';
import { adminAuditService } from '../admin/admin-audit.service';
import { moduleStatusService } from '../admin/module-status.service';
import { parseUserAgent } from '../admin/parse-user-agent';
import { buildLoginCode, isValidFormat, normalize } from './login-code.service';
import { authRepository } from './auth.repository';
import { toAuthMeResponse, toAuthPersonSummary, formatBirthDate } from './auth.mapper';
import { AuthMeResponse, LoginResponse, PersonAuthRow, RefreshResponse } from './auth.types';
import { tokenService } from './token.service';
import { personOptionsService } from '../person-options/person-options.service';
import { PersonOptionsResponse } from '../person-options/person-options.types';
import { buildReadFocusMeta } from '../../family-roots/persons/read-focus.service';
import { secondaryPasswordService } from './secondary-password.service';

const CODE_NOT_FOUND_MESSAGE =
  'Kode tidak ditemukan. Periksa singkatan nama dan tanggal lahir Anda.';
const CODE_INVALID_FORMAT_MESSAGE =
  'Format kode salah. Contoh: MR170845 atau MIA210399 …';

function getClientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() ?? null;
  }
  return req.ip ?? null;
}

export class AuthService {
  private async issueTokenPair(
    person: PersonAuthRow,
    remember: boolean,
    req?: Request,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    sessionId: number;
  }> {
    const refreshToken = tokenService.generateRefreshToken();
    const tokenHash = tokenService.hashRefreshToken(refreshToken);
    const expiresAt = tokenService.getRefreshExpiry(remember);
    const ua = parseUserAgent(req?.headers['user-agent']);

    const sessionId = await authRepository.insertRefreshToken({
      personId: person.id,
      familyId: person.family_id,
      tokenHash,
      expiresAt,
      device: ua.device,
      browser: ua.browser,
      ipAddress: req ? getClientIp(req) : null,
    });

    const { accessToken, expiresIn } = tokenService.signAccessToken(person.id, person.family_id);
    return { accessToken, refreshToken, expiresIn, sessionId };
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

    const tokens = await this.issueTokenPair(person, remember, req);
    const spouseIds = await authRepository.findSpouseIdsByPersonId(person.id);
    const spouseRows = await authRepository.findPersonsByIds(spouseIds);
    await personOptionsService.ensureDefaultReadFocusPersonId(person.id);

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
      metadata: { remember, sessionId: tokens.sessionId },
    });

    await adminAuditService.record({
      familyId: person.family_id,
      actorPersonId: person.id,
      moduleId: 'auth',
      action: 'login',
      summary: 'Login berhasil',
      after: { sessionId: tokens.sessionId, remember },
    });

    const secondaryPassword = await secondaryPasswordService.getStatus(person.id);

    return {
      ...tokens,
      person: toAuthPersonSummary(person, spouseIds, spouseRows),
      secondaryPassword,
    };
  }

  async me(personId: number): Promise<AuthMeResponse> {
    const person = await authRepository.findPersonById(personId);
    if (!person || person.status !== 'alive') {
      throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Autentikasi diperlukan.');
    }

    const spouseIds = await authRepository.findSpouseIdsByPersonId(personId);
    const spouseRows = await authRepository.findPersonsByIds(spouseIds);
    await personOptionsService.ensureDefaultReadFocusPersonId(personId);
    const storedFocus = await personOptionsService.resolveStoredReadFocusPersonId(
      personId,
      spouseIds,
    );
    const readFocus = buildReadFocusMeta(personId, spouseIds, storedFocus);

    const [accessVersion, moduleList, secondaryPassword] = await Promise.all([
      moduleStatusService.getAccessVersion(person.family_id),
      moduleStatusService.list(person.family_id),
      secondaryPasswordService.getStatus(personId),
    ]);

    return {
      ...toAuthMeResponse(person, spouseIds, spouseRows),
      readFocusPersonId: readFocus.focusPersonId,
      allowedFocusPersonIds: readFocus.allowedFocusPersonIds,
      accessVersion,
      moduleStatuses: moduleList.items.map((item) => ({
        moduleId: item.moduleId,
        enabled: item.enabled,
      })),
      secondaryPassword,
    };
  }

  async getOptions(personId: number): Promise<PersonOptionsResponse> {
    await this.me(personId);
    return personOptionsService.getOptions(personId);
  }

  async upsertOption(
    personId: number,
    input: unknown,
  ): Promise<PersonOptionsResponse> {
    const spouseIds = await authRepository.findSpouseIdsByPersonId(personId);
    return personOptionsService.upsertOption(personId, spouseIds, input);
  }

  async refresh(req: Request, refreshToken: unknown): Promise<RefreshResponse> {
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
    return this.issueTokenPair(person, remember, req);
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

    if (req.auth) {
      await adminAuditService.record({
        familyId: req.auth.familyId,
        actorPersonId: req.auth.personId,
        moduleId: 'auth',
        action: 'logout',
        summary: 'Logout berhasil',
      });
    }
  }
}

export const authService = new AuthService();

import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';
import { getAllowedReadFocusPersonIds } from '../persons/read-focus.service';
import { personOptionsRepository } from './person-options.repository';
import {
  PersonOptionSetting,
  PersonOptionsMap,
  PersonOptionsResponse,
  UpsertPersonOptionInput,
} from './person-options.types';

const MAX_SETTING_LENGTH = 64;
const MAX_VALUE_LENGTH = 512;

function validateSettingKey(setting: string): void {
  if (setting.length === 0 || setting.length > MAX_SETTING_LENGTH) {
    throw new AppError(
      400,
      ErrorCodes.PERSON_OPTION_VALIDATION_FAILED,
      'Nama setting tidak valid.',
    );
  }

  if (!/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(setting)) {
    throw new AppError(
      400,
      ErrorCodes.PERSON_OPTION_VALIDATION_FAILED,
      'Nama setting harus diawali huruf dan hanya berisi huruf, angka, titik, strip, underscore.',
    );
  }
}

function validateValueLength(value: string): void {
  if (value.length === 0 || value.length > MAX_VALUE_LENGTH) {
    throw new AppError(
      400,
      ErrorCodes.PERSON_OPTION_VALIDATION_FAILED,
      `Nilai setting harus 1–${MAX_VALUE_LENGTH} karakter.`,
    );
  }
}

function parseUpsertInput(input: unknown): UpsertPersonOptionInput {
  if (!input || typeof input !== 'object') {
    throw new AppError(400, ErrorCodes.PERSON_OPTION_VALIDATION_FAILED, 'Data option tidak valid.');
  }

  const body = input as Record<string, unknown>;
  if (typeof body.setting !== 'string' || typeof body.value !== 'string') {
    throw new AppError(
      400,
      ErrorCodes.PERSON_OPTION_VALIDATION_FAILED,
      'Field setting dan value wajib string.',
    );
  }

  validateSettingKey(body.setting.trim());
  validateValueLength(body.value.trim());

  return {
    setting: body.setting.trim(),
    value: body.value.trim(),
  };
}

export class PersonOptionsService {
  private validateReadFocusPersonIdValue(
    viewerId: number,
    spouseIds: number[],
    value: string,
  ): number {
    if (!/^\d+$/.test(value)) {
      throw new AppError(
        400,
        ErrorCodes.PERSON_OPTION_VALIDATION_FAILED,
        'readFocusPersonId harus angka positif.',
      );
    }

    const focusPersonId = Number(value);
    const allowed = getAllowedReadFocusPersonIds(viewerId, spouseIds);
    if (!allowed.includes(focusPersonId)) {
      throw new AppError(
        403,
        ErrorCodes.PERSON_READ_FOCUS_FORBIDDEN,
        'readFocusPersonId hanya boleh diri sendiri atau pasangan yang terdaftar.',
      );
    }

    return focusPersonId;
  }

  async getOptionsMap(personId: number): Promise<PersonOptionsMap> {
    const rows = await personOptionsRepository.findByPersonId(personId);
    return personOptionsRepository.rowsToMap(rows);
  }

  async getOptions(personId: number): Promise<PersonOptionsResponse> {
    return {
      options: await this.getOptionsMap(personId),
    };
  }

  /**
   * Resolve fokus baca dari person_options.
   * Returns undefined jika belum pernah diset (caller default ke viewerId).
   */
  async resolveStoredReadFocusPersonId(
    viewerId: number,
    spouseIds: number[],
  ): Promise<number | undefined> {
    const row = await personOptionsRepository.findByPersonAndSetting(
      viewerId,
      PersonOptionSetting.READ_FOCUS_PERSON_ID,
    );
    if (!row) {
      return undefined;
    }

    try {
      return this.validateReadFocusPersonIdValue(viewerId, spouseIds, row.value);
    } catch (error) {
      if (error instanceof AppError && error.code === ErrorCodes.PERSON_READ_FOCUS_FORBIDDEN) {
        await personOptionsRepository.deleteByPersonAndSetting(
          viewerId,
          PersonOptionSetting.READ_FOCUS_PERSON_ID,
        );
        return undefined;
      }
      throw error;
    }
  }

  async upsertOption(
    viewerId: number,
    spouseIds: number[],
    input: unknown,
  ): Promise<PersonOptionsResponse> {
    const data = parseUpsertInput(input);

    if (data.setting === PersonOptionSetting.READ_FOCUS_PERSON_ID) {
      this.validateReadFocusPersonIdValue(viewerId, spouseIds, data.value);
    }

    await personOptionsRepository.upsert(viewerId, data.setting, data.value);
    return this.getOptions(viewerId);
  }
}

export const personOptionsService = new PersonOptionsService();

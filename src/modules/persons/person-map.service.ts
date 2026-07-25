import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';
import { PersonAddress, PersonMapQuery, TreeLineage } from './persons.types';

const LINEAGE_VALUES: TreeLineage[] = ['both', 'paternal', 'maternal'];

function singleQueryValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function parseLineage(raw: unknown): TreeLineage | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }

  const value = String(singleQueryValue(raw)).trim().toLowerCase();
  if (LINEAGE_VALUES.includes(value as TreeLineage)) {
    return value as TreeLineage;
  }

  throw new AppError(
    400,
    ErrorCodes.TREE_FILTER_INVALID,
    'Parameter lineage harus both, paternal, atau maternal.',
  );
}

function parseStatus(raw: unknown): 'alive' | 'deceased' | 'all' {
  if (raw === undefined || raw === null || raw === '') {
    return 'all';
  }

  const value = String(singleQueryValue(raw)).trim().toLowerCase();
  if (value === 'alive' || value === 'deceased' || value === 'all') {
    return value;
  }

  throw new AppError(
    400,
    ErrorCodes.PERSON_VALIDATION_FAILED,
    'Parameter status harus alive, deceased, atau all.',
  );
}

function parseOptionalString(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  const value = String(singleQueryValue(raw)).trim();
  return value.length > 0 ? value : undefined;
}

export function parseMapQuery(raw: Record<string, unknown>): PersonMapQuery {
  return {
    lineage: parseLineage(raw.lineage),
    status: parseStatus(raw.status),
    city: parseOptionalString(raw.city),
    province: parseOptionalString(raw.province),
    q: parseOptionalString(raw.q),
  };
}

export function hasExactCoords(address: PersonAddress | null): boolean {
  return address?.latitude != null && address?.longitude != null;
}

export function hasCityLevel(address: PersonAddress | null): boolean {
  if (!address) {
    return false;
  }
  return Boolean(address.city || address.province);
}

export function hasAnyAddress(address: PersonAddress | null): boolean {
  if (!address) {
    return false;
  }
  return Boolean(
    address.street ||
      address.district ||
      address.city ||
      address.province ||
      address.postalCode ||
      address.country,
  );
}

export function matchesMapFilters(
  person: {
    fullName: string;
    nickname: string | null;
    status: 'alive' | 'deceased';
    address: PersonAddress | null;
  },
  query: PersonMapQuery,
): boolean {
  if (query.status && query.status !== 'all' && person.status !== query.status) {
    return false;
  }

  if (query.city) {
    const city = person.address?.city?.toLowerCase() ?? '';
    if (!city.includes(query.city.toLowerCase())) {
      return false;
    }
  }

  if (query.province) {
    const province = person.address?.province?.toLowerCase() ?? '';
    if (!province.includes(query.province.toLowerCase())) {
      return false;
    }
  }

  if (query.q) {
    const needle = query.q.toLowerCase();
    const haystack = [
      person.fullName,
      person.nickname ?? '',
      person.address?.street ?? '',
      person.address?.district ?? '',
      person.address?.city ?? '',
      person.address?.province ?? '',
    ]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(needle)) {
      return false;
    }
  }

  return true;
}

export function validatePatchAddressInput(input: unknown): PersonAddress {
  if (!input || typeof input !== 'object') {
    throw new AppError(400, ErrorCodes.PERSON_VALIDATION_FAILED, 'Data alamat tidak valid.');
  }

  const body = input as Record<string, unknown>;
  if (!body.address || typeof body.address !== 'object') {
    throw new AppError(400, ErrorCodes.PERSON_VALIDATION_FAILED, 'Field address wajib diisi.');
  }

  const address = body.address as Record<string, unknown>;
  const result: PersonAddress = {
    street: typeof address.street === 'string' ? address.street : null,
    district: typeof address.district === 'string' ? address.district : null,
    city: typeof address.city === 'string' ? address.city : null,
    province: typeof address.province === 'string' ? address.province : null,
    postalCode: typeof address.postalCode === 'string' ? address.postalCode : null,
    country: typeof address.country === 'string' ? address.country : null,
    latitude:
      typeof address.latitude === 'number' && Number.isFinite(address.latitude)
        ? address.latitude
        : null,
    longitude:
      typeof address.longitude === 'number' && Number.isFinite(address.longitude)
        ? address.longitude
        : null,
  };

  if (!hasAnyAddress(result)) {
    throw new AppError(
      400,
      ErrorCodes.PERSON_VALIDATION_FAILED,
      'Minimal satu field alamat harus diisi.',
    );
  }

  return result;
}

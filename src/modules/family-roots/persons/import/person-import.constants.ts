export const PERSON_IMPORT_MAX_ROWS = 200;
export const PERSON_IMPORT_MAX_FILE_BYTES = 2 * 1024 * 1024;

export const PERSON_IMPORT_CSV_HEADERS = [
  'tempId',
  'fullName',
  'nickname',
  'gender',
  'birthDate',
  'deathDate',
  'status',
  'religion',
  'occupation',
  'phone',
  'phoneAlt',
  'street',
  'district',
  'city',
  'province',
  'postalCode',
  'country',
  'fatherTempId',
  'motherTempId',
  'spouseTempIds',
  'role',
] as const;

export const PERSON_IMPORT_TEMPLATE_CSV = `${PERSON_IMPORT_CSV_HEADERS.join(',')}\n`;

export const TEMP_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

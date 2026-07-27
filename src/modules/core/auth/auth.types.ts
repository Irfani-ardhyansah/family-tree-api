/** Ringkas untuk switcher fokus navbar (self + pasangan yang diizinkan). */
export type AllowedFocusPerson = {
  id: number;
  fullName: string;
  nickname: string | null;
  gender: 'male' | 'female';
  photoUrl: string | null;
  relation: 'self' | 'spouse';
};

export type AuthPersonSummary = {
  id: number;
  fullName: string;
  nickname: string | null;
  gender: 'male' | 'female';
  birthDate: string;
  status: 'alive' | 'deceased';
  photoUrl: string | null;
  /** Level keanggotaan family — dari `family_members.role`. */
  role: 'admin' | 'member';
  /** Shortcut FE: `role === 'admin'`. */
  isAdmin: boolean;
  isMarried: boolean;
  isLegal: boolean;
  spouseIds: number[];
  /** Sinkron dengan allowedFocusPersonIds — self dulu, lalu pasangan. */
  allowedFocusPersons: AllowedFocusPerson[];
};

export type AuthMeBase = AuthPersonSummary & {
  familyId: number;
};

export type AuthModuleStatus = {
  moduleId: string;
  enabled: boolean;
};

export type AuthMeResponse = AuthMeBase & {
  /** Fokus baca aktif — dari person_options atau default diri sendiri */
  readFocusPersonId: number;
  allowedFocusPersonIds: number[];
  /** Naik saat admin toggle modul — FE re-fetch permission bila berubah. */
  accessVersion: number;
  moduleStatuses: AuthModuleStatus[];
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  /** Id baris `core_refresh_tokens` — simpan di FE untuk `X-Session-Id`. */
  sessionId: number;
  person: AuthPersonSummary;
};

export type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  sessionId: number;
};

export type PersonAuthRow = {
  id: number;
  family_id: number;
  full_name: string;
  nickname: string | null;
  gender: 'male' | 'female';
  birth_date: Date | string;
  status: 'alive' | 'deceased';
  photo_url: string | null;
  /** Dari join `family_members.role`; default member jika belum ada row. */
  role: 'admin' | 'member';
};

export type RefreshTokenRow = {
  id: number;
  person_id: number;
  family_id: number | null;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  device: string | null;
  browser: string | null;
  ip_address: string | null;
  last_active_at: Date | null;
};

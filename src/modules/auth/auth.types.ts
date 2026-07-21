export type AuthPersonSummary = {
  id: number;
  fullName: string;
  nickname: string | null;
  gender: 'male' | 'female';
  birthDate: string;
  status: 'alive' | 'deceased';
  photoUrl: string | null;
  isMarried: boolean;
  isLegal: boolean;
  spouseIds: number[];
};

export type AuthMeResponse = AuthPersonSummary & {
  familyId: number;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  person: AuthPersonSummary;
};

export type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
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
};

export type RefreshTokenRow = {
  id: number;
  person_id: number;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
};

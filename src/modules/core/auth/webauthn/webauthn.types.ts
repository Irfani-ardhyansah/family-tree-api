export type WebauthnCredentialItem = {
  id: number;
  label: string;
  enabled: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};

export type WebauthnAdminCredentialItem = WebauthnCredentialItem & {
  personId: number;
  personName: string;
};

export type CredentialRow = {
  id: number | string;
  family_id: number;
  person_id: number;
  label: string;
  enabled: boolean | number;
  credential_id: string;
  public_key: Buffer;
  counter: number | string;
  transports: unknown;
  last_used_at: Date | string | null;
  created_at: Date | string;
  person_name?: string | null;
};

export type ChallengeKind = 'login' | 'register' | 'unlock';

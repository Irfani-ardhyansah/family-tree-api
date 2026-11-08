import { McpUnlockModule } from './mcp-token.constants';

export type McpTokenRow = {
  id: number | string;
  family_id: number;
  person_id: number;
  label: string;
  token_hash: string;
  token_hint: string;
  unlock_modules: unknown;
  last_used_at: Date | string | null;
  expires_at: Date | string | null;
  revoked_at: Date | string | null;
  created_at: Date | string;
  person_name?: string | null;
};

export type McpTokenItem = {
  id: number;
  label: string;
  tokenHint: string;
  unlocks: McpUnlockModule[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  isActive: boolean;
};

export type McpTokenListResponse = {
  items: McpTokenItem[];
};

export type CreateMcpTokenResponse = {
  /** Token asli — hanya dikembalikan sekali. */
  token: string;
  item: McpTokenItem;
};

export type RevokeMcpTokenResult = {
  revoked: true;
  alreadyRevoked: boolean;
  item: McpTokenItem;
};

export type AdminMcpTokenItem = McpTokenItem & {
  personId: number;
  personName: string;
};

export type AdminMcpTokenListResponse = {
  items: AdminMcpTokenItem[];
};

export type McpTokenStatusFilter = 'active' | 'revoked' | 'all';

export type McpTokenAuthContext = {
  tokenId: number;
  personId: number;
  familyId: number;
  unlockModules: McpUnlockModule[];
};

export type ReadFocusMeta = {
  /** Perspektif baca/pivot — dari `?focusPersonId=` atau default user login */
  focusPersonId: number;
  /** ID yang valid untuk param (diri + pasangan) */
  allowedFocusPersonIds: number[];
};

export type PersonAddress = {
  street?: string | null;
  district?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type PersonResponse = {
  id: number;
  fullName: string;
  nickname: string | null;
  gender: 'male' | 'female';
  birthDate: string;
  deathDate: string | null;
  status: 'alive' | 'deceased';
  religion: 'islam' | 'other' | null;
  photoUrl: string | null;
  occupation: string | null;
  phone: string | null;
  phoneAlt: string | null;
  address: PersonAddress | null;
  fatherId: number | null;
  motherId: number | null;
  spouseIds: number[];
  generationLabel: string;
  isSelf: boolean;
  /** true jika person = focusPersonId (pivot baca saat ini) */
  isFocus: boolean;
  role: 'admin' | 'member';
};

/** GET /persons/:id — person fields + read focus meta (top-level) */
export type PersonReadResponse = ReadFocusMeta & PersonResponse;

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export type TreeGraphMeta = {
  /** Sama dengan `focusPersonId` — center layout React Flow */
  anchorPersonId: number;
  edgeFields: {
    parent: ['fatherId', 'motherId'];
    spouse: 'spouseIds';
  };
};

export type TreeLineage = 'both' | 'paternal' | 'maternal';

export type TreeSubgraphFilter = {
  lineage: TreeLineage;
  generationsUp: number;
  showSpouses: boolean;
  showSiblings: boolean;
  showChildren: boolean;
};

export type TreeFilterMeta = TreeSubgraphFilter & {
  applied: boolean;
};

export type TreeViewMeta = {
  personCount: number;
  totalFamilyCount: number;
  maxAncestorDepth: number;
  filtered: boolean;
  recommendClientFilter: boolean;
};

export type PersonListQuery = {
  page?: number;
  limit?: number;
  view?: 'list' | 'tree';
};

export type PersonListResponse = ReadFocusMeta & {
  view: 'list' | 'tree';
  /** User login (JWT) — hanya ada di mode tree */
  selfPersonId?: number;
  /** Mode list: anchor config keluarga di DB. Mode tree: sama dengan `focusPersonId`. */
  rootPersonId: number | null;
  persons: PersonResponse[];
  pagination?: PaginationMeta;
  treeGraph?: TreeGraphMeta;
  filter?: TreeFilterMeta;
  meta?: TreeViewMeta;
  graphWarnings?: string[];
};

export type PersonGraphNode = {
  id: number;
  gender: 'male' | 'female';
  fatherId: number | null;
  motherId: number | null;
  spouseIds: number[];
};

export type PersonRow = {
  id: number;
  family_id: number;
  full_name: string;
  nickname: string | null;
  gender: 'male' | 'female';
  birth_date: Date | string;
  death_date: Date | string | null;
  status: 'alive' | 'deceased';
  father_id: number | null;
  mother_id: number | null;
  deleted_at: Date | null;
  religion: 'islam' | 'other' | null;
  photo_url: string | null;
  occupation: string | null;
  phone: string | null;
  phone_alt: string | null;
  street: string | null;
  district: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  role: 'admin' | 'member';
};

export type UpsertPersonInput = {
  fullName: string;
  nickname?: string | null;
  gender: 'male' | 'female';
  birthDate: string;
  deathDate?: string | null;
  status?: 'alive' | 'deceased';
  religion?: 'islam' | 'other' | null;
  photoUrl?: string | null;
  occupation?: string | null;
  phone?: string | null;
  phoneAlt?: string | null;
  address?: PersonAddress | null;
  fatherId?: number | null;
  motherId?: number | null;
  spouseIds?: number[];
  role?: 'admin' | 'member';
};

export type SpousePairRow = {
  person_id_a: number;
  person_id_b: number;
};

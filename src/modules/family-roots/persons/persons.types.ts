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

/** Mode list only — tree ignore param ini. */
export type PersonListScope = 'branch' | 'family';

export type PersonListQuery = {
  page?: number;
  limit?: number;
  view?: 'list' | 'tree';
  /**
   * `branch` (default) — hanya cabang genealogi focus (root/pasangan).
   * `family` — semua person aktif di family (termasuk di luar cabang fokus).
   */
  scope?: PersonListScope;
  /**
   * Cari nama (fullName + nickname), match **per kata** (AND, urutan bebas).
   * Contoh: `q=Mulyono Basuki` cocok `Basuki Mulyono`.
   */
  q?: string;
  /**
   * Filter gender — untuk picker ayah (`male`) / ibu (`female`).
   */
  gender?: 'male' | 'female';
};

export type PersonListResponse = ReadFocusMeta & {
  view: 'list' | 'tree';
  /** User login (JWT) — hanya ada di mode tree */
  selfPersonId?: number;
  /** Mode list: anchor config keluarga di DB. Mode tree: sama dengan `focusPersonId`. */
  rootPersonId: number | null;
  /** Mode list: scope data yang dipakai. */
  scope?: PersonListScope;
  /** Mode list: echo query search (jika dikirim). */
  q?: string;
  /** Mode list: echo filter gender (jika dikirim). */
  gender?: 'male' | 'female';
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
  /** Prefer over photoUrl — dari POST /media/upload purpose=person (max 1). */
  mediaId?: string | null;
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

export type PersonMapItem = {
  id: number;
  fullName: string;
  nickname: string | null;
  gender: 'male' | 'female';
  status: 'alive' | 'deceased';
  photoUrl: string | null;
  generationLabel: string;
  phone: string | null;
  phoneAlt: string | null;
  address: PersonAddress | null;
};

export type PersonMapMeta = {
  totalVisible: number;
  withAddress: number;
  withExactCoords: number;
  withCityOnly: number;
};

export type PersonMapQuery = {
  lineage?: TreeLineage;
  status?: 'alive' | 'deceased' | 'all';
  city?: string;
  province?: string;
  q?: string;
};

export type PersonMapResponse = ReadFocusMeta & {
  selfPersonId: number;
  persons: PersonMapItem[];
  meta: PersonMapMeta;
};

export type PatchPersonAddressInput = {
  address: PersonAddress;
};

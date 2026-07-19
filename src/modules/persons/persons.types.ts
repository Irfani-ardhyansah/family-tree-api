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
  role: 'admin' | 'member';
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export type TreeGraphMeta = {
  anchorPersonId: number | null;
  edgeFields: {
    parent: ['fatherId', 'motherId'];
    spouse: 'spouseIds';
  };
  note: string;
};

export type PersonListQuery = {
  page?: number;
  limit?: number;
  view?: 'list' | 'tree';
};

export type PersonListResponse = {
  view: 'list' | 'tree';
  rootPersonId: number | null;
  persons: PersonResponse[];
  pagination?: PaginationMeta;
  treeGraph?: TreeGraphMeta;
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

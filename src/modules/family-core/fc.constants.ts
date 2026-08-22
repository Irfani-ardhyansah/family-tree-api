export const DOCUMENT_ICON_KEYS = [
  'user',
  'home',
  'fileText',
  'file',
  'heart',
  'briefcase',
  'creditCard',
  'key',
  'truck',
  'award',
  'shield',
] as const;
export type DocumentIconKey = (typeof DOCUMENT_ICON_KEYS)[number];

export const DOCUMENT_TONE_KEYS = [
  'sky',
  'indigo',
  'violet',
  'blue',
  'rose',
  'orange',
  'amber',
  'teal',
  'emerald',
  'fuchsia',
  'cyan',
  'gray',
] as const;
export type DocumentToneKey = (typeof DOCUMENT_TONE_KEYS)[number];

export const CALENDAR_EVENT_ICON_KEYS = [
  'bookOpen',
  'briefcase',
  'gift',
  'heart',
  'creditCard',
  'star',
  'calendar',
  'home',
  'users',
  'bell',
] as const;
export type CalendarEventIconKey = (typeof CALENDAR_EVENT_ICON_KEYS)[number];

export const CALENDAR_EVENT_TONE_KEYS = [
  'indigo',
  'slate',
  'pink',
  'rose',
  'amber',
  'violet',
  'gray',
  'sky',
  'teal',
  'emerald',
] as const;
export type CalendarEventToneKey = (typeof CALENDAR_EVENT_TONE_KEYS)[number];

export const REMINDER_DAYS_OPTIONS = [7, 14, 30, 60, 90] as const;
export type ReminderDays = (typeof REMINDER_DAYS_OPTIONS)[number];

export const DEFAULT_REMINDER_DAYS: ReminderDays = 30;
export const EXPIRING_SOON_DAYS = 90;

export type DocumentExtraFieldDef = {
  key: string;
  label: string;
  placeholder?: string;
};

export type SeedDocumentType = {
  slug: string;
  label: string;
  icon_key: DocumentIconKey;
  tone_key: DocumentToneKey;
  default_lifetime: boolean;
  allow_custom_title: boolean;
  sort_order: number;
  extras: DocumentExtraFieldDef[];
};

export type SeedCalendarEventType = {
  slug: string;
  label: string;
  icon_key: CalendarEventIconKey;
  tone_key: CalendarEventToneKey;
  links_to_health: boolean;
  sort_order: number;
};

/** Keep in sync with FE INITIAL_DOCUMENT_TYPES. */
export const SEED_DOCUMENT_TYPES: SeedDocumentType[] = [
  {
    slug: 'ktp',
    label: 'KTP / NIK',
    icon_key: 'user',
    tone_key: 'sky',
    default_lifetime: true,
    allow_custom_title: false,
    sort_order: 10,
    extras: [],
  },
  {
    slug: 'kk',
    label: 'Kartu Keluarga',
    icon_key: 'home',
    tone_key: 'indigo',
    default_lifetime: true,
    allow_custom_title: false,
    sort_order: 20,
    extras: [],
  },
  {
    slug: 'akta_lahir',
    label: 'Akta Lahir',
    icon_key: 'fileText',
    tone_key: 'violet',
    default_lifetime: true,
    allow_custom_title: false,
    sort_order: 30,
    extras: [],
  },
  {
    slug: 'paspor',
    label: 'Paspor',
    icon_key: 'file',
    tone_key: 'blue',
    default_lifetime: false,
    allow_custom_title: false,
    sort_order: 40,
    extras: [],
  },
  {
    slug: 'bpjs_kesehatan',
    label: 'BPJS Kesehatan',
    icon_key: 'heart',
    tone_key: 'rose',
    default_lifetime: true,
    allow_custom_title: false,
    sort_order: 50,
    extras: [
      { key: 'faskes', label: 'Faskes', placeholder: 'Nama faskes' },
      { key: 'kelas', label: 'Kelas', placeholder: '1 / 2 / 3' },
    ],
  },
  {
    slug: 'bpjs_ketenagakerjaan',
    label: 'BPJS Ketenagakerjaan',
    icon_key: 'briefcase',
    tone_key: 'orange',
    default_lifetime: true,
    allow_custom_title: false,
    sort_order: 60,
    extras: [],
  },
  {
    slug: 'npwp',
    label: 'NPWP',
    icon_key: 'creditCard',
    tone_key: 'amber',
    default_lifetime: true,
    allow_custom_title: false,
    sort_order: 70,
    extras: [],
  },
  {
    slug: 'sim',
    label: 'SIM',
    icon_key: 'key',
    tone_key: 'teal',
    default_lifetime: false,
    allow_custom_title: false,
    sort_order: 80,
    extras: [{ key: 'simType', label: 'Jenis SIM', placeholder: 'A / B / C' }],
  },
  {
    slug: 'stnk',
    label: 'STNK',
    icon_key: 'truck',
    tone_key: 'emerald',
    default_lifetime: false,
    allow_custom_title: false,
    sort_order: 90,
    extras: [{ key: 'plate', label: 'Plat nomor', placeholder: 'B 1234 XYZ' }],
  },
  {
    slug: 'ijazah',
    label: 'Ijazah / Sertifikat',
    icon_key: 'award',
    tone_key: 'fuchsia',
    default_lifetime: true,
    allow_custom_title: false,
    sort_order: 100,
    extras: [
      { key: 'institution', label: 'Institusi', placeholder: 'Nama institusi' },
      { key: 'year', label: 'Tahun', placeholder: '2020' },
    ],
  },
  {
    slug: 'rekening',
    label: 'Rekening Bank',
    icon_key: 'creditCard',
    tone_key: 'cyan',
    default_lifetime: true,
    allow_custom_title: false,
    sort_order: 110,
    extras: [{ key: 'bank', label: 'Bank', placeholder: 'BCA / Mandiri / …' }],
  },
  {
    slug: 'lainnya',
    label: 'Lainnya',
    icon_key: 'shield',
    tone_key: 'gray',
    default_lifetime: false,
    allow_custom_title: true,
    sort_order: 120,
    extras: [],
  },
];

/** Keep in sync with FE INITIAL_CALENDAR_EVENT_TYPES. */
export const SEED_CALENDAR_EVENT_TYPES: SeedCalendarEventType[] = [
  {
    slug: 'sekolah',
    label: 'Sekolah',
    icon_key: 'bookOpen',
    tone_key: 'indigo',
    links_to_health: false,
    sort_order: 10,
  },
  {
    slug: 'kerja',
    label: 'Kerja',
    icon_key: 'briefcase',
    tone_key: 'slate',
    links_to_health: false,
    sort_order: 20,
  },
  {
    slug: 'ulang_tahun',
    label: 'Ulang tahun',
    icon_key: 'gift',
    tone_key: 'pink',
    links_to_health: false,
    sort_order: 30,
  },
  {
    slug: 'dokter',
    label: 'Dokter',
    icon_key: 'heart',
    tone_key: 'rose',
    links_to_health: true,
    sort_order: 40,
  },
  {
    slug: 'tagihan',
    label: 'Tagihan',
    icon_key: 'creditCard',
    tone_key: 'amber',
    links_to_health: false,
    sort_order: 50,
  },
  {
    slug: 'anniversary',
    label: 'Anniversary',
    icon_key: 'star',
    tone_key: 'violet',
    links_to_health: false,
    sort_order: 60,
  },
  {
    slug: 'lainnya',
    label: 'Lainnya',
    icon_key: 'calendar',
    tone_key: 'gray',
    links_to_health: false,
    sort_order: 70,
  },
];

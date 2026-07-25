export const PersonOptionSetting = {
  READ_FOCUS_PERSON_ID: 'readFocusPersonId',
} as const;

export type PersonOptionSettingKey =
  (typeof PersonOptionSetting)[keyof typeof PersonOptionSetting];

export type PersonOptionRow = {
  person_id: number;
  setting: string;
  value: string;
  updated_at: Date;
};

export type PersonOptionsMap = Record<string, string>;

export type UpsertPersonOptionInput = {
  setting: string;
  value: string;
};

export type PersonOptionsResponse = {
  options: PersonOptionsMap;
};

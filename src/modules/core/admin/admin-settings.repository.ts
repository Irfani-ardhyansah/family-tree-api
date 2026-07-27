import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import { FamilySettingsRow } from './admin.types';

export class AdminSettingsRepository {
  async getFamily(familyId: number): Promise<FamilySettingsRow | undefined> {
    return db(Tables.FAMILIES)
      .where({ id: familyId })
      .first<FamilySettingsRow>('id', 'name', 'timezone', 'currency', 'logo_url', 'access_version');
  }

  async updateSettings(input: {
    familyId: number;
    familyName: string;
    timezone: string;
    currency: string;
    logoUrl: string | null;
  }): Promise<void> {
    await db(Tables.FAMILIES).where({ id: input.familyId }).update({
      name: input.familyName,
      timezone: input.timezone,
      currency: input.currency,
      logo_url: input.logoUrl,
      updated_at: db.fn.now(),
    });
  }

  async updateLogoUrl(familyId: number, logoUrl: string): Promise<void> {
    await db(Tables.FAMILIES).where({ id: familyId }).update({
      logo_url: logoUrl,
      updated_at: db.fn.now(),
    });
  }
}

export const adminSettingsRepository = new AdminSettingsRepository();

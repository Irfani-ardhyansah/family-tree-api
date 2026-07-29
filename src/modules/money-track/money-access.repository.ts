import db from '../../config/database';
import { Tables } from '../../shared/database/tables';
import type { MoneyPersonRow, MoneyWorkspaceRow } from './money.types';

export class MoneyAccessRepository {
  async findPersonByUserId(userId: number): Promise<MoneyPersonRow | undefined> {
    return db(Tables.MONEY_PERSONS)
      .where({ user_id: userId })
      .first<MoneyPersonRow>('*');
  }

  async findWorkspaceById(id: number): Promise<MoneyWorkspaceRow | undefined> {
    return db(Tables.MONEY_WORKSPACES).where({ id }).first<MoneyWorkspaceRow>('*');
  }

  async listPersons(workspaceId: number): Promise<MoneyPersonRow[]> {
    return db(Tables.MONEY_PERSONS)
      .where({ workspace_id: workspaceId })
      .orderBy('id', 'asc')
      .select<MoneyPersonRow[]>('*');
  }

  async findPersonById(
    workspaceId: number,
    personId: number,
  ): Promise<MoneyPersonRow | undefined> {
    return db(Tables.MONEY_PERSONS)
      .where({ id: personId, workspace_id: workspaceId })
      .first<MoneyPersonRow>('*');
  }
}

export const moneyAccessRepository = new MoneyAccessRepository();

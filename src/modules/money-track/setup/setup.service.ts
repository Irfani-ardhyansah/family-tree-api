import db from '../../../config/database';
import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { moneyAccessRepository } from '../money-access.repository';
import {
  asBool,
  assertPersonInWorkspace,
  inferWorkspaceMode,
  parseEnum,
  parseNonEmptyString,
  parseOptionalPositiveInt,
  parsePositiveInt,
  resolveMoneyContext,
  toIso,
  toMoneyPersonDto,
  tryResolveMoneyContext,
} from '../money.access';
import {
  MONEY_PERSON_ROLES,
  MONEY_WORKSPACE_RESET_CONFIRM,
  MONEY_WORKSPACE_RESET_MODES,
  type MoneyPersonRole,
  type MoneyWorkspaceResetMode,
} from '../money.constants';
import type { MoneySetupResponse, MoneyWorkspaceResetResponse } from '../money.types';
import { setupRepository } from './setup.repository';

type SetupPersonInput = {
  name: string;
  role: MoneyPersonRole;
  familyRootsPersonId: number | null;
};

export class SetupService {
  async getStatus(authPersonId: number, familyId: number): Promise<MoneySetupResponse> {
    const ctx = await tryResolveMoneyContext(authPersonId, familyId);
    if (!ctx) {
      return {
        isConfigured: false,
        mode: null,
        persons: [],
        coupleLinkedAt: null,
        needsOpeningBalances: false,
        hasSampleData: false,
      };
    }

    const persons = await moneyAccessRepository.listPersons(ctx.workspace.id);
    const openingCount = await setupRepository.countOpeningBalances(ctx.workspace.id);

    return {
      isConfigured: true,
      mode: ctx.workspace.mode,
      persons: persons.map(toMoneyPersonDto),
      coupleLinkedAt: toIso(ctx.workspace.couple_linked_at),
      needsOpeningBalances: openingCount === 0,
      hasSampleData: asBool(ctx.workspace.has_sample_data),
    };
  }

  async bootstrapPersons(
    authPersonId: number,
    familyId: number,
    body: unknown,
  ): Promise<MoneySetupResponse> {
    const existing = await setupRepository.findPersonByUserId(authPersonId);
    if (existing) {
      throw new AppError(
        409,
        ErrorCodes.MONEY_ALREADY_CONFIGURED,
        'Money Track sudah dikonfigurasi untuk akun ini.',
      );
    }

    const persons = this.parseSetupPersons(body);
    const mode = inferWorkspaceMode(persons.map((p) => p.role));

    const linkedIndex = persons.findIndex(
      (p) => p.familyRootsPersonId === authPersonId,
    );
    const actorIndex = linkedIndex >= 0 ? linkedIndex : 0;

    await db.transaction(async (trx) => {
      const workspace = await setupRepository.createWorkspace(
        {
          familyId,
          mode,
          coupleLinkedAt: mode === 'couple' ? new Date() : null,
        },
        trx,
      );

      const createdIds: number[] = [];
      for (let i = 0; i < persons.length; i += 1) {
        const p = persons[i]!;
        const created = await setupRepository.createPerson(
          {
            workspaceId: workspace.id,
            name: p.name,
            role: p.role,
            userId: i === actorIndex ? authPersonId : null,
            familyRootsPersonId: p.familyRootsPersonId,
          },
          trx,
        );
        createdIds.push(created.id);
        await setupRepository.createCashAccountWithPocket(
          { workspaceId: workspace.id, personId: created.id },
          trx,
        );
      }

      await setupRepository.seedCategories(workspace.id, trx);

      if (mode === 'couple' && createdIds.length === 2) {
        await setupRepository.createCoupleLink(
          {
            workspaceId: workspace.id,
            personAId: createdIds[0]!,
            personBId: createdIds[1]!,
          },
          trx,
        );
      }
    });

    return this.getStatus(authPersonId, familyId);
  }

  async coupleLink(
    authPersonId: number,
    familyId: number,
    body: unknown,
  ): Promise<MoneySetupResponse> {
    const ctx = await tryResolveMoneyContext(authPersonId, familyId);
    if (!ctx) {
      throw new AppError(
        404,
        ErrorCodes.MONEY_NOT_CONFIGURED,
        'Money Track belum dikonfigurasi.',
      );
    }

    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;
    const personAId = parsePositiveInt(raw.personAId, 'personAId');
    const personBId = parsePositiveInt(raw.personBId, 'personBId');
    if (personAId === personBId) {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'personAId dan personBId harus berbeda.');
    }

    const frA = parseOptionalPositiveInt(raw.familyRootsPersonAId, 'familyRootsPersonAId');
    const frB = parseOptionalPositiveInt(raw.familyRootsPersonBId, 'familyRootsPersonBId');

    const persons = await moneyAccessRepository.listPersons(ctx.workspace.id);
    assertPersonInWorkspace(persons, personAId);
    assertPersonInWorkspace(persons, personBId);

    const existingLink = await setupRepository.findCoupleLink(ctx.workspace.id);
    if (existingLink) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'Couple link sudah aktif.');
    }

    await db.transaction(async (trx) => {
      await setupRepository.createCoupleLink(
        { workspaceId: ctx.workspace.id, personAId, personBId },
        trx,
      );
      await setupRepository.updateWorkspace(
        ctx.workspace.id,
        { mode: 'couple', couple_linked_at: new Date() },
        trx,
      );
      if (frA !== undefined) {
        await setupRepository.updatePersonFamilyRoots(personAId, frA, trx);
      }
      if (frB !== undefined) {
        await setupRepository.updatePersonFamilyRoots(personBId, frB, trx);
      }
    });

    return this.getStatus(authPersonId, familyId);
  }

  async coupleUnlink(authPersonId: number, familyId: number): Promise<MoneySetupResponse> {
    const ctx = await tryResolveMoneyContext(authPersonId, familyId);
    if (!ctx) {
      throw new AppError(
        404,
        ErrorCodes.MONEY_NOT_CONFIGURED,
        'Money Track belum dikonfigurasi.',
      );
    }

    const existingLink = await setupRepository.findCoupleLink(ctx.workspace.id);
    if (!existingLink) {
      throw new AppError(
        404,
        ErrorCodes.MONEY_COUPLE_LINK_NOT_FOUND,
        'Couple link tidak ditemukan.',
      );
    }

    await db.transaction(async (trx) => {
      await setupRepository.archiveJointPockets(ctx.workspace.id, trx);
      await setupRepository.deleteCoupleLink(ctx.workspace.id, trx);
      await setupRepository.updateWorkspace(
        ctx.workspace.id,
        { mode: 'single', couple_linked_at: null },
        trx,
      );
    });

    return this.getStatus(authPersonId, familyId);
  }

  async resetWorkspace(
    authPersonId: number,
    familyId: number,
    body: unknown,
  ): Promise<MoneyWorkspaceResetResponse> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;

    const mode = parseEnum(raw.mode, 'mode', MONEY_WORKSPACE_RESET_MODES);
    if (raw.confirm !== MONEY_WORKSPACE_RESET_CONFIRM) {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        `confirm harus tepat "${MONEY_WORKSPACE_RESET_CONFIRM}".`,
      );
    }

    const keepSetup = this.parseKeepSetup(raw.keepSetup);

    if (mode === 'reseed' && !keepSetup) {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        'mode=reseed membutuhkan keepSetup=true (persons harus dipertahankan).',
      );
    }

    let deleted: Record<string, number> = {};

    await db.transaction(async (trx) => {
      if (!keepSetup) {
        deleted = await setupRepository.deleteWorkspace(ctx.workspace.id, trx);
        return;
      }

      const persons = await moneyAccessRepository.listPersons(ctx.workspace.id);
      deleted = await setupRepository.wipeKeepSetup(ctx.workspace.id, trx);

      if (mode === 'reseed') {
        await setupRepository.seedCategories(ctx.workspace.id, trx);
        for (const person of persons) {
          await setupRepository.createCashAccountWithPocket(
            { workspaceId: ctx.workspace.id, personId: person.id },
            trx,
          );
        }
        // Reseed = demo structure kembali → tombol Hapus Data Contoh boleh muncul lagi.
        await setupRepository.updateWorkspace(
          ctx.workspace.id,
          { has_sample_data: true },
          trx,
        );
      } else {
        // Wipe: sticky false permanen (meski user isi data real setelahnya).
        await setupRepository.updateWorkspace(
          ctx.workspace.id,
          { has_sample_data: false },
          trx,
        );
      }
    });

    const status = await this.getStatus(authPersonId, familyId);
    return {
      ...status,
      reset: {
        mode: mode as MoneyWorkspaceResetMode,
        keepSetup,
        hasSampleData: status.hasSampleData,
        deleted,
      },
    };
  }

  private parseKeepSetup(value: unknown): boolean {
    if (value === undefined || value === null || value === '') return true;
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'keepSetup harus boolean.');
  }

  private parseSetupPersons(body: unknown): SetupPersonInput[] {
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;
    if (!Array.isArray(raw.persons) || raw.persons.length === 0) {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'persons wajib diisi.');
    }

    const persons = raw.persons.map((item, index) => {
      if (!item || typeof item !== 'object') {
        throw new AppError(
          422,
          ErrorCodes.VALIDATION_ERROR,
          `persons[${index}] tidak valid.`,
        );
      }
      const row = item as Record<string, unknown>;
      const name = parseNonEmptyString(row.name, `persons[${index}].name`, 120);
      const role = parseEnum(row.role, `persons[${index}].role`, MONEY_PERSON_ROLES);
      const familyRootsPersonId =
        parseOptionalPositiveInt(
          row.familyRootsPersonId,
          `persons[${index}].familyRootsPersonId`,
        ) ?? null;
      return { name, role, familyRootsPersonId };
    });

    const roles = persons.map((p) => p.role);
    if (new Set(roles).size !== roles.length) {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Role person harus unik.');
    }
    inferWorkspaceMode(roles);

    return persons;
  }
}

export const setupService = new SetupService();

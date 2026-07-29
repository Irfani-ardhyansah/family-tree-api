import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { moneyAccessRepository } from '../money-access.repository';
import {
  asNumber,
  parseAmount,
  parseEnum,
  parseNonEmptyString,
  parseOptionalPositiveInt,
  parseOptionalString,
  parsePositiveInt,
  resolveMoneyContext,
  toIso,
} from '../money.access';
import { computePocketBalance } from '../money.balance';
import { MONEY_WISHLIST_PRIORITIES } from '../money.constants';
import type { MoneyWishlistDto, MoneyWishlistRow } from '../money.types';
import { pocketsRepository } from '../pockets/pockets.repository';
import { wishlistRepository } from './wishlist.repository';

async function toDto(row: MoneyWishlistRow): Promise<MoneyWishlistDto> {
  const dto: MoneyWishlistDto = {
    id: row.id,
    personId: row.person_id,
    name: row.name,
    estimatedPrice: asNumber(row.estimated_price) ?? 0,
    priority: row.priority,
    linkedPocketId: row.linked_pocket_id,
    imageMediaId: row.image_media_id,
    purchasedAt: toIso(row.purchased_at),
  };

  if (row.linked_pocket_id != null) {
    const progressAmount = await computePocketBalance(row.linked_pocket_id);
    const estimated = dto.estimatedPrice;
    dto.progressAmount = progressAmount;
    dto.progressPct =
      estimated > 0 ? Math.min(100, Math.round((progressAmount / estimated) * 100)) : 0;
  }

  return dto;
}

export class WishlistService {
  async list(authPersonId: number, familyId: number): Promise<MoneyWishlistDto[]> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const rows = await wishlistRepository.list(ctx.workspace.id);
    return Promise.all(rows.map(toDto));
  }

  async create(
    authPersonId: number,
    familyId: number,
    body: unknown,
  ): Promise<MoneyWishlistDto> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const parsed = await this.parseBody(ctx.workspace.id, body, 'create');
    const row = await wishlistRepository.create({
      workspaceId: ctx.workspace.id,
      ...parsed,
    });
    return toDto(row);
  }

  async update(
    authPersonId: number,
    familyId: number,
    idRaw: string,
    body: unknown,
  ): Promise<MoneyWishlistDto> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const id = parsePositiveInt(idRaw, 'id');
    const existing = await wishlistRepository.findById(ctx.workspace.id, id);
    if (!existing) {
      throw new AppError(404, ErrorCodes.MONEY_WISHLIST_NOT_FOUND, 'Wishlist tidak ditemukan.');
    }

    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;
    const patch: Parameters<typeof wishlistRepository.update>[2] = {};

    if (raw.name !== undefined) {
      patch.name = parseNonEmptyString(raw.name, 'name', 200);
    }
    if (raw.estimatedPrice !== undefined) {
      patch.estimated_price = parseAmount(raw.estimatedPrice, 'estimatedPrice');
    }
    if (raw.priority !== undefined) {
      patch.priority = parseEnum(raw.priority, 'priority', MONEY_WISHLIST_PRIORITIES);
    }
    if (raw.personId !== undefined) {
      const personId = parseOptionalPositiveInt(raw.personId, 'personId') ?? null;
      if (personId != null) {
        const person = await moneyAccessRepository.findPersonById(ctx.workspace.id, personId);
        if (!person) {
          throw new AppError(404, ErrorCodes.MONEY_PERSON_NOT_FOUND, 'Person tidak ditemukan.');
        }
      }
      patch.person_id = personId;
    }
    if (raw.linkedPocketId !== undefined) {
      const linkedPocketId =
        parseOptionalPositiveInt(raw.linkedPocketId, 'linkedPocketId') ?? null;
      if (linkedPocketId != null) {
        const pocket = await pocketsRepository.findById(ctx.workspace.id, linkedPocketId);
        if (!pocket || pocket.archived_at) {
          throw new AppError(404, ErrorCodes.MONEY_POCKET_NOT_FOUND, 'Pocket tidak ditemukan.');
        }
      }
      patch.linked_pocket_id = linkedPocketId;
    }
    if (raw.imageMediaId !== undefined) {
      patch.image_media_id =
        raw.imageMediaId === null || raw.imageMediaId === ''
          ? null
          : String(raw.imageMediaId);
    }
    if (raw.purchasedAt !== undefined) {
      if (raw.purchasedAt === null) {
        patch.purchased_at = null;
      } else if (typeof raw.purchasedAt === 'string') {
        patch.purchased_at = new Date(raw.purchasedAt);
      } else {
        throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'purchasedAt tidak valid.');
      }
    }

    if (Object.keys(patch).length > 0) {
      await wishlistRepository.update(ctx.workspace.id, id, patch);
    }
    const updated = (await wishlistRepository.findById(ctx.workspace.id, id))!;
    return toDto(updated);
  }

  async remove(
    authPersonId: number,
    familyId: number,
    idRaw: string,
  ): Promise<{ deleted: true }> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const id = parsePositiveInt(idRaw, 'id');
    const existing = await wishlistRepository.findById(ctx.workspace.id, id);
    if (!existing) {
      throw new AppError(404, ErrorCodes.MONEY_WISHLIST_NOT_FOUND, 'Wishlist tidak ditemukan.');
    }
    await wishlistRepository.delete(ctx.workspace.id, id);
    return { deleted: true };
  }

  private async parseBody(
    workspaceId: number,
    body: unknown,
    _mode: 'create',
  ): Promise<{
    personId: number | null;
    name: string;
    estimatedPrice: number;
    priority: string;
    linkedPocketId: number | null;
    imageMediaId: string | null;
  }> {
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;
    const name = parseNonEmptyString(raw.name, 'name', 200);
    const estimatedPrice = parseAmount(raw.estimatedPrice, 'estimatedPrice');
    const priority =
      raw.priority === undefined
        ? 'medium'
        : parseEnum(raw.priority, 'priority', MONEY_WISHLIST_PRIORITIES);
    const personId = parseOptionalPositiveInt(raw.personId, 'personId') ?? null;
    const linkedPocketId =
      parseOptionalPositiveInt(raw.linkedPocketId, 'linkedPocketId') ?? null;
    const imageMediaId =
      parseOptionalString(raw.imageMediaId, 'imageMediaId', 40) ?? null;

    if (personId != null) {
      const person = await moneyAccessRepository.findPersonById(workspaceId, personId);
      if (!person) {
        throw new AppError(404, ErrorCodes.MONEY_PERSON_NOT_FOUND, 'Person tidak ditemukan.');
      }
    }
    if (linkedPocketId != null) {
      const pocket = await pocketsRepository.findById(workspaceId, linkedPocketId);
      if (!pocket || pocket.archived_at) {
        throw new AppError(404, ErrorCodes.MONEY_POCKET_NOT_FOUND, 'Pocket tidak ditemukan.');
      }
    }

    return { personId, name, estimatedPrice, priority, linkedPocketId, imageMediaId };
  }
}

export const wishlistService = new WishlistService();

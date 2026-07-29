import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(Tables.MONEY_WORKSPACES, (table) => {
    table.increments('id').unsigned().primary();
    table.integer('family_id').unsigned().notNullable();
    table.foreign('family_id').references(`${Tables.FAMILIES}.id`).onDelete('CASCADE');
    table.enum('mode', ['single', 'couple']).notNullable().defaultTo('single');
    table.timestamp('couple_linked_at').nullable();
    table.timestamps(true, true);
    table.index(['family_id'], 'mt_workspaces_family_idx');
  });

  await knex.schema.createTable(Tables.MONEY_PERSONS, (table) => {
    table.increments('id').unsigned().primary();
    table.integer('workspace_id').unsigned().notNullable();
    table
      .foreign('workspace_id')
      .references(`${Tables.MONEY_WORKSPACES}.id`)
      .onDelete('CASCADE');
    table.string('name', 120).notNullable();
    table.enum('role', ['husband', 'wife', 'self']).notNullable();
    table.integer('user_id').unsigned().nullable();
    table
      .foreign('user_id')
      .references(`${Tables.PERSONS}.id`)
      .onDelete('SET NULL');
    table.integer('family_roots_person_id').unsigned().nullable();
    table
      .foreign('family_roots_person_id')
      .references(`${Tables.PERSONS}.id`)
      .onDelete('SET NULL');
    table.timestamps(true, true);
    table.unique(['user_id'], { indexName: 'mt_persons_user_unique' });
    table.index(['workspace_id'], 'mt_persons_workspace_idx');
  });

  await knex.schema.createTable(Tables.MONEY_COUPLE_LINKS, (table) => {
    table.increments('id').unsigned().primary();
    table.integer('workspace_id').unsigned().notNullable();
    table
      .foreign('workspace_id')
      .references(`${Tables.MONEY_WORKSPACES}.id`)
      .onDelete('CASCADE');
    table.integer('person_a_id').unsigned().notNullable();
    table
      .foreign('person_a_id')
      .references(`${Tables.MONEY_PERSONS}.id`)
      .onDelete('RESTRICT');
    table.integer('person_b_id').unsigned().notNullable();
    table
      .foreign('person_b_id')
      .references(`${Tables.MONEY_PERSONS}.id`)
      .onDelete('RESTRICT');
    table.timestamp('linked_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['workspace_id'], { indexName: 'mt_couple_links_workspace_unique' });
  });

  await knex.schema.createTable(Tables.MONEY_ACCOUNTS, (table) => {
    table.increments('id').unsigned().primary();
    table.integer('workspace_id').unsigned().notNullable();
    table
      .foreign('workspace_id')
      .references(`${Tables.MONEY_WORKSPACES}.id`)
      .onDelete('CASCADE');
    table.integer('person_id').unsigned().notNullable();
    table
      .foreign('person_id')
      .references(`${Tables.MONEY_PERSONS}.id`)
      .onDelete('CASCADE');
    table.string('name', 120).notNullable();
    table.enum('type', ['bank', 'ewallet', 'cash']).notNullable();
    table.string('bank_name', 120).nullable();
    table.timestamps(true, true);
    table.index(['workspace_id'], 'mt_accounts_workspace_idx');
    table.index(['person_id', 'type'], 'mt_accounts_person_type_idx');
  });

  await knex.schema.createTable(Tables.MONEY_POCKETS, (table) => {
    table.increments('id').unsigned().primary();
    table.integer('workspace_id').unsigned().notNullable();
    table
      .foreign('workspace_id')
      .references(`${Tables.MONEY_WORKSPACES}.id`)
      .onDelete('CASCADE');
    table.integer('account_id').unsigned().notNullable();
    table
      .foreign('account_id')
      .references(`${Tables.MONEY_ACCOUNTS}.id`)
      .onDelete('RESTRICT');
    table.enum('owner_type', ['person', 'joint']).notNullable().defaultTo('person');
    table.integer('owner_person_id').unsigned().nullable();
    table
      .foreign('owner_person_id')
      .references(`${Tables.MONEY_PERSONS}.id`)
      .onDelete('SET NULL');
    table
      .enum('category', ['transaksi', 'tabungan', 'investasi', 'custom'])
      .notNullable();
    table.string('name', 120).notNullable();
    table.bigInteger('goal_amount').nullable();
    table.date('goal_date').nullable();
    table.boolean('is_system').notNullable().defaultTo(false);
    table.timestamp('archived_at').nullable();
    table.timestamps(true, true);
    table.index(['workspace_id', 'archived_at'], 'mt_pockets_workspace_archived_idx');
    table.index(['account_id'], 'mt_pockets_account_idx');
    table.index(['owner_person_id'], 'mt_pockets_owner_person_idx');
  });

  await knex.schema.createTable(Tables.MONEY_CATEGORIES, (table) => {
    table.increments('id').unsigned().primary();
    table.integer('workspace_id').unsigned().notNullable();
    table
      .foreign('workspace_id')
      .references(`${Tables.MONEY_WORKSPACES}.id`)
      .onDelete('CASCADE');
    table.string('name', 80).notNullable();
    table.enum('type', ['income', 'expense']).notNullable();
    table.string('icon', 64).nullable();
    table.integer('sort_order').notNullable().defaultTo(0);
    table.boolean('is_system').notNullable().defaultTo(false);
    table.timestamp('deleted_at').nullable();
    table.timestamps(true, true);
    table.index(['workspace_id', 'type', 'deleted_at'], 'mt_categories_workspace_type_idx');
  });

  await knex.schema.createTable(Tables.MONEY_TRANSACTIONS, (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.integer('workspace_id').unsigned().notNullable();
    table
      .foreign('workspace_id')
      .references(`${Tables.MONEY_WORKSPACES}.id`)
      .onDelete('CASCADE');
    table.integer('pocket_id').unsigned().notNullable();
    table
      .foreign('pocket_id')
      .references(`${Tables.MONEY_POCKETS}.id`)
      .onDelete('RESTRICT');
    table.integer('category_id').unsigned().nullable();
    table
      .foreign('category_id')
      .references(`${Tables.MONEY_CATEGORIES}.id`)
      .onDelete('SET NULL');
    table
      .enum('type', ['income', 'expense', 'opening_balance', 'adjustment'])
      .notNullable();
    table.bigInteger('amount').notNullable();
    table.date('date').notNullable();
    table.string('note', 500).nullable();
    table.string('attachment_media_id', 40).nullable();
    table
      .foreign('attachment_media_id')
      .references(`${Tables.MEDIA}.id`)
      .onDelete('SET NULL');
    table.integer('created_by_person_id').unsigned().notNullable();
    table
      .foreign('created_by_person_id')
      .references(`${Tables.MONEY_PERSONS}.id`)
      .onDelete('RESTRICT');
    table.timestamps(true, true);
    table.index(['workspace_id', 'date'], 'mt_transactions_workspace_date_idx');
    table.index(['pocket_id', 'date'], 'mt_transactions_pocket_date_idx');
    table.index(['category_id'], 'mt_transactions_category_idx');
    table.index(['type'], 'mt_transactions_type_idx');
  });

  await knex.schema.createTable(Tables.MONEY_TRANSFERS, (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.integer('workspace_id').unsigned().notNullable();
    table
      .foreign('workspace_id')
      .references(`${Tables.MONEY_WORKSPACES}.id`)
      .onDelete('CASCADE');
    table.enum('kind', ['interpersonal', 'interpocket']).notNullable();
    table.integer('from_pocket_id').unsigned().notNullable();
    table
      .foreign('from_pocket_id')
      .references(`${Tables.MONEY_POCKETS}.id`)
      .onDelete('RESTRICT');
    table.integer('to_pocket_id').unsigned().notNullable();
    table
      .foreign('to_pocket_id')
      .references(`${Tables.MONEY_POCKETS}.id`)
      .onDelete('RESTRICT');
    table.bigInteger('amount').notNullable();
    table.date('date').notNullable();
    table.string('note', 500).nullable();
    table.integer('created_by_person_id').unsigned().notNullable();
    table
      .foreign('created_by_person_id')
      .references(`${Tables.MONEY_PERSONS}.id`)
      .onDelete('RESTRICT');
    table.timestamps(true, true);
    table.index(['workspace_id', 'date'], 'mt_transfers_workspace_date_idx');
    table.index(['from_pocket_id'], 'mt_transfers_from_pocket_idx');
    table.index(['to_pocket_id'], 'mt_transfers_to_pocket_idx');
  });

  await knex.schema.createTable(Tables.MONEY_CASH_WITHDRAWALS, (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.integer('workspace_id').unsigned().notNullable();
    table
      .foreign('workspace_id')
      .references(`${Tables.MONEY_WORKSPACES}.id`)
      .onDelete('CASCADE');
    table.integer('from_account_id').unsigned().notNullable();
    table
      .foreign('from_account_id')
      .references(`${Tables.MONEY_ACCOUNTS}.id`)
      .onDelete('RESTRICT');
    table.integer('from_pocket_id').unsigned().notNullable();
    table
      .foreign('from_pocket_id')
      .references(`${Tables.MONEY_POCKETS}.id`)
      .onDelete('RESTRICT');
    table.integer('to_cash_account_id').unsigned().notNullable();
    table
      .foreign('to_cash_account_id')
      .references(`${Tables.MONEY_ACCOUNTS}.id`)
      .onDelete('RESTRICT');
    table.integer('to_cash_pocket_id').unsigned().notNullable();
    table
      .foreign('to_cash_pocket_id')
      .references(`${Tables.MONEY_POCKETS}.id`)
      .onDelete('RESTRICT');
    table.bigInteger('amount').notNullable();
    table.date('date').notNullable();
    table.string('note', 500).nullable();
    table.string('attachment_media_id', 40).nullable();
    table
      .foreign('attachment_media_id')
      .references(`${Tables.MEDIA}.id`)
      .onDelete('SET NULL');
    table.integer('created_by_person_id').unsigned().notNullable();
    table
      .foreign('created_by_person_id')
      .references(`${Tables.MONEY_PERSONS}.id`)
      .onDelete('RESTRICT');
    table.timestamps(true, true);
    table.index(['workspace_id', 'date'], 'mt_cash_withdrawals_workspace_date_idx');
    table.index(['from_pocket_id'], 'mt_cash_withdrawals_from_pocket_idx');
    table.index(['to_cash_pocket_id'], 'mt_cash_withdrawals_to_cash_pocket_idx');
  });

  await knex.schema.createTable(Tables.MONEY_WISHLIST_ITEMS, (table) => {
    table.increments('id').unsigned().primary();
    table.integer('workspace_id').unsigned().notNullable();
    table
      .foreign('workspace_id')
      .references(`${Tables.MONEY_WORKSPACES}.id`)
      .onDelete('CASCADE');
    table.integer('person_id').unsigned().nullable();
    table
      .foreign('person_id')
      .references(`${Tables.MONEY_PERSONS}.id`)
      .onDelete('SET NULL');
    table.string('name', 200).notNullable();
    table.bigInteger('estimated_price').notNullable();
    table.enum('priority', ['low', 'medium', 'high']).notNullable().defaultTo('medium');
    table.integer('linked_pocket_id').unsigned().nullable();
    table
      .foreign('linked_pocket_id')
      .references(`${Tables.MONEY_POCKETS}.id`)
      .onDelete('SET NULL');
    table.string('image_media_id', 40).nullable();
    table
      .foreign('image_media_id')
      .references(`${Tables.MEDIA}.id`)
      .onDelete('SET NULL');
    table.timestamp('purchased_at').nullable();
    table.timestamps(true, true);
    table.index(['workspace_id'], 'mt_wishlist_workspace_idx');
    table.index(['person_id'], 'mt_wishlist_person_idx');
  });

  await knex.schema.createTable(Tables.MONEY_DEBTS, (table) => {
    table.increments('id').unsigned().primary();
    table.integer('workspace_id').unsigned().notNullable();
    table
      .foreign('workspace_id')
      .references(`${Tables.MONEY_WORKSPACES}.id`)
      .onDelete('CASCADE');
    table.integer('person_id').unsigned().notNullable();
    table
      .foreign('person_id')
      .references(`${Tables.MONEY_PERSONS}.id`)
      .onDelete('RESTRICT');
    table.string('counterparty_name', 120).notNullable();
    table.enum('direction', ['utang', 'piutang']).notNullable();
    table.bigInteger('amount').notNullable();
    table.date('date').notNullable();
    table.date('due_date').nullable();
    table.enum('status', ['open', 'partial', 'paid']).notNullable().defaultTo('open');
    table.string('note', 500).nullable();
    table.timestamps(true, true);
    table.index(['workspace_id', 'status'], 'mt_debts_workspace_status_idx');
    table.index(['workspace_id', 'direction'], 'mt_debts_workspace_direction_idx');
    table.index(['person_id'], 'mt_debts_person_idx');
    table.index(['due_date'], 'mt_debts_due_date_idx');
  });

  await knex.schema.createTable(Tables.MONEY_DEBT_PAYMENTS, (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.integer('workspace_id').unsigned().notNullable();
    table
      .foreign('workspace_id')
      .references(`${Tables.MONEY_WORKSPACES}.id`)
      .onDelete('CASCADE');
    table.integer('debt_id').unsigned().notNullable();
    table
      .foreign('debt_id')
      .references(`${Tables.MONEY_DEBTS}.id`)
      .onDelete('CASCADE');
    table.bigInteger('amount').notNullable();
    table.date('date').notNullable();
    table.string('note', 500).nullable();
    table.integer('created_by_person_id').unsigned().notNullable();
    table
      .foreign('created_by_person_id')
      .references(`${Tables.MONEY_PERSONS}.id`)
      .onDelete('RESTRICT');
    table.timestamps(true, true);
    table.index(['debt_id', 'date'], 'mt_debt_payments_debt_date_idx');
  });

  await knex.schema.createTable(Tables.MONEY_BUDGETS, (table) => {
    table.increments('id').unsigned().primary();
    table.integer('workspace_id').unsigned().notNullable();
    table
      .foreign('workspace_id')
      .references(`${Tables.MONEY_WORKSPACES}.id`)
      .onDelete('CASCADE');
    table.integer('category_id').unsigned().notNullable();
    table
      .foreign('category_id')
      .references(`${Tables.MONEY_CATEGORIES}.id`)
      .onDelete('RESTRICT');
    table.string('year_month', 7).notNullable();
    table.bigInteger('limit_amount').notNullable();
    table.timestamps(true, true);
    table.unique(['workspace_id', 'category_id', 'year_month'], {
      indexName: 'mt_budgets_workspace_category_month_unique',
    });
  });

  await knex.schema.createTable(Tables.MONEY_AUDIT_LOGS, (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.integer('workspace_id').unsigned().notNullable();
    table
      .foreign('workspace_id')
      .references(`${Tables.MONEY_WORKSPACES}.id`)
      .onDelete('CASCADE');
    table.integer('actor_person_id').unsigned().notNullable();
    table
      .foreign('actor_person_id')
      .references(`${Tables.MONEY_PERSONS}.id`)
      .onDelete('RESTRICT');
    table.enum('action', ['create', 'update', 'delete']).notNullable();
    table.string('entity_type', 40).notNullable();
    table.bigInteger('entity_id').unsigned().notNullable();
    table.json('before').nullable();
    table.json('after').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index(['workspace_id', 'created_at'], 'mt_audit_logs_workspace_created_idx');
    table.index(['entity_type', 'entity_id'], 'mt_audit_logs_entity_idx');
    table.index(['actor_person_id'], 'mt_audit_logs_actor_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(Tables.MONEY_AUDIT_LOGS);
  await knex.schema.dropTableIfExists(Tables.MONEY_BUDGETS);
  await knex.schema.dropTableIfExists(Tables.MONEY_DEBT_PAYMENTS);
  await knex.schema.dropTableIfExists(Tables.MONEY_DEBTS);
  await knex.schema.dropTableIfExists(Tables.MONEY_WISHLIST_ITEMS);
  await knex.schema.dropTableIfExists(Tables.MONEY_CASH_WITHDRAWALS);
  await knex.schema.dropTableIfExists(Tables.MONEY_TRANSFERS);
  await knex.schema.dropTableIfExists(Tables.MONEY_TRANSACTIONS);
  await knex.schema.dropTableIfExists(Tables.MONEY_CATEGORIES);
  await knex.schema.dropTableIfExists(Tables.MONEY_POCKETS);
  await knex.schema.dropTableIfExists(Tables.MONEY_ACCOUNTS);
  await knex.schema.dropTableIfExists(Tables.MONEY_COUPLE_LINKS);
  await knex.schema.dropTableIfExists(Tables.MONEY_PERSONS);
  await knex.schema.dropTableIfExists(Tables.MONEY_WORKSPACES);
}

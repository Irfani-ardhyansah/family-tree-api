import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(Tables.PA_VISITORS, (table) => {
    table.string('visitor_id', 36).primary();
    table.specificType('first_seen_at', 'datetime(3)').notNullable();
    table.specificType('last_seen_at', 'datetime(3)').notNullable();
    table.string('first_country_code', 2).nullable();
    table.string('last_country_code', 2).nullable();
    table.string('first_referrer', 1024).nullable();
    table.json('first_utm_json').nullable();
  });

  await knex.schema.createTable(Tables.PA_SESSIONS, (table) => {
    table.string('session_id', 36).primary();
    table.string('visitor_id', 36).notNullable();
    table.specificType('started_at', 'datetime(3)').notNullable();
    table.specificType('ended_at', 'datetime(3)').nullable();
    table.string('landing_path', 512).nullable();
    table.string('exit_path', 512).nullable();
    table.string('referrer', 1024).nullable();
    table.string('utm_source', 128).nullable();
    table.string('utm_medium', 128).nullable();
    table.string('utm_campaign', 128).nullable();
    table.string('utm_content', 128).nullable();
    table.string('utm_term', 128).nullable();
    table.string('country_code', 2).nullable();
    table.string('region', 128).nullable();
    table.string('city', 128).nullable();
    table.string('device', 16).nullable();
    table.string('browser', 64).nullable();
    table.string('os', 64).nullable();
    table.boolean('is_bot').notNullable().defaultTo(false);
    table.string('ip', 45).nullable();
    table.string('ip_hash', 64).nullable();
    table.string('user_agent', 512).nullable();
    table.integer('pageview_count').unsigned().notNullable().defaultTo(0);
    table.integer('click_count').unsigned().notNullable().defaultTo(0);
    table.integer('outbound_count').unsigned().notNullable().defaultTo(0);
    table.smallint('max_scroll_percent').unsigned().notNullable().defaultTo(0);
    table.integer('active_ms').unsigned().notNullable().defaultTo(0);
    table.boolean('incomplete').notNullable().defaultTo(false);

    table.index(['visitor_id'], 'pa_sessions_visitor_idx');
    table.index(['started_at'], 'pa_sessions_started_idx');
    table.index(['is_bot', 'started_at'], 'pa_sessions_bot_started_idx');
  });

  await knex.schema.createTable(Tables.PA_EVENTS, (table) => {
    table.string('event_id', 36).primary();
    table.string('visitor_id', 36).nullable();
    table.string('session_id', 36).nullable();
    table.string('name', 64).notNullable();
    table.specificType('ts', 'datetime(3)').notNullable();
    table.specificType('received_at', 'datetime(3)').notNullable();
    table.string('page_id', 32).nullable();
    table.string('path', 512).nullable();
    table.json('props').nullable();
    table.string('country_code', 2).nullable();
    table.boolean('is_bot').notNullable().defaultTo(false);
    table.boolean('incomplete').notNullable().defaultTo(false);

    table.index(['ts'], 'pa_events_ts_idx');
    table.index(['name', 'ts'], 'pa_events_name_ts_idx');
    table.index(['session_id', 'ts'], 'pa_events_session_ts_idx');
    table.index(['visitor_id', 'ts'], 'pa_events_visitor_ts_idx');
    table.index(['page_id', 'ts'], 'pa_events_page_ts_idx');
  });

  await knex.schema.createTable(Tables.PA_DAILY_ROLLUPS, (table) => {
    table.increments('id').unsigned().primary();
    table.date('bucket_date').notNullable();
    table.string('page_id', 32).notNullable();
    table.integer('unique_visitors').unsigned().notNullable().defaultTo(0);
    table.integer('sessions').unsigned().notNullable().defaultTo(0);
    table.integer('pageviews').unsigned().notNullable().defaultTo(0);
    table.integer('outbound_email').unsigned().notNullable().defaultTo(0);
    table.integer('outbound_whatsapp').unsigned().notNullable().defaultTo(0);
    table.integer('outbound_instagram').unsigned().notNullable().defaultTo(0);
    table.json('top_countries').nullable();
    table.integer('avg_active_ms').unsigned().notNullable().defaultTo(0);
    table.unique(['bucket_date', 'page_id'], 'pa_daily_rollups_date_page_uidx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(Tables.PA_DAILY_ROLLUPS);
  await knex.schema.dropTableIfExists(Tables.PA_EVENTS);
  await knex.schema.dropTableIfExists(Tables.PA_SESSIONS);
  await knex.schema.dropTableIfExists(Tables.PA_VISITORS);
}

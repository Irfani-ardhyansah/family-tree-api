import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {

    await knex.schema.createTable('users', (table) => {
        table.increments('id').primary();

        table.string('level').defaultTo('user');
        table.string('email').notNullable().unique();
        table.string('username').notNullable();
        table.string('password').notNullable();

        table.timestamps(true, true);
    });

    await knex.schema.createTable('user_profiles', (table) => {
        table.increments('id').primary();

        table.integer('user_id').unsigned().notNullable();
        table.foreign('user_id').references('users.id').onDelete('CASCADE');

        table.string('full_name').notNullable();
        table.enum('gender', ['M', 'F']).notNullable();
        table.date('birth_date').notNullable();
        table.string('birth_place').notNullable();
        table.string('death_date').nullable(); 
        
        table.timestamps(true, true);
    });

    await knex.schema.createTable('family_trees', (table)=> {
        table.increments('id').primary();

        table.integer('user_id').unsigned().notNullable();
        table.foreign('user_id').references('users.id').onDelete('CASCADE');

        table.integer('relative_id').unsigned().notNullable();
        table.foreign('relative_id').references('users.id').onDelete('CASCADE'); 

        table.string('relation_type').notNullable();

        table.timestamps(true, true);
    });

}


export async function down(knex: Knex): Promise<void> {
    // Hapus tabel dengan urutan terbalik agar tidak error Foreign Key
    await knex.schema.dropTableIfExists('family_relations');
    await knex.schema.dropTableIfExists('user_profiles');
    await knex.schema.dropTableIfExists('users');
}


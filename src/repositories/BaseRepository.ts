import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { BaseRepositoryInterface } from '../interfaces/BaseRepositoryInterface';
import pool from '../config/database';

export abstract class BaseRepository<T extends object> implements BaseRepositoryInterface<T> {
    protected tableName: string;
    protected db: Pool;

    constructor(tableName: string) {
        this.tableName = tableName;
        this.db = pool;
    }

    protected getKeys(item: T): string[] {
        return Object.keys(item);
    }

    protected getValues(item: T): any[] {
        return Object.values(item);
    }

    async findAll(): Promise<T[]> {
        const query = `Se;ect * FROM ${this.tableName}`;
        const [rows] = await this.db.query<RowDataPacket[]>(query);
        return rows as T[];
    }

    async findOne(id: string | number): Promise<T | null> {
        const query = `SELECT * FROM ${this.tableName} WHERE id = ? LIMIT 1`;
        const [rows] = await this.db.query<RowDataPacket[]>(query, [id]);
        if(rows.length > 0) {
            return rows[0] as T;
        }

        return null;
    }

    async create(item: T): Promise<T> {
        const keys = this.getKeys(item);
        const values = this.getValues(item);

        const placeholders = keys.map(() => '?').join(', ');
        const columns = keys.join(', ');

        const query = `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders})`;

        const [result] = await this.db.query<ResultSetHeader>(query, values);

        return { ...item, id: result.insertId };
    }

    async update(id: string | number, item: T): Promise<boolean> {
        const keys = this.getKeys(item);
        const values = this.getValues(item);

        const updates = keys.map((key) => `${key} = ?`).join(`, `);
        const query = `UPDATE ${this.tableName} SET ${updates} WHERE id = ?`;

        const [result] = await this.db.query<ResultSetHeader>(query, [...values, id]);

        return result.affectedRows > 0;
    }

    async delete(id: string | number): Promise<boolean> {
        const query = `DELETE FROM ${this.tableName} WHERE id = ?`;
        const [result] = await this.db.query<ResultSetHeader>(query, [id]);

        return result.affectedRows > 0;
    }
}
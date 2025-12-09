import { BaseRepository } from './BaseRepository';
import { User } from '../models/User';
import { RowDataPacket } from 'mysql2';

export class UserRepository extends BaseRepository<User> {
    constructor() {
        super('users');
    }

    async findByEmail(email: string): Promise<User | null> {
        const query = `SELECT * FROM ${this.tableName} WHERE email = ? LIMIT 1`;
        const [rows] = await this.db.query<RowDataPacket[]>(query, [email]);

        return (rows.length > 0 ? rows[0] : null) as User;
    }
}

export interface IRead<T> {
    findAll(item: T): Promise<T[]>;
    findOne(id: string | number): Promise<T | null>;
}
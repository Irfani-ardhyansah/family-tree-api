export interface IWrite<T> {
    create(item: T): Promise<T>;
    update(id: string | number, item: T): Promise<boolean>;
    delete(id: string| number): Promise<boolean>;
}
import { IRead } from './IRead';
import { IWrite } from './IWrite';

export interface BaseRepositoryInterface<T> extends IRead<T>, IWrite<T> {}
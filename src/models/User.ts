export interface User {
    id?: number; 
    email: string;
    username: string;
    password?: string;
    created_aat?: Date;
    updated_at?: Date;
}
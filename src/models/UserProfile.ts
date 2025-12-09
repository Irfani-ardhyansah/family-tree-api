export interface UserProfile {
    id?: number;
    user_id: number;
    full_name: string;
    gender: 'M' | 'F';
    birth_date: Date;
    birth_place: string;
    death_date?: Date | null;
    created_at?: Date;
    updated_at?: Date;
}
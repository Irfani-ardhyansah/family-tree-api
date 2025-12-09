export interface CreateUserRequest {
    email: string;
    username: string;
    password: string;
}

export interface UserResponse {
    id: number; 
    email: string;
    username: string; 
    created_at: Date;
}
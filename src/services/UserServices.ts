import bcrypt from 'bcrypt';
import { User } from '../models/User';
import { UserRepository } from '../repositories/UserRepository';

export class UserService {
    private userRepository: UserRepository;

    constructor() {
        this.userRepository = new UserRepository();
    }

    async getAllUsers(): Promise<User[]> {
        const users = await this.userRepository.findAll();
        return users.map(user => {
            const { password, ...userWithoutPassword } = user; 
            return userWithoutPassword as User;
        })
    }

    async register(userData: User): Promise<User> {
        const existingUser = await this.userRepository.findByEmail(userData.email);
        if(existingUser) {
            throw new Error('Email already in use');
        }

        if(userData.password) {
            const salt = await bcrypt.genSalt(10);
            userData.password = await bcrypt.hash(userData.password, salt);
        }

        return await this.userRepository.create(userData);
    }
}
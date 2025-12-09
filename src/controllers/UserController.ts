import {Request, Response} from 'express';
import {UserService} from '../services/UserServices';

export class UserController {
    private userService: UserService;

    constructor() {
        this.userService = new UserService();
    }

    getUsers = async (req: Request, res: Response) => {
        try {
            const users = await this.userService.getAllUsers();
            res.json({data: users});
        } catch (error: any) {
            res.status(500).json({error: error.message});
        }
    }

    createUser = async (req: Request, res: Response) => {
        try {
            const user = await this.userService.register(req.body);
            res.status(201).json({
                message: 'User created successfully',
                data: {id: user.id, email: user.email, username: user.username}
            });
        } catch(error: any) {
            res.status(400).json({error: error.message});
        }
    }
}
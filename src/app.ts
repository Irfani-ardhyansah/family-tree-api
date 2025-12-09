import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import userRoutes from './routes/user.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const isProduction = process.env.NODE_ENV === 'production';

const corsOptions = {
    origin: isProduction 
    ? (process.env.ALLOWED_ORIGINS || '')
    : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/users', userRoutes);

app.get('/', (req, res) => {
    res.send('Family Tree API is Running');
});

app.listen(PORT, () => {
    console.log(`Server is Running on http://localhost:${PORT}`);
    console.log(`Environment: ${isProduction ? 'Production' : 'Development'}`);
});
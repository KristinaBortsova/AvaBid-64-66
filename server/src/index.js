import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import lotRoutes from './routes/lots.js';
import userRoutes from './routes/users.js';
import categoryRoutes from './routes/categories.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/lots', lotRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes); // ← И ЭТУ

app.get('/', (req, res) => {
  res.json({ message: 'AvaBid API работает!' });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
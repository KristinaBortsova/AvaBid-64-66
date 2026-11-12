import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

import { authenticateToken } from '../middleware/auth.js'; 

const router = express.Router();
const verificationCodes = new Map(); // Временное хранилище
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'avabid_super_secret_key_change_me';

// POST /api/auth/register — регистрация
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Заполните все поля' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    // Находим роль "Пользователь"
    const userRole = await prisma.role.findUnique({ where: { name: 'Пользователь' } });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        roleId: userRole.id,
      },
    });

    const token = jwt.sign(
      { userId: user.id, roleId: user.roleId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Регистрация успешна',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        balance: user.balance,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/auth/login — вход
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Заполните все поля' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const token = jwt.sign(
      { userId: user.id, roleId: user.roleId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Вход выполнен',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        balance: user.balance,
        role: user.role.name,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// 1. Запрос кода для смены почты или пароля
router.post('/request-code', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    // Генерируем 4-значный код
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    verificationCodes.set(email, { code, expiresAt: Date.now() + 10 * 60 * 1000 }); // Живет 10 минут

    console.log(`[ТЕСТ] Код подтверждения для ${email}: ${code}`); // Выводим в консоль сервера
    
    //ОТПРАВЩИК EMAIL (Nodemailer)!
    res.json({ message: 'Код отправлен на почту', debugCode: code }); // debugCode для удобства тестов
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// 2. Подтверждение смены почты
router.post('/change-email', authenticateToken, async (req, res) => {
  try {
    const { newEmail, code } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    
    const savedData = verificationCodes.get(user.email);
    if (!savedData || savedData.code !== code || Date.now() > savedData.expiresAt) {
      return res.status(400).json({ error: 'Неверный или просроченный код' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { email: newEmail }
    });

    verificationCodes.delete(user.email); // Удаляем код после использования
    res.json({ message: 'Почта успешно изменена' });
  } catch (error) {
    res.status(500).json({ error: 'Возможно, эта почта уже занята' });
  }
});

// 3. Сброс пароля
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const savedData = verificationCodes.get(email);
    if (!savedData || savedData.code !== code || Date.now() > savedData.expiresAt) {
      return res.status(400).json({ error: 'Неверный или просроченный код' });
    }

    // Проверка, чтобы новый пароль не совпадал со старым
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({ error: 'Новый пароль должен отличаться от старого' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    verificationCodes.delete(email);
    res.json({ message: 'Пароль успешно изменен' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
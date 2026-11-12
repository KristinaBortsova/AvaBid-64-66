import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Хелпер для проверки, является ли пользователь администратором
const checkAdmin = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true }
  });
  return user && user.role.name === 'Администратор';
};

// POST /api/support — отправить сообщение (Вопросы и предложения)
router.post('/', async (req, res) => {
  try {
    const { email, content } = req.body;

    if (!email || !content) {
      return res.status(400).json({ error: 'Заполните все поля' });
    }

    // Пытаемся найти пользователя по почте, чтобы привязать тикет к аккаунту (если он есть)
    const user = await prisma.user.findUnique({ where: { email } });

    const ticket = await prisma.supportTicket.create({
      data: { 
        email, 
        content,
        userId: user ? user.id : null // Привязываем, если нашли юзера
      }
    });

    res.status(201).json({ message: 'Сообщение отправлено', ticket });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/support — получить все тикеты (ТОЛЬКО ДЛЯ АДМИНА)
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Проверка прав
    const isAdmin = await checkAdmin(req.user.userId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Доступ запрещен. Требуются права администратора.' });
    }

    const tickets = await prisma.supportTicket.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(tickets);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/support/:id/reply — ответить на тикет (ТОЛЬКО ДЛЯ АДМИНА)
router.post('/:id/reply', authenticateToken, async (req, res) => {
  try {
    // Проверка прав
    const isAdmin = await checkAdmin(req.user.userId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Доступ запрещен. Требуются права администратора.' });
    }

    const ticketId = parseInt(req.params.id);
    const { reply } = req.body;

    if (!reply) {
      return res.status(400).json({ error: 'Введите текст ответа' });
    }

    const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) return res.status(404).json({ error: 'Тикет не найден' });

    // 1. Обновляем тикет
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { reply, status: 'CLOSED' }
    });

    // 2. Если у тикета есть привязанный user, создаем ему уведомление
    if (ticket.userId) {
        await prisma.notification.create({
            data: {
                userId: ticket.userId,
                title: 'Ответ на ваше обращение',
                // Форматируем сообщение: Вопрос -> Ответ
                message: `Ваше обращение: "${ticket.content}"\n\nОтвет поддержки: "${reply}"`,
                type: 'SUPPORT'
            }
        });
    }

    res.json({ message: 'Ответ отправлен' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
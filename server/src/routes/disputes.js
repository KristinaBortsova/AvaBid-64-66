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

// 1. ПОЛЬЗОВАТЕЛЬ ОТПРАВЛЯЕТ ЖАЛОБУ ИЗ ЧАТА
router.post('/:chatId', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { reason } = req.body;
    const userId = req.user.userId;

    if (!reason) return res.status(400).json({ error: 'Опишите проблему' });

    // 1. Создаем тикет
    const ticket = await prisma.ticket.create({
      data: { chatId: Number(chatId), userId, reason }
    });

    // 2. Находим всех администраторов
    const admins = await prisma.user.findMany({
      where: { role: { name: 'Администратор' } },
      select: { id: true }
    });

    // 3. Создаем уведомление для каждого админа со ссылкой на этот чат
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map(admin => ({
          userId: admin.id,
          title: 'Новая жалоба в чате!',
          message: `Поступила жалоба на сделку. Причина: ${reason}`,
          type: 'DISPUTE',
          linkUrl: `/pages/chat.html?id=${chatId}` // Ссылка на этот конкретный чат!
        }))
      });
    }

    res.json({ message: 'Обращение отправлено', ticket });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// 2. АДМИН ПОЛУЧАЕТ СПИСОК ВСЕХ ЖАЛОБ ИЗ ЧАТОВ
router.get('/', authenticateToken, async (req, res) => {
  try {
    const isAdmin = await checkAdmin(req.user.userId);
    if (!isAdmin) return res.status(403).json({ error: 'Доступ запрещен' });

    const tickets = await prisma.ticket.findMany({
      where: { status: 'OPEN' },
      include: { 
        user: { select: { name: true } },
        chat: { select: { id: true, lot: { select: { name: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(tickets);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// 3. АДМИН РЕШАЕТ СПОР (Завершает или Отменяет сделку)
router.post('/:chatId/resolve', authenticateToken, async (req, res) => {
  try {
    const isAdmin = await checkAdmin(req.user.userId);
    if (!isAdmin) return res.status(403).json({ error: 'Доступ запрещен' });

    const { chatId } = req.params;
    const { action } = req.body; // 'cancel' или 'complete'
    const id = Number(chatId);

    // Подтягиваем чат и ставку, чтобы знать сумму
    const chat = await prisma.chat.findUnique({
      where: { id },
      include: { lot: { include: { bids: { orderBy: { currentPrice: 'desc' }, take: 1 } } } }
    });

    if (!chat || chat.status !== 'ACTIVE') {
        return res.status(400).json({ error: 'Чат не найден или уже закрыт' });
    }

    const finalPrice = chat.lot?.bids?.[0]?.currentPrice || 0;

    if (action === 'cancel') {
        // Возвращаем деньги покупателю
        if (finalPrice > 0) {
            await prisma.user.update({ where: { id: chat.buyerId }, data: { balance: { increment: finalPrice } } });
            await prisma.walletHistory.create({
                data: { userId: chat.buyerId, amount: finalPrice, type: 'REFUND', description: `Возврат по спору (Лот "${chat.lot.name}")` }
            });
        }
        await prisma.chat.update({ where: { id }, data: { status: 'CANCELLED' } });
    } else {
        // Переводим деньги продавцу
        if (finalPrice > 0) {
            await prisma.user.update({ where: { id: chat.sellerId }, data: { balance: { increment: finalPrice } } });
            await prisma.walletHistory.create({
                data: { userId: chat.sellerId, amount: finalPrice, type: 'SALE', description: `Выплата по спору (Лот "${chat.lot.name}")` }
            });
        }
        await prisma.chat.update({ where: { id }, data: { status: 'COMPLETED' } });
    }

    // Закрываем тикет
    await prisma.ticket.updateMany({
      where: { chatId: id, status: 'OPEN' },
      data: { status: 'RESOLVED' }
    });

    res.json({ message: 'Спор решен' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка при решении спора' });
  }
});

export default router;
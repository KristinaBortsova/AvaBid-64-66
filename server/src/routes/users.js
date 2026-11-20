import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/users/me — информация о текущем пользователе + его лоты
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { role: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const lots = await prisma.lot.findMany({
      where: { userId: user.id },
      include: {
        images: true,
        category: true,
        bids: { orderBy: { currentPrice: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      balance: user.balance,
      avatarUrl: user.avatarUrl,
      role: user.role.name,
      receiveBroadcasts: user.receiveBroadcasts,
      isBanned: user.isBanned,
      banReason: user.banReason,
      lotsCount: lots.length,
      lots: lots.map((lot) => ({
        id: lot.id,
        name: lot.name,
        image: lot.images[0]?.imageUrl || null,
        currentPrice: lot.bids[0]?.currentPrice || lot.startPrice,
        category: lot.category.name,
        endTime: lot.endTime,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/users/me/history — история операций
router.get('/me/history', authenticateToken, async (req, res) => {
  try {
    const history = await prisma.walletHistory.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(history);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/users/:id — публичный профиль пользователя
router.get('/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const lots = await prisma.lot.findMany({
      where: { userId: user.id },
      include: {
        images: true,
        category: true,
        bids: { orderBy: { currentPrice: 'desc' }, take: 1 },
        status: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      id: user.id,
      name: user.name,
      role: user.role.name,
      createdAt: user.createdAt,
      avatarUrl: user.avatarUrl,
      isBanned: user.isBanned,
      banReason: user.banReason,
      lots: lots.map((lot) => ({
        id: lot.id,
        name: lot.name,
        image: lot.images[0]?.imageUrl || null,
        currentPrice: lot.bids[0]?.currentPrice || lot.startPrice,
        category: lot.category.name,
        status: lot.status.name,
        endTime: lot.endTime,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT /api/users/me — обновление профиля
router.put('/me', authenticateToken, async (req, res) => {
  try {
    const { name, avatarUrl } = req.body;
    
    const updatedUser = await prisma.user.update({
      where: { id: req.user.userId },
      data: { name, avatarUrl }
    });

    res.json({ message: 'Профиль обновлен', user: updatedUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/users/me — удаление аккаунта
router.delete('/me', authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Введите пароль для подтверждения' });

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: 'Неверный пароль' });

    const lots = await prisma.lot.findMany({ where: { userId: user.id } });
    const lotIds = lots.map(l => l.id);

    await prisma.$transaction([
      prisma.transaction.deleteMany({ where: { userId: user.id } }),
      prisma.bid.deleteMany({ where: { userId: user.id } }),
      prisma.notification.deleteMany({ where: { userId: user.id } }),
      prisma.supportTicket.deleteMany({ where: { userId: user.id } }),
      prisma.walletHistory.deleteMany({ where: { userId: user.id } }),
      prisma.transaction.deleteMany({ where: { lotId: { in: lotIds } } }),
      prisma.bid.deleteMany({ where: { lotId: { in: lotIds } } }),
      prisma.lotImage.deleteMany({ where: { lotId: { in: lotIds } } }),
      prisma.lotFile.deleteMany({ where: { lotId: { in: lotIds } } }),
      prisma.lot.deleteMany({ where: { userId: user.id } }),
      prisma.user.delete({ where: { id: user.id } })
    ]);

    res.json({ message: 'Аккаунт успешно удален' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка при удалении аккаунта' });
  }
});

// PATCH /api/users/me/balance — пополнение баланса
router.patch('/me/balance', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Введите корректную сумму' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const newBalance = user.balance + parseFloat(amount);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { balance: newBalance }
    });

    await prisma.walletHistory.create({
      data: {
        userId: user.id,
        amount: parseFloat(amount),
        type: 'TOPUP',
        description: 'Пополнение баланса'
      }
    });

    res.json({ message: 'Баланс пополнен', balance: updatedUser.balance });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/users/:id/ban — забанить пользователя (ТОЛЬКО АДМИН)
router.post('/:id/ban', authenticateToken, async (req, res) => {
  try {
    // Проверяем, что запрос делает админ
    const admin = await prisma.user.findUnique({ 
      where: { id: req.user.userId }, 
      include: { role: true } 
    });
    
    if (admin.role.name !== 'Администратор') {
      return res.status(403).json({ error: 'У вас нет прав для этого действия' });
    }

    const targetId = parseInt(req.params.id);
    const { duration, reason } = req.body; // duration: '1_day' или 'permanent'

    if (targetId === admin.id) {
      return res.status(400).json({ error: 'Вы не можете забанить самого себя' });
    }

    const banUntil = duration === 'permanent' ? null : new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: targetId },
      data: { isBanned: true, banReason: reason || 'Нарушение правил площадки', banUntil }
    });

    // Отправляем уведомление пользователю
    await prisma.notification.create({
      data: {
        userId: targetId,
        title: 'Ваш аккаунт заблокирован',
        message: `Причина: ${reason || 'Нарушение правил площадки'}. ${duration === 'permanent' ? 'Блокировка навсегда.' : 'Блокировка на 1 день.'}`,
        type: 'SYSTEM'
      }
    });

    res.json({ message: 'Пользователь успешно заблокирован' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
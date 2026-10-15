import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';

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

    // Загружаем лоты этого пользователя
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
      role: user.role.name,
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

export default router;
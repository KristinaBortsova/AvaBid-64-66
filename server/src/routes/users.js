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
      avatarUrl: user.avatarUrl,
      role: user.role.name,
      receiveBroadcasts: user.receiveBroadcasts,
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

// PUT /api/users/me — обновление профиля (имя и аватар)
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

    // Проверяем пароль
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: 'Неверный пароль' });

    // Собираем ID лотов пользователя
    const lots = await prisma.lot.findMany({ where: { userId: user.id } });
    const lotIds = lots.map(l => l.id);

    // Удаляем всё связанное в транзакции (чтобы не было ошибок внешних ключей)
    await prisma.$transaction([
      prisma.transaction.deleteMany({ where: { userId: user.id } }),
      prisma.bid.deleteMany({ where: { userId: user.id } }),
      prisma.notification.deleteMany({ where: { userId: user.id } }),
      prisma.supportTicket.deleteMany({ where: { userId: user.id } }),
      
      // Удаляем ставки и транзакции на лоты пользователя
      prisma.transaction.deleteMany({ where: { lotId: { in: lotIds } } }),
      prisma.bid.deleteMany({ where: { lotId: { in: lotIds } } }),
      prisma.lotImage.deleteMany({ where: { lotId: { in: lotIds } } }),
      prisma.lotFile.deleteMany({ where: { lotId: { in: lotIds } } }),
      prisma.lot.deleteMany({ where: { userId: user.id } }),

      // Удаляем самого пользователя
      prisma.user.delete({ where: { id: user.id } })
    ]);

    res.json({ message: 'Аккаунт успешно удален' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка при удалении аккаунта' });
  }
});
export default router;
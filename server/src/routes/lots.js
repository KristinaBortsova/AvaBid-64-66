import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Хелпер: автоматически закрывать истекшие лоты
async function closeExpiredLots() {
  const now = new Date();
  const closedStatus = await prisma.statusLot.findUnique({ where: { name: 'Завершен' } });
  if (closedStatus) {
    await prisma.lot.updateMany({
      where: {
        endTime: { lt: now },
        status: { name: 'Активен' }
      },
      data: { statusId: closedStatus.id }
    });
  }
}

// GET /api/lots — все активные лоты
router.get('/', async (req, res) => {
  try {
    await closeExpiredLots();
    const { categoryId } = req.query;

    let whereCondition = { status: { name: 'Активен' } };
    if (categoryId) {
      whereCondition.categoryId = parseInt(categoryId);
    }

    const lots = await prisma.lot.findMany({
      where: whereCondition,
      include: {
        images: true,
        user: { select: { id: true, name: true, avatarUrl: true } }, // ДОБАВИЛИ avatarUrl
        category: true,
        bids: { orderBy: { currentPrice: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = lots.map((lot) => ({
      id: lot.id,
      name: lot.name,
      description: lot.description,
      startPrice: lot.startPrice,
      currentPrice: lot.bids[0]?.currentPrice || lot.startPrice,
      image: lot.images[0]?.imageUrl || null,
      category: lot.category.name,
      author: lot.user.name,
      authorId: lot.user.id,
      authorAvatar: lot.user.avatarUrl, // ДОБАВИЛИ avatarUrl
      endTime: lot.endTime,
    }));

    res.json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/lots/:id — детали одного лота
router.get('/:id', async (req, res) => {
  try {
    const lotId = parseInt(req.params.id);

    const lot = await prisma.lot.findUnique({
      where: { id: lotId },
      include: {
        images: true,
        user: { select: { id: true, name: true, avatarUrl: true } }, // ДОБАВИЛИ avatarUrl
        category: true,
        status: true,
        bids: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } }, // ДОБАВИЛИ avatarUrl
          orderBy: { currentPrice: 'desc' },
        },
      },
    });

    if (!lot) return res.status(404).json({ error: 'Лот не найден' });

    res.json({
      id: lot.id,
      name: lot.name,
      description: lot.description,
      startPrice: lot.startPrice,
      stepMin: lot.stepMin,
      currentPrice: lot.bids[0]?.currentPrice || lot.startPrice,
      image: lot.images[0]?.imageUrl || null,
      category: lot.category.name,
      author: lot.user.name,
      authorId: lot.user.id,
      authorAvatar: lot.user.avatarUrl, // ДОБАВИЛИ avatarUrl
      status: lot.status.name,
      endTime: lot.endTime,
      bids: lot.bids.map((b) => ({
        id: b.id,
        price: b.currentPrice,
        userName: b.user.name,
        userId: b.user.id,
        userAvatar: b.user.avatarUrl, // ДОБАВИЛИ avatarUrl
        createdAt: b.createdAt,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/lots — создать лот
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, startPrice, stepMin, categoryId, imageUrl, durationHours } = req.body;

    if (!name || !startPrice || !stepMin || !categoryId || !durationHours) {
      return res.status(400).json({ error: 'Заполните обязательные поля' });
    }

    const activeStatus = await prisma.statusLot.findUnique({ where: { name: 'Активен' } });
    const endTime = new Date();
    endTime.setHours(endTime.getHours() + parseInt(durationHours));

    const lot = await prisma.lot.create({
      data: {
        name,
        description,
        startPrice: parseFloat(startPrice),
        stepMin: parseFloat(stepMin),
        userId: req.user.userId,
        categoryId: parseInt(categoryId),
        statusId: activeStatus.id,
        endTime,
        images: imageUrl ? { create: [{ imageUrl }] } : undefined,
      },
      include: { images: true },
    });

    res.status(201).json({ message: 'Лот создан', lot });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT /api/lots/:id — редактировать лот (только автор)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const lotId = parseInt(req.params.id);
    const { name, description, categoryId } = req.body;

    const lot = await prisma.lot.findUnique({ where: { id: lotId } });
    if (!lot) return res.status(404).json({ error: 'Лот не найден' });

    if (lot.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Вы можете редактировать только свои лоты' });
    }

    const updatedLot = await prisma.lot.update({
      where: { id: lotId },
      data: {
        name,
        description,
        categoryId: parseInt(categoryId),
      },
    });

    res.json({ message: 'Лот обновлен', lot: updatedLot });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/lots/:id — удалить лот (только автор)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const lotId = parseInt(req.params.id);

    const lot = await prisma.lot.findUnique({ where: { id: lotId } });
    if (!lot) return res.status(404).json({ error: 'Лот не найден' });

    if (lot.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Вы можете удалять только свои лоты' });
    }

    await prisma.lotImage.deleteMany({ where: { lotId } });
    await prisma.bid.deleteMany({ where: { lotId } });
    await prisma.transaction.deleteMany({ where: { lotId } });
    await prisma.lot.delete({ where: { id: lotId } });

    res.json({ message: 'Лот удален' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/lots/:id/bids — сделать ставку
router.post('/:id/bids', authenticateToken, async (req, res) => {
  try {
    const lotId = parseInt(req.params.id);
    const { amount } = req.body;

    const lot = await prisma.lot.findUnique({
      where: { id: lotId },
      include: { bids: { orderBy: { currentPrice: 'desc' }, take: 1 } },
    });

    if (!lot) return res.status(404).json({ error: 'Лот не найден' });

    if (lot.endTime && new Date(lot.endTime) < new Date()) {
      return res.status(400).json({ error: 'Аукцион уже завершён' });
    }

    const currentPrice = lot.bids[0]?.currentPrice || lot.startPrice;
    const minBid = currentPrice + lot.stepMin;

    if (amount < minBid) {
      return res.status(400).json({ error: `Минимальная ставка — ${minBid} ₽` });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (user.balance < amount) {
      return res.status(400).json({ error: 'Недостаточно средств на балансе' });
    }

    const bid = await prisma.bid.create({
      data: { currentPrice: parseFloat(amount), lotId, userId: req.user.userId },
    });

    res.status(201).json({ message: 'Ставка принята', bid });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
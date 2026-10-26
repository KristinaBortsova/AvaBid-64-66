import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/lots — все активные лоты (для главной страницы)
router.get('/', async (req, res) => {
  try {
    const lots = await prisma.lot.findMany({
      where: { status: { name: 'Активен' } },
      include: {
        images: true,
        user: { select: { id: true, name: true } },
        category: true,
        bids: {
          orderBy: { currentPrice: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Форматируем ответ для фронтенда
    const formatted = lots.map((lot) => ({
      id: lot.id,
      name: lot.name,
      description: lot.description,
      startPrice: lot.startPrice,
      currentPrice: lot.bids[0]?.currentPrice || lot.startPrice,
      image: lot.images[0]?.imageUrl || null,
      category: lot.category.name,
      author: lot.user.name,
      endTime: lot.endTime, 
    }));

    res.json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/lots/:id — детали одного лота (для страницы lot.html)
router.get('/:id', async (req, res) => {
  try {
    const lotId = parseInt(req.params.id);

    const lot = await prisma.lot.findUnique({
      where: { id: lotId },
      include: {
        images: true,
        user: { select: { id: true, name: true } },
        category: true,
        status: true,
        bids: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { currentPrice: 'desc' },
        },
      },
    });

    if (!lot) {
      return res.status(404).json({ error: 'Лот не найден' });
    }

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
      status: lot.status.name,
      endTime: lot.endTime,  
      bids: lot.bids.map((b) => ({
        id: b.id,
        price: b.currentPrice,
        userName: b.user.name,
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

    if (!name || !startPrice || !stepMin || !categoryId) {
      return res.status(400).json({ error: 'Заполните обязательные поля' });
    }

    if (!durationHours || durationHours < 1) {
      return res.status(400).json({ error: 'Укажите длительность лота (минимум 1 час)' });
    }

    const activeStatus = await prisma.statusLot.findUnique({
      where: { name: 'Активен' },
    });

    // Считаем время окончания аукциона
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
        endTime,   // ← сохраняем время окончания
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

// POST /api/lots/:id/bids — сделать ставку
router.post('/:id/bids', authenticateToken, async (req, res) => {
  try {
    const lotId = parseInt(req.params.id);
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Введите корректную сумму ставки' });
    }

    const lot = await prisma.lot.findUnique({
      where: { id: lotId },
      include: {
        bids: { orderBy: { currentPrice: 'desc' }, take: 1 },
      },
    });

    if (!lot) {
      return res.status(404).json({ error: 'Лот не найден' });
    }

    // Проверяем, что аукцион ещё идёт
    if (lot.endTime && new Date(lot.endTime) < new Date()) {
      return res.status(400).json({ error: 'Аукцион уже завершён' });
    }

    const currentPrice = lot.bids[0]?.currentPrice || lot.startPrice;
    const minBid = currentPrice + lot.stepMin;

    if (amount < minBid) {
      return res.status(400).json({
        error: `Минимальная ставка — ${minBid} ₽`,
      });
    }

    // Проверяем баланс
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (user.balance < amount) {
      return res.status(400).json({ error: 'Недостаточно средств на балансе' });
    }

    const bid = await prisma.bid.create({
      data: {
        currentPrice: parseFloat(amount),
        lotId: lotId,
        userId: req.user.userId,
      },
    });

    res.status(201).json({ message: 'Ставка принята', bid });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
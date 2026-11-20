import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Закрывает истекшие лоты и один раз создаёт чат + уведомления участникам.
// Функция вызывается и при загрузке списка, и при открытии конкретного лота.
async function closeExpiredLots() {
  const now = new Date();
  const [activeStatus, closedStatus] = await Promise.all([
    prisma.statusLot.findUnique({ where: { name: 'Активен' } }),
    prisma.statusLot.findUnique({ where: { name: 'Завершен' } }),
  ]);

  if (!activeStatus || !closedStatus) {
    console.error('Не найдены статусы лотов «Активен» или «Завершен».');
    return;
  }

  // Включаем уже закрытые лоты тоже: старая версия могла успеть изменить статус,
  // но упасть до создания уведомлений. Это позволяет восстановить такие уведомления.
  const expiredLots = await prisma.lot.findMany({
    where: {
      endTime: { lt: now },
      status: { name: { in: ['Активен', 'Завершен'] } },
    },
    include: {
      status: true,
      bids: {
        orderBy: [
          { currentPrice: 'desc' },
          { createdAt: 'desc' },
        ],
        take: 1,
      },
    },
  });

  for (const lot of expiredLots) {
    try {
      await prisma.$transaction(async (tx) => {
        // Не даём двум параллельным запросам повторно обработать активный лот.
        if (lot.status.name === 'Активен') {
          const changed = await tx.lot.updateMany({
            where: {
              id: lot.id,
              statusId: activeStatus.id,
              endTime: { lt: now },
            },
            data: { statusId: closedStatus.id },
          });

          if (changed.count === 0) return;
        }

        const highestBid = lot.bids[0];
        if (!highestBid) return; // Лот без ставок просто закрывается.

        let chat = await tx.chat.findUnique({ where: { lotId: lot.id } });
        if (!chat) {
          chat = await tx.chat.create({
            data: {
              lotId: lot.id,
              buyerId: highestBid.userId,
              sellerId: lot.userId,
            },
          });
        }

        const winner = await tx.user.findUnique({
          where: { id: chat.buyerId },
          select: { id: true, name: true },
        });
        if (!winner) return;

        const chatUrl = `/pages/chat.html?id=${chat.id}`;
        const notifications = [
          {
            userId: winner.id,
            title: 'Вы выиграли аукцион!',
            message: `Лот «${lot.name}». <a href="${chatUrl}">Перейти в чат</a>, чтобы получить информацию от продавца.`,
            type: 'SYSTEM',
          },
          {
            userId: lot.userId,
            title: 'Ваш лот продан!',
            message: `Лот «${lot.name}» купил ${winner.name}. <a href="${chatUrl}">Перейти в чат</a>, чтобы связаться с покупателем.`,
            type: 'SYSTEM',
          },
        ];

        for (const notification of notifications) {
          // Проверяем по ссылке на чат, чтобы не создавать дубликаты при каждом запросе.
          const alreadySent = await tx.notification.findFirst({
            where: {
              userId: notification.userId,
              title: notification.title,
              type: notification.type,
              message: { contains: chatUrl },
            },
            select: { id: true },
          });

          if (!alreadySent) {
            await tx.notification.create({ data: notification });
          }
        }
      });
    } catch (error) {
      // Ошибка одного лота не должна ломать загрузку остальных страниц.
      console.error(`Не удалось обработать завершение лота #${lot.id}:`, error);
    }
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
        user: { select: { id: true, name: true, avatarUrl: true } },
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
      authorAvatar: lot.user.avatarUrl,
      endTime: lot.endTime,
    }));

    res.json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/lots/:id — детали одного лота + ПРОВЕРКА ОКОНЧАНИЯ АУКЦИОНА
router.get('/:id', async (req, res) => {
  try {
    const lotId = parseInt(req.params.id);

    // Сначала завершаем истекшие лоты. Не полагаемся на то, что пользователь
    // обязательно откроет именно страницу этого лота первым.
    await closeExpiredLots();

    const lot = await prisma.lot.findUnique({
      where: { id: lotId },
      include: {
        images: true,
        user: { select: { id: true, name: true, avatarUrl: true } },
        category: true,
        status: true,
        bids: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
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
      authorAvatar: lot.user.avatarUrl,
      status: lot.status.name,
      endTime: lot.endTime,
      bids: lot.bids.map((b) => ({
        id: b.id,
        price: b.currentPrice,
        userName: b.user.name,
        userId: b.user.id,
        userAvatar: b.user.avatarUrl,
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

// DELETE /api/lots/:id — удалить лот (автор или админ)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const lotId = parseInt(req.params.id);
    const { reason } = req.body;

    const lot = await prisma.lot.findUnique({ where: { id: lotId } });
    if (!lot) return res.status(404).json({ error: 'Лот не найден' });

    const currentUser = await prisma.user.findUnique({ where: { id: req.user.userId }, include: { role: true } });
    const isAdmin = currentUser.role.name === 'Администратор';

    if (lot.userId !== req.user.userId && !isAdmin) {
      return res.status(403).json({ error: 'Вы можете удалять только свои лоты' });
    }

    if (isAdmin && lot.userId !== req.user.userId) {
      await prisma.notification.create({
        data: {
          userId: lot.userId,
          title: 'Ваш лот удален модератором',
          message: `Лот "${lot.name}" был удален. Причина: ${reason || 'Нарушение правил площадки'}`,
          type: 'SYSTEM'
        }
      });
    }

    await prisma.lotImage.deleteMany({ where: { lotId } });
    await prisma.bid.deleteMany({ where: { lotId } });
    await prisma.transaction.deleteMany({ where: { lotId } });
    await prisma.chat.deleteMany({ where: { lotId } }); // Удаляем чат, если он есть
    await prisma.lot.delete({ where: { id: lotId } });

    res.json({ message: 'Лот удален' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/lots/:id/bids — сделать ставку (ЭСКРОУ)
router.post('/:id/bids', authenticateToken, async (req, res) => {
  try {
    const lotId = parseInt(req.params.id);
    const { amount } = req.body;
    const parsedAmount = parseFloat(amount);

    const lot = await prisma.lot.findUnique({
      where: { id: lotId },
      include: { bids: { orderBy: { currentPrice: 'desc' }, take: 1 } },
    });

    if (!lot) return res.status(404).json({ error: 'Лот не найден' });
    if (lot.endTime && new Date(lot.endTime) < new Date()) return res.status(400).json({ error: 'Аукцион завершён' });

    const currentPrice = lot.bids[0]?.currentPrice || lot.startPrice;
    const minBid = currentPrice + lot.stepMin;
    const previousBidderId = lot.bids[0]?.userId;

    if (parsedAmount < minBid) return res.status(400).json({ error: `Минимальная ставка — ${minBid} ₽` });

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    
    // Учитываем замороженные средства, если пользователь перебивает сам себя
    let availableFunds = user.balance;
    if (previousBidderId === user.id) {
      availableFunds += currentPrice; // Добавляем к доступным средствам его же предыдущую ставку
    }
    
    if (availableFunds < parsedAmount) return res.status(400).json({ error: 'Недостаточно средств' });

    // 1. Возвращаем деньги предыдущему лидеру (даже если это тот же самый человек)
    if (previousBidderId) {
      const isSelfOutbid = previousBidderId === user.id;
      
      await prisma.user.update({
        where: { id: previousBidderId },
        data: { balance: { increment: currentPrice } }
      });
      
      await prisma.walletHistory.create({
        data: {
          userId: previousBidderId,
          amount: currentPrice,
          type: 'REFUND',
          description: isSelfOutbid 
            ? `Возврат предыдущей ставки на лот "${lot.name}" (перебита своей же ставкой)`
            : `Возврат ставки на лот "${lot.name}" (вас перебили)`
        }
      });
    }

    // 2. Списываем деньги с нового лидера
    await prisma.user.update({
      where: { id: user.id },
      data: { balance: { decrement: parsedAmount } }
    });

    // 3. Создаем ставку и пишем в историю
    await prisma.bid.create({ data: { currentPrice: parsedAmount, lotId, userId: req.user.userId } });
    await prisma.walletHistory.create({
      data: {
        userId: user.id,
        amount: -parsedAmount,
        type: 'BID',
        description: `Ставка на лот "${lot.name}"`
      }
    });

    res.status(201).json({ message: 'Ставка принята' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});
export default router;
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/notifications — получить свои уведомления
router.get('/', authenticateToken, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT /api/notifications/read — пометить все как прочитанные
router.put('/read', authenticateToken, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.userId, isRead: false },
      data: { isRead: true }
    });
    res.json({ message: 'Уведомления прочитаны' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT /api/notifications/toggle-broadcasts — вкл/выкл рассылку
router.put('/toggle-broadcasts', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    
    const updatedUser = await prisma.user.update({
      where: { id: req.user.userId },
      data: { receiveBroadcasts: !user.receiveBroadcasts }
    });

    res.json({ receiveBroadcasts: updatedUser.receiveBroadcasts });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
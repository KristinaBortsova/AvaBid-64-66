import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const router = express.Router();
const prisma = new PrismaClient();
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.pdf', '.zip', '.rar', '.7z',
  '.txt', '.psd', '.clip', '.kra', '.blend', '.fbx', '.obj', '.stl', '.glb',
  '.gltf', '.mp4', '.mp3', '.wav', '.doc', '.docx', '.xls', '.xlsx'
]);

const routeDirectory = path.dirname(fileURLToPath(import.meta.url));
const uploadDirectory = path.resolve(
  process.env.UPLOAD_DIR || path.join(routeDirectory, '../../uploads')
);

function parseChatId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// НОВЫЙ ХЕЛПЕР: Проверяем, является ли юзер админом (через БД)
async function isUserAdmin(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true }
  });
  return user && user.role.name === 'Администратор';
}

// ОБНОВЛЕННЫЙ ХЕЛПЕР: Теперь пускает и админов
async function getChatForParticipant(chatId, userId) {
  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat) return { error: 'Чат не найден', status: 404 };
  
  const isAdmin = await isUserAdmin(userId);
  
  if (chat.buyerId !== userId && chat.sellerId !== userId && !isAdmin) {
    return { error: 'Нет доступа к этому чату', status: 403 };
  }
  return { chat, isAdmin };
}

function cleanOriginalFileName(value) {
  const raw = String(value || 'file').replace(/\\/g, '/');
  const base = path.basename(raw).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (base || 'file').slice(0, 180);
}

// Скачать файл (оставляем как есть)
router.get('/files/:filename', authenticateToken, async (req, res) => {
  try {
    const filename = String(req.params.filename || '');
    if (!/^[a-f0-9-]{36}\.[a-z0-9]{1,10}$/i.test(filename)) {
      return res.status(404).json({ error: 'Файл не найден' });
    }

    const fileUrl = `/api/chats/files/${filename}`;
    const message = await prisma.message.findFirst({
      where: { fileUrl },
      include: { chat: true }
    });

    if (!message) return res.status(404).json({ error: 'Файл не найден' });
    if (message.chat.buyerId !== req.user.userId && message.chat.sellerId !== req.user.userId) {
      return res.status(403).json({ error: 'Нет доступа к файлу' });
    }

    const diskPath = path.join(uploadDirectory, filename);
    try {
      await fs.access(diskPath);
    } catch {
      return res.status(404).json({ error: 'Файл больше не хранится на сервере' });
    }

    return res.download(diskPath, cleanOriginalFileName(message.text));
  } catch (error) {
    console.error('Ошибка скачивания файла чата:', error);
    return res.status(500).json({ error: 'Не удалось скачать файл' });
  }
});

// Получить чат и сообщения
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const chatId = parseChatId(req.params.id);
    if (!chatId) return res.status(400).json({ error: 'Некорректный ID чата' });

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        lot: true,
        buyer: { select: { id: true, name: true, avatarUrl: true } },
        seller: { select: { id: true, name: true, avatarUrl: true } },
        messages: {
          include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!chat) return res.status(404).json({ error: 'Чат не найден' });
    
    // Проверяем доступ через нашу новую функцию
    const isAdmin = await isUserAdmin(req.user.userId);
    if (chat.buyerId !== req.user.userId && chat.sellerId !== req.user.userId && !isAdmin) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    return res.json({ ...chat, isAdmin: isAdmin });
  } catch (error) {
    console.error('Ошибка загрузки чата:', error);
    return res.status(500).json({ error: 'Не удалось загрузить чат' });
  }
});

// Отправить текстовое сообщение
router.post('/:id/messages', authenticateToken, async (req, res) => {
  try {
    const chatId = parseChatId(req.params.id);
    if (!chatId) return res.status(400).json({ error: 'Некорректный ID чата' });

    const access = await getChatForParticipant(chatId, req.user.userId);
    if (access.error) return res.status(access.status).json({ error: access.error });
    const { chat, isAdmin } = access;

    if (chat.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Сделка уже завершена или отменена' });
    }

    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) return res.status(400).json({ error: 'Напишите сообщение перед отправкой' });
    if (text.length > 4000) return res.status(400).json({ error: 'Сообщение слишком длинное (максимум 4000 символов)' });

    const message = await prisma.message.create({
      data: { 
        chatId, 
        senderId: req.user.userId, 
        text,
        isAdmin: isAdmin
      }
    });
    return res.status(201).json(message);
  } catch (error) {
    console.error('Ошибка отправки сообщения:', error);
    return res.status(500).json({ error: 'Не удалось отправить сообщение' });
  }
});

// Реальная загрузка файла
router.post('/:id/files', authenticateToken, async (req, res) => {
  let savedPath = null;
  try {
    const chatId = parseChatId(req.params.id);
    if (!chatId) return res.status(400).json({ error: 'Некорректный ID чата' });

    const access = await getChatForParticipant(chatId, req.user.userId);
    if (access.error) return res.status(access.status).json({ error: access.error });
    const { chat, isAdmin } = access;

    if (chat.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Нельзя прикрепить файл: сделка уже закрыта' });
    }
    if (chat.sellerId !== req.user.userId && !isAdmin) {
      return res.status(403).json({ error: 'Прикреплять файлы в этой сделке может только продавец или админ' });
    }

    const originalName = cleanOriginalFileName(req.body?.fileName);
    const extension = path.extname(originalName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return res.status(415).json({ error: 'Этот тип файла не поддерживается' });
    }

    const fileData = typeof req.body?.fileData === 'string' ? req.body.fileData : '';
    const match = fileData.match(/^data:[^;,]+;base64,([A-Za-z0-9+/=\r\n]+)$/);
    if (!match) return res.status(400).json({ error: 'Не удалось прочитать выбранный файл' });

    const base64 = match[1].replace(/\s/g, '');
    const estimatedBytes = Math.floor((base64.length * 3) / 4);
    if (!base64 || estimatedBytes > MAX_FILE_BYTES) {
      return res.status(413).json({ error: 'Размер файла не должен превышать 8 МБ' });
    }

    const buffer = Buffer.from(base64, 'base64');
    if (!buffer.length || buffer.length > MAX_FILE_BYTES) {
      return res.status(413).json({ error: 'Размер файла не должен превышать 8 МБ' });
    }

    await fs.mkdir(uploadDirectory, { recursive: true });
    const filename = `${randomUUID()}${extension}`;
    savedPath = path.join(uploadDirectory, filename);
    await fs.writeFile(savedPath, buffer, { flag: 'wx', mode: 0o600 });

    const fileUrl = `/api/chats/files/${filename}`;
    const message = await prisma.message.create({
      data: { 
        chatId, 
        senderId: req.user.userId, 
        text: originalName, 
        fileUrl,
        isAdmin: isAdmin
      }
    });

    return res.status(201).json(message);
  } catch (error) {
    if (savedPath) await fs.unlink(savedPath).catch(() => {});
    console.error('Ошибка загрузки файла чата:', error);
    if (error?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Файл слишком большой. Максимум 8 МБ' });
    }
    return res.status(500).json({ error: 'Не удалось прикрепить файл' });
  }
});

// Подтвердить сделку (оставляем только для покупателя)
router.post('/:id/confirm', authenticateToken, async (req, res) => {
  try {
    const chatId = parseChatId(req.params.id);
    if (!chatId) return res.status(400).json({ error: 'Некорректный ID чата' });

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { lot: { include: { bids: { orderBy: { currentPrice: 'desc' }, take: 1 } } } }
    });
    if (!chat) return res.status(404).json({ error: 'Чат не найден' });
    if (chat.buyerId !== req.user.userId) return res.status(403).json({ error: 'Только покупатель может подтвердить сделку' });
    if (chat.status !== 'ACTIVE') return res.status(400).json({ error: 'Сделка уже завершена' });
    if (!chat.lot?.bids?.length) return res.status(400).json({ error: 'У сделки не найдена итоговая ставка' });

    const finalPrice = chat.lot.bids[0].currentPrice;
    await prisma.user.update({ where: { id: chat.sellerId }, data: { balance: { increment: finalPrice } } });
    await prisma.walletHistory.create({
      data: { userId: chat.sellerId, amount: finalPrice, type: 'SALE', description: `Продажа лота "${chat.lot.name}"` }
    });
    await prisma.chat.update({ where: { id: chat.id }, data: { status: 'COMPLETED' } });

    return res.json({ message: 'Сделка завершена, деньги переведены продавцу' });
  } catch (error) {
    console.error('Ошибка подтверждения сделки:', error);
    return res.status(500).json({ error: 'Не удалось подтвердить сделку' });
  }
});

// Отменить сделку (оставляем для покупателя/продавца)
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const chatId = parseChatId(req.params.id);
    if (!chatId) return res.status(400).json({ error: 'Некорректный ID чата' });

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { lot: { include: { bids: { orderBy: { currentPrice: 'desc' }, take: 1 } } } }
    });
    if (!chat) return res.status(404).json({ error: 'Чат не найден' });
    if (chat.buyerId !== req.user.userId && chat.sellerId !== req.user.userId) {
      return res.status(403).json({ error: 'Нет доступа к этой сделке' });
    }
    if (chat.status !== 'ACTIVE') return res.status(400).json({ error: 'Сделка уже неактивна' });
    if (!chat.lot?.bids?.length) return res.status(400).json({ error: 'У сделки не найдена итоговая ставка' });

    const finalPrice = chat.lot.bids[0].currentPrice;
    await prisma.user.update({ where: { id: chat.buyerId }, data: { balance: { increment: finalPrice } } });
    await prisma.walletHistory.create({
      data: { userId: chat.buyerId, amount: finalPrice, type: 'REFUND', description: `Возврат за отмененную сделку "${chat.lot.name}"` }
    });
    await prisma.chat.update({ where: { id: chat.id }, data: { status: 'CANCELLED' } });

    return res.json({ message: 'Сделка отменена, деньги возвращены покупателю' });
  } catch (error) {
    console.error('Ошибка отмены сделки:', error);
    return res.status(500).json({ error: 'Не удалось отменить сделку' });
  }
});

export default router;
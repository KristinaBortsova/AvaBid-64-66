import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Очищаем базу...');

  // Удаляем новые таблицы(СПОРЫ И ЧАТЫ)
  await prisma.ticket.deleteMany();       // Жалобы
  await prisma.message.deleteMany();      // Сообщения
  await prisma.chat.deleteMany();         // Чаты
  await prisma.walletHistory.deleteMany();

  await prisma.transaction.deleteMany();
  await prisma.bid.deleteMany();
  await prisma.lotImage.deleteMany();
  await prisma.lotFile.deleteMany();
  await prisma.lot.deleteMany();
  await prisma.statusTransaction.deleteMany();
  await prisma.statusLot.deleteMany();
  await prisma.category.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();

  console.log('База очищена');

  // 1. Роли
  const roleAdmin = await prisma.role.create({ data: { name: 'Администратор' } });
  const roleUser = await prisma.role.create({ data: { name: 'Пользователь' } });

  console.log('Роли созданы');

  // 2. Пользователи
  const password = await bcrypt.hash('123456', 10);

  const user1 = await prisma.user.create({
    data: {
      name: 'QUEXTY',
      email: 'kristinab0rts0va@yandex.ru',
      password,
      phone: '+79991112233',
      balance: 15000,
      roleId: roleAdmin.id,
    },
  });

  const user2 = await prisma.user.create({
    data: {
      name: 'BLYDE',
      email: 'blyde@mail.ru',
      password,
      phone: '+79994445566',
      balance: 10000,
      roleId: roleUser.id,
    },
  });

  const user3 = await prisma.user.create({
    data: {
      name: 'VIVA!',
      email: 'viva@bk.ru',
      password,
      phone: '+79997778899',
      balance: 5000,
      roleId: roleUser.id,
    },
  });

  const user4 = await prisma.user.create({
    data: {
      name: 'ARIMA',
      email: 'arima@art.com',
      password,
      phone: '+79993334455',
      balance: 25000,
      roleId: roleUser.id,
    },
  });

  console.log('Пользователи созданы');

  // 3. Категории (ИЕРАРХИЯ)
  const cat3D = await prisma.category.create({ data: { name: '3D-модели' } });
  const catArt = await prisma.category.create({ data: { name: 'Арты' } });
  const catGames = await prisma.category.create({ data: { name: 'Игры' } });

  const sub3DPeople = await prisma.category.create({ data: { name: 'Люди', parentId: cat3D.id } });
  const sub3DAnimals = await prisma.category.create({ data: { name: 'Животные', parentId: cat3D.id } });
  const sub3DFantasy = await prisma.category.create({ data: { name: 'Фэнтези', parentId: cat3D.id } });
  const sub3DFurry = await prisma.category.create({ data: { name: 'Фурри', parentId: cat3D.id } });
  const sub3DPony = await prisma.category.create({ data: { name: 'Пони', parentId: cat3D.id } });
  const sub3DFigures = await prisma.category.create({ data: { name: 'Фигурки', parentId: cat3D.id } });
  const sub3DHome = await prisma.category.create({ data: { name: 'Для дома', parentId: cat3D.id } });

  const subArtPeople = await prisma.category.create({ data: { name: 'Люди', parentId: catArt.id } });
  const subArtGif = await prisma.category.create({ data: { name: 'GIF', parentId: catArt.id } });
  const subArtAnimals = await prisma.category.create({ data: { name: 'Животные', parentId: catArt.id } });
  const subArtAdopts = await prisma.category.create({ data: { name: 'Адопты', parentId: catArt.id } });
  const subArtUSN = await prisma.category.create({ data: { name: 'УСН', parentId: catArt.id } });
  const subArtFantasy = await prisma.category.create({ data: { name: 'Фэнтези', parentId: catArt.id } });
  const subArtPacks = await prisma.category.create({ data: { name: 'Паки артов', parentId: catArt.id } });

  console.log('Категории и подкатегории созданы');

  // 4. Статусы
  const statusActive = await prisma.statusLot.create({ data: { name: 'Активен' } });
  await prisma.statusLot.create({ data: { name: 'Завершен' } });
  await prisma.statusLot.create({ data: { name: 'На модерации' } });

  await prisma.statusTransaction.create({ data: { name: 'Ожидание' } });
  await prisma.statusTransaction.create({ data: { name: 'Успешно' } });
  await prisma.statusTransaction.create({ data: { name: 'Спор' } });

  console.log('Статусы созданы');

  const hoursFromNow = (h) => {
    const d = new Date();
    d.setHours(d.getHours() + h);
    return d;
  };

  // 5. Лоты
  const SUPABASE_URL = 'https://utyklerfkkcbequrikil.supabase.co/storage/v1/object/public/avabid-images';

  const lot1 = await prisma.lot.create({
    data: {
      name: '3D MODEL',
      description: 'КАТЕГОРИИ: 3D-МОДЕЛИ, ЛЮДИ, ФЭНТЕЗИ',
      startPrice: 1000,
      stepMin: 100,
      userId: user4.id,
      categoryId: sub3DPeople.id,
      statusId: statusActive.id,
      endTime: hoursFromNow(80),
      images: { create: [{ imageUrl: `${SUPABASE_URL}/223cf41107f1863351ffe706bfc8ac99.jpg` }] },
    },
  });

  const lot2 = await prisma.lot.create({
    data: {
      name: 'Cat Lady',
      description: 'КАТЕГОРИИ: АРТЫ, ЖИВОТНЫЕ',
      startPrice: 1500,
      stepMin: 200,
      userId: user2.id,
      categoryId: subArtAnimals.id,
      statusId: statusActive.id,
      endTime: hoursFromNow(100),
      images: { create: [{ imageUrl: `${SUPABASE_URL}/59941ad13cf91bb20f62822fafe06f78.jpg` }] },
    },
  });

  const lot3 = await prisma.lot.create({
    data: {
      name: 'УСН! :3',
      description: 'КАТЕГОРИИ: АРТЫ, УСН',
      startPrice: 200,
      stepMin: 50,
      userId: user2.id,
      categoryId: subArtUSN.id,
      statusId: statusActive.id,
      endTime: hoursFromNow(90),
      images: { create: [{ imageUrl: `${SUPABASE_URL}/f999f3e782ad2ff89734c5cbe3eddc32.jpg` }] },
    },
  });

  const lot4 = await prisma.lot.create({
    data: {
      name: 'Valorant Skins',
      description: 'КАТЕГОРИИ: ИГРЫ, СКИНЫ',
      startPrice: 5000,
      stepMin: 500,
      userId: user4.id,
      categoryId: catGames.id,
      statusId: statusActive.id,
      endTime: hoursFromNow(120),
      images: { create: [{ imageUrl: `${SUPABASE_URL}/cb95736711d39c8f50072217b7349093.jpg` }] },
    },
  });

  const lot5 = await prisma.lot.create({
    data: {
      name: 'GOOFY SILLY SUN CAT GUY',
      description: 'КАТЕГОРИИ: АРТЫ, ФЭНТЕЗИ',
      startPrice: 1200,
      stepMin: 100,
      userId: user2.id,
      categoryId: subArtFantasy.id,
      statusId: statusActive.id,
      endTime: hoursFromNow(30),
      images: { create: [{ imageUrl: `${SUPABASE_URL}/383095f8ce18041ca027a364707ed127.jpg` }] },
    },
  });

  const lot6 = await prisma.lot.create({
    data: {
      name: 'Black-Blue Silly Creature',
      description: 'КАТЕГОРИИ: 3D-МОДЕЛИ, ЖИВОТНЫЕ',
      startPrice: 1500,
      stepMin: 100,
      userId: user4.id,
      categoryId: sub3DAnimals.id,
      statusId: statusActive.id,
      endTime: hoursFromNow(130),
      images: { create: [{ imageUrl: `${SUPABASE_URL}/f1d2a69c7983106c4f316b750b8ad99c.jpg` }] },
    },
  });

  console.log('6 лотов созданы');
}

main()
  .catch((e) => {
    console.error('Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
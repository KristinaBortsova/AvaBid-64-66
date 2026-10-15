import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Очищаем базу...');

  // Удаляем в правильном порядке (сначала зависимые таблицы)
  await prisma.transaction.deleteMany();
  await prisma.bid.deleteMany();
  await prisma.lotImage.deleteMany();
  await prisma.lotFile.deleteMany();
  await prisma.lot.deleteMany();
  await prisma.statusTransaction.deleteMany();
  await prisma.statusLot.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();

  console.log('База очищена');

  // 1. Роли
  const roleArtist = await prisma.role.create({ data: { name: 'Художник' } });
  const roleBuyer = await prisma.role.create({ data: { name: 'Покупатель' } });
  await prisma.role.create({ data: { name: 'Администратор' } });

  console.log('Роли созданы');

  // 2. Пользователи
  const password = await bcrypt.hash('123456', 10);

  const user1 = await prisma.user.create({
    data: {
      name: 'QUEXTY',
      email: 'kristinabortsova@yandex.ru',
      password,
      phone: '+79991112233',
      balance: 15000,
      roleId: roleArtist.id,
    },
  });

  const user2 = await prisma.user.create({
    data: {
      name: 'BLYDE',
      email: 'blyde@mail.ru',
      password,
      phone: '+79994445566',
      balance: 10000,
      roleId: roleBuyer.id,
    },
  });

  await prisma.user.create({
    data: {
      name: 'VIVA!',
      email: 'viva@bk.ru',
      password,
      phone: '+79997778899',
      balance: 5000,
      roleId: roleBuyer.id,
    },
  });

  const user4 = await prisma.user.create({
    data: {
      name: 'ARIMA',
      email: 'arima@art.com',
      password,
      phone: '+79993334455',
      balance: 25000,
      roleId: roleArtist.id,
    },
  });

  console.log('Пользователи созданы');

  // 3. Категории
  const cat3D = await prisma.category.create({ data: { name: '3D-модели' } });
  const catArt = await prisma.category.create({ data: { name: 'Арты' } });
  const catGames = await prisma.category.create({ data: { name: 'Игры' } });

  console.log('Категории созданы');

  // 4. Статусы лотов
  const statusActive = await prisma.statusLot.create({ data: { name: 'Активен' } });
  await prisma.statusLot.create({ data: { name: 'Завершен' } });
  await prisma.statusLot.create({ data: { name: 'На модерации' } });

  // 5. Статусы транзакций
  await prisma.statusTransaction.create({ data: { name: 'Ожидание' } });
  await prisma.statusTransaction.create({ data: { name: 'Успешно' } });
  await prisma.statusTransaction.create({ data: { name: 'Спор' } });

  console.log('Статусы созданы');

  // Хелпер: текущее время + N часов
  const hoursFromNow = (h) => {
    const d = new Date();
    d.setHours(d.getHours() + h);
    return d;
  };

  // 6. Лоты
  const SUPABASE_URL =
    'https://utyklerfkkcbequrikil.supabase.co/storage/v1/object/public/avabid-images';

  const lot1 = await prisma.lot.create({
    data: {
      name: '3D MODEL',
      description: 'КАТЕГОРИИ: 3D-МОДЕЛИ, ЛЮДИ, ФЭНТЕЗИ',
      startPrice: 1000,
      stepMin: 100,
      userId: user4.id,
      categoryId: cat3D.id,
      statusId: statusActive.id,
      endTime: hoursFromNow(80),
      images: {
        create: [{ imageUrl: `${SUPABASE_URL}/223cf41107f1863351ffe706bfc8ac99.jpg` }],
      },
    },
  });

  const lot2 = await prisma.lot.create({
    data: {
      name: 'Cat Lady',
      description: 'КАТЕГОРИИ: АРТЫ, ЖИВОТНЫЕ',
      startPrice: 1500,
      stepMin: 200,
      userId: user4.id,
      categoryId: catArt.id,
      statusId: statusActive.id,
      endTime: hoursFromNow(100),
      images: {
        create: [{ imageUrl: `${SUPABASE_URL}/59941ad13cf91bb20f62822fafe06f78.jpg` }],
      },
    },
  });

  const lot3 = await prisma.lot.create({
    data: {
      name: 'УСН! :3',
      description: 'КАТЕГОРИИ: АРТЫ, УСН',
      startPrice: 200,
      stepMin: 50,
      userId: user1.id,
      categoryId: catArt.id,
      statusId: statusActive.id,
      endTime: hoursFromNow(90),
      images: {
        create: [{ imageUrl: `${SUPABASE_URL}/f999f3e782ad2ff89734c5cbe3eddc32.jpg` }],
      },
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
      images: {
        create: [{ imageUrl: `${SUPABASE_URL}/cb95736711d39c8f50072217b7349093.jpg` }],
      },
    },
  });

  // НОВЫЙ ЛОТ: GOOFY SILLY SUN CAT GUY
  const lot5 = await prisma.lot.create({
    data: {
      name: 'GOOFY SILLY SUN CAT GUY',
      description: 'КАТЕГОРИИ: АРТЫ, ФЭНТЕЗИ',
      startPrice: 1200,
      stepMin: 100,
      userId: user1.id,
      categoryId: catArt.id,
      statusId: statusActive.id,
      endTime: hoursFromNow(30),
      images: {
        create: [{ imageUrl: `${SUPABASE_URL}/383095f8ce18041ca027a364707ed127.jpg` }],
      },
    },
  });

  // НОВЫЙ ЛОТ: Black-Blue Silly Creature
  const lot6 = await prisma.lot.create({
    data: {
      name: 'Black-Blue Silly Creature',
      description: 'КАТЕГОРИИ: 3D-МОДЕЛИ, ЖИВОТНЫЕ',
      startPrice: 1500,
      stepMin: 100,
      userId: user4.id,
      categoryId: cat3D.id,
      statusId: statusActive.id,
      endTime: hoursFromNow(130),
      images: {
        create: [{ imageUrl: `${SUPABASE_URL}/f1d2a69c7983106c4f316b750b8ad99c.jpg` }],
      },
    },
  });

  console.log('6 лотов созданы');

  // 7. Ставки — по одной на каждый лот, чтобы у всех был endTime
  const bids = [
    { lotId: lot1.id, userId: user2.id, price: 5850, hours: 8 }, // 3D MODEL — лидер BLYDE
    { lotId: lot2.id, userId: user2.id, price: 3200, hours: 12 }, // Cat Lady
    { lotId: lot3.id, userId: user2.id, price: 427, hours: 6 }, // УСН! :3
    { lotId: lot4.id, userId: user2.id, price: 9999, hours: 1 }, // Valorant Skins
    { lotId: lot5.id, userId: user2.id, price: 1709, hours: 2 }, // GOOFY SILLY SUN CAT GUY
    { lotId: lot6.id, userId: user2.id, price: 1500, hours: 4 }, // Black-Blue Silly Creature
  ];

  for (const b of bids) {
    await prisma.bid.create({
      data: {
        currentPrice: b.price,
        lotId: b.lotId,
        userId: b.userId,
        endTime: hoursFromNow(b.hours),
      },
    });
  }

  console.log('Ставки созданы');
}

main()
  .catch((e) => {
    console.error('Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
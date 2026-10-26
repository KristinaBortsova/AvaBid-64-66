FROM node:20-alpine

# Устанавливаем рабочую директорию внутри контейнера
WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Копируем Prisma-схему
COPY prisma ./prisma/

# Устанавливаем зависимости
RUN npm install --omit=dev

# Генерируем Prisma Client
RUN npx prisma generate

# Копируем весь остальной код
COPY . .

# Открываем порт
EXPOSE 3000

# Команда запуска при старте контейнера
CMD ["node", "src/index.js"]
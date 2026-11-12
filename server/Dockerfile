FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# Устанавливаем только продакшен-зависимости
RUN npm install --omit=dev

RUN npx prisma generate

COPY . .

EXPOSE 3000

# запуск (без nodemon)
CMD ["node", "src/index.js"]
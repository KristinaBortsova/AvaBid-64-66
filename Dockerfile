# Берем легкий образ Nginx
FROM nginx:alpine

# Копируем файлы сайта в папку, откуда Nginx раздает контент
# копируем всё, кроме того, что указано в .dockerignore
COPY . /usr/share/nginx/html/

# Открываем стандартный порт
EXPOSE 80

# Запускаем nginx
CMD ["nginx", "-g", "daemon off;"]
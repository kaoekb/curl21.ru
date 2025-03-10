# Используем официальный образ Node.js
FROM node:18

# Создаем рабочую директорию в контейнере
WORKDIR /usr/src/app

# Копируем package.json и package-lock.json в контейнер
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем все файлы проекта в контейнер
COPY . .

# Открываем порт, который будет использовать приложение
EXPOSE 3000

# Запускаем приложение
CMD [ "node", "index.js" ]

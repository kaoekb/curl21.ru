# Используем компактный официальный образ Node.js
FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node . .

ENV NODE_ENV=production \
    PARROT_PORT=3000

USER node

EXPOSE 3000

CMD ["npm", "start"]

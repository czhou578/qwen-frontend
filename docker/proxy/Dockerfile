FROM node:20-alpine

WORKDIR /app

COPY server/package.json ./
RUN npm install --omit=dev

COPY server/index.js ./

EXPOSE 3001

CMD ["node", "index.js"]
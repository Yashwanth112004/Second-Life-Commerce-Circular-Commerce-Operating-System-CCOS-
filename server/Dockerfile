FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 4000

# Migrate on boot then start (idempotent). For controlled rollouts run `npm run migrate` separately.
CMD ["node", "src/server.js"]

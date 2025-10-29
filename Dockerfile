# Dockerfile for local-agent-ts-v5
FROM node:20-bullseye-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

RUN npm run build

CMD ["node", "dist/cli.js"]

# Stage 1: Build the Vite application
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Serve with Node.js Express server
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm install -g tsx

COPY --from=builder /app/dist ./dist
COPY server.ts ./

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

CMD ["tsx", "server.ts"]

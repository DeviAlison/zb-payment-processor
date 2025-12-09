# Build Stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Run Stage
FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

# Limite de Heap do Node (Importante: Menor que o limite do container)
ENV NODE_OPTIONS="--max-old-space-size=80"

EXPOSE 3000
CMD ["node", "dist/index.js"]
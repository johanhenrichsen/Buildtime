# Build stage — repo root is build context so file:../../packages/shared-types resolves
FROM node:20-alpine AS builder
WORKDIR /workspace

COPY packages/shared-types ./packages/shared-types
COPY services/api ./services/api

# Build the shared-types workspace package first so its dist/ (types + js) exists
WORKDIR /workspace/packages/shared-types
RUN npm install --ignore-scripts
RUN npm run build

WORKDIR /workspace/services/api
RUN npm ci --ignore-scripts
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app

COPY --from=builder /workspace/services/api/node_modules ./node_modules
COPY --from=builder /workspace/services/api/dist ./dist
COPY --from=builder /workspace/services/api/prisma ./prisma

ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh", "-c", "node dist/migrate && node dist/main"]

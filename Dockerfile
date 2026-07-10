# Build stage — repo root is build context so file:../../packages/shared-types resolves
FROM node:20-alpine AS builder
WORKDIR /workspace

COPY packages/shared-types ./packages/shared-types
COPY services/api ./services/api

WORKDIR /workspace/services/api
RUN npm ci --ignore-scripts
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /workspace/services/api/node_modules ./node_modules
COPY --from=builder /workspace/services/api/dist ./dist
COPY --from=builder /workspace/services/api/prisma ./prisma

ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh", "-c", "node dist/migrate && node dist/main"]

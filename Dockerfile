# Multi-stage Dockerfile for FDR-Sentinel (AICTE Regulation Bureau)
FROM node:24-alpine AS builder

WORKDIR /app

# Copy root and package manifests
COPY package.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies
RUN npm --prefix server install
RUN npm --prefix client install

# Copy source files
COPY server/ ./server/
COPY client/ ./client/

# Build client (Vite bundle output directly to server/public) and server TypeScript
RUN npm --prefix client run build
RUN npm --prefix server run build

# Production runtime stage
FROM node:24-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

# Copy runtime files
COPY --from=builder /app/package.json ./
COPY --from=builder /app/server/package*.json ./server/
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/public ./server/public
COPY --from=builder /app/server/node_modules ./server/node_modules

# Create upload and database directories
RUN mkdir -p /app/uploads /app/data
ENV UPLOAD_DIR=/app/uploads
ENV DB_PATH=/app/data/fdr_sentinel.db

EXPOSE 5000

# Start server
CMD ["node", "server/dist/server.js"]

# Multi-stage build for production
FROM node:20-alpine AS base

# Install necessary build tools
RUN apk add --no-cache python3 make g++ bash

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies temporarily).
# Use `npm install --legacy-peer-deps` instead of `npm ci` so builds succeed
# when package.json changes but package-lock.json isn't regenerated in CI.
RUN npm install --legacy-peer-deps --no-audit --no-fund

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy source files with proper ownership
COPY --chown=nodejs:nodejs . .

# Create necessary directories
RUN mkdir -p /app/uploads /app/models /app/src/config /app/src/services && \
    chown -R nodejs:nodejs /app

# Keep source files as-is. The repo's `/src/config/database.js` will be copied
# with the `COPY . .` step above, so don't overwrite it here.

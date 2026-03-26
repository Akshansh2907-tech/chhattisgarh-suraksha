# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage with nginx
FROM nginx:alpine
WORKDIR /usr/share/nginx/html

# Install wget for healthcheck
RUN apk add --no-cache wget

# Remove default nginx content
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets (Vite outDir is configured as "build" in vite.config.js)
# Use /app/build instead of /app/dist so the COPY matches the actual build output.
COPY --from=build /app/build .

# Copy nginx configs
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY websocket.conf /etc/nginx/conf.d/websocket.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

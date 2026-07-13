# ---- Builder stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for layer caching
COPY package*.json ./
COPY vite.config.js ./
COPY index.html ./
RUN npm ci

# Copy source
COPY src/ ./src/

# Build the React app
RUN npm run build

# ---- Runtime stage ----
FROM nginx:alpine

# Remove default nginx site
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config (proxying to the proxy-server container)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
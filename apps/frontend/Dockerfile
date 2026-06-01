FROM node:22-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY tsconfig.json ./

# Copy workspace packages
COPY packages ./packages
COPY apps/frontend ./apps/frontend

# Install dependencies
RUN npm install

# Build arg baked into the Vite bundle
ARG VITE_API_URL=http://localhost:3333
ENV VITE_API_URL=$VITE_API_URL

# Build frontend
RUN npm run build -w apps/frontend

# Production stage
FROM nginx:alpine

# Copy nginx config
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built app
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html

EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"]

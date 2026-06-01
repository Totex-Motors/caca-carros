FROM mcr.microsoft.com/playwright:v1.60.0-jammy

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY tsconfig.json ./

# Copy workspace packages
COPY packages ./packages
COPY apps/backend ./apps/backend

# Install dependencies for all workspaces
RUN npm install

# Generate Prisma client
RUN npm run db:generate -w apps/backend

# Build backend
RUN npm run build -w apps/backend

EXPOSE 3333

# Run migrations then start server
CMD ["sh", "-c", "npx prisma migrate deploy --schema apps/backend/src/infra/database/prisma/schema.prisma && npm run db:seed -w apps/backend && npm start -w apps/backend"]

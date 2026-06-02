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

# Optionally run database setup before starting the server
CMD ["sh", "-c", "if [ \"${RUN_PRISMA_MIGRATE:-false}\" = \"true\" ]; then npx prisma migrate deploy --schema apps/backend/src/infra/database/prisma/schema.prisma; fi && if [ \"${RUN_DB_SEED:-false}\" = \"true\" ]; then npm run db:seed -w apps/backend; fi && npm start -w apps/backend"]

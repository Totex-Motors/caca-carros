FROM node:22-alpine

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

CMD ["npm", "start", "-w", "apps/backend"]

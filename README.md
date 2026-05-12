# Caça Carros (Webmotors)

Monorepo com **backend** (Node.js + TypeScript + Express + Prisma/PostgreSQL) e **frontend** (React + Vite) para cadastrar carros desejados e buscar anuncios via Apify (Webmotors scraper).

## Requisitos

- Node.js 20+
- PostgreSQL (local ou Docker)

## Como rodar (dev)

1) Instale dependências:

```bash
npm install
```

2) Configure variáveis de ambiente:

- Backend: copie `apps/backend/.env.example` para `apps/backend/.env`
- Frontend: copie `apps/frontend/.env.example` para `apps/frontend/.env`

Observacoes:

- Para a busca externa funcionar, configure `APIFY_TOKEN` no backend.
- O job de busca roda por padrao a cada 6 horas (`CAR_SEARCH_CRON`), mas voce pode trocar por um cron a cada X minutos (ex.: `*/10 * * * *`).

3) Suba o PostgreSQL (Docker):

```bash
docker compose up -d --wait
```

4) Rode migrations + seed:

```bash
npm run db:migrate -w apps/backend -- --name init
npm run db:seed -w apps/backend
```

5) Suba backend + frontend:

```bash
npm run dev
```

Frontend: `http://localhost:5173`
Backend: `http://localhost:3333`

## Endpoints principais

- `POST /auth/login`
- `POST /cars/wanted`
- `POST /cars/search-external`
- `GET /cars/wanted`
- `GET /cars/wanted/:id/cars`

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

## Esqueci minha senha / nao consigo entrar

O login padrao criado pelo seed e `admin@caca.local` / `admin123` (ou o valor de `ADMIN_EMAIL` / `ADMIN_PASSWORD` no `.env`).

Para redefinir a senha de um usuario (ou cria-lo, se nao existir), rode apontando para o banco correto (`DATABASE_URL`):

```bash
npm run user:reset-password -w apps/backend -- admin@caca.local NovaSenha123
```

## Consulta com IA (AutoExpert)

O app tem duas abas:

- **Consulta** (`/consulta`): digite "Marca Modelo Ano" para o dossiê técnico (motor, câmbio, comando, defeitos
  crônicos com custo, plano de 20.000 km, FIPE e IPVA por UF) ou cole o link de um anúncio / o texto + fotos para a
  IA vistoriar: preço x FIPE, km x desgaste nas fotos, divergências, estrutura e sinais de golpe.
- **Completo** (`/`): cadastro de carros desejados com busca automática. Cada carro tem **Ver dossiê** e cada anúncio
  encontrado tem **Analisar**.

Configuração (backend): `OPENAI_API_KEY` (obrigatória), `OPENAI_MODEL` (padrão `gpt-5.5`), `OPENAI_REASONING_EFFORT`
(padrão `medium`). Na VPS, grave a chave sem exibi-la com `bash /opt/caca-carros/deploy/set-openai-key.sh`.

Portais como OLX, Webmotors e Mercado Livre costumam bloquear a leitura automática do link; nesse caso a tela pede o
texto e as fotos do anúncio (a análise é a mesma).

## Endpoints principais

- `POST /auth/login`
- `POST /cars/wanted`
- `POST /cars/search-external`
- `GET /cars/wanted`
- `GET /cars/wanted/:id/cars`
- `POST /dossie` · `POST /dossie/analise` · `GET /dossie/wanted/:id`

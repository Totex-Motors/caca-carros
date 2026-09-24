import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

import { authRoutes } from './modules/auth/routes/auth.routes';
import { carsRoutes } from './modules/cars/routes/search-car.routes';
import { dossieRoutes } from './modules/dossie/dossie.routes';
import { startCarCleanupJob, startCarSearchJob } from './infra/jobs/car-search.job';

dotenv.config();

const app = express();

const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
app.use(
  cors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// /dossie/analise recebe fotos e usa um limite proprio (ver dossie.routes.ts).
const jsonParser = express.json({ limit: '1mb' });
app.use((req, res, next) => (req.path === '/dossie/analise' ? next() : jsonParser(req, res, next)));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/auth', authRoutes);
app.use('/cars', carsRoutes);
app.use('/dossie', dossieRoutes);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[backend] unhandled error', err);
  return res.status(500).json({ message: 'Internal server error' });
});

startCarSearchJob();
startCarCleanupJob();

const port = Number(process.env.PORT ?? 3333);
app.listen(port, () => {
  console.log(`[backend] listening on http://localhost:${port}`);
});

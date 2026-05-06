import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

import { authRoutes } from './modules/auth/routes/auth.routes';
import { carsRoutes } from './modules/cars/routes/cars.routes';
import { startCarCleanupJob, startCarSearchJob } from './infra/jobs/car-search.job';

dotenv.config();

const app = express();

const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
app.use(
  cors({
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

app.use(express.json({ limit: '1mb' }));

app.use('/auth', authRoutes);
app.use('/cars', carsRoutes);

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

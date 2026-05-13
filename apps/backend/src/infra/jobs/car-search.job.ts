import cron from 'node-cron';
import type { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma/client';
import { mapExternalCarToCreateInput } from '../../core/cars/mappers/external-car.mapper';
import { SearchCarService } from '../../core/cars/services/search-car.service';

function isExternalSearchEnabled(): boolean {
  const flag = process.env.EXTERNAL_SEARCH_ENABLED ?? 'false';
  return flag.toLowerCase() === 'true';
}

export function startCarSearchJob() {
  if (!isExternalSearchEnabled()) {
    console.log('[car-search.job] external search disabled');
    return;
  }

  const expression = process.env.CAR_SEARCH_CRON ?? '0 */6 * * *';
  if (!cron.validate(expression)) {
    throw new Error(`Invalid CAR_SEARCH_CRON: ${expression}`);
  }

  const service = new SearchCarService();

  cron.schedule(
    expression,
    async () => {
      try {
        const pending = await prisma.wantedCar.findMany({
          where: { status: 'PENDING' },
          select: {
            id: true,
            brand: true,
            model: true,
            version: true,
            condition: true,
            yearFrom: true,
            yearTo: true,
            mileageFrom: true,
            mileageTo: true,
            maxPrice: true
          }
        });

        for (const wanted of pending) {
          const results = await service.execute({
            brand: wanted.brand,
            model: wanted.model,
            version: wanted.version ?? null,
            condition: (wanted as { condition: 'NEW' | 'USED' | null }).condition,
            yearFrom: wanted.yearFrom,
            yearTo: wanted.yearTo,
            mileageFrom: wanted.mileageFrom,
            mileageTo: wanted.mileageTo,
            maxPrice: wanted.maxPrice,
            city: null,
            state: null
          });

          if (results.length === 0) continue;

          await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            await tx.car.createMany({
              data: results.map((car) => mapExternalCarToCreateInput(car, wanted)),
              skipDuplicates: true
            });

            await tx.wantedCar.update({ where: { id: wanted.id }, data: { status: 'FOUND' } });
          });
        }
      } catch (err) {
        console.error('[car-search.job] failed', err);
      }
    },
    {
      timezone: 'America/Sao_Paulo'
    }
  );
}

export function startCarCleanupJob() {
  const expression = process.env.CAR_CLEANUP_CRON ?? '0 3 * * *';
  if (!cron.validate(expression)) {
    throw new Error(`Invalid CAR_CLEANUP_CRON: ${expression}`);
  }

  const retentionDays = Number(process.env.CAR_RETENTION_DAYS ?? 30);
  const safeRetentionDays = Number.isFinite(retentionDays) && retentionDays > 0 ? retentionDays : 30;

  cron.schedule(
    expression,
    async () => {
      try {
        const threshold = new Date(Date.now() - safeRetentionDays * 24 * 60 * 60 * 1000);

        await prisma.car.updateMany({
          where: {
            deletedAt: null,
            createdAt: { lt: threshold }
          },
          data: {
            deletedAt: new Date()
          }
        });
      } catch (err) {
        console.error('[car-cleanup.job] failed', err);
      }
    },
    {
      timezone: 'America/Sao_Paulo'
    }
  );
}

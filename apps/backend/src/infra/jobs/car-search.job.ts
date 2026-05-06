import cron from 'node-cron';
import type { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma/client';
import { SearchExternalCarsService } from '../../core/cars/services/search-external-cars.service';

export function startCarSearchJob() {
  const expression = process.env.CAR_SEARCH_CRON ?? '0 */6 * * *';
  if (!cron.validate(expression)) {
    throw new Error(`Invalid CAR_SEARCH_CRON: ${expression}`);
  }

  const service = new SearchExternalCarsService();

  cron.schedule(
    expression,
    async () => {
      try {
        const pending = await prisma.wantedCar.findMany({ where: { status: 'PENDING' } });

        for (const wanted of pending) {
          const results = await service.execute({
            brand: wanted.brand,
            model: wanted.model,
            yearFrom: wanted.yearFrom,
            yearTo: wanted.yearTo,
            mileageFrom: wanted.mileageFrom,
            mileageTo: wanted.mileageTo,
            maxPrice: wanted.maxPrice
          });

          if (results.length === 0) continue;

          await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            await tx.car.createMany({
              data: results.map((car) => ({
                brand: car.brand,
                model: car.model,
                year: car.year,
                price: car.price,
                mileage: car.mileage ?? undefined,
                fuel: car.fuel ?? undefined,
                url: car.url,
                image: car.image ?? undefined,
                wantedCarId: wanted.id
              })),
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

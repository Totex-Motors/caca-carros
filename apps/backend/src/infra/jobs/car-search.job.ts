import cron from 'node-cron';
import parser from 'cron-parser';
import type { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma/client';
import { mapExternalCarToCreateInput } from '../../core/cars/mappers/external-car.mapper';
import type { ExternalCar } from '../../core/cars/interfaces/car';
import { SearchCarService } from '../../core/cars/services/search-car.service';
import { SearchMercadoLivreService } from '../../core/cars/services/search-mercadolivre.service';
import { SearchOlxService } from '../../core/cars/services/search-olx.service';

function isExternalSearchEnabled(): boolean {
  const flag = process.env.EXTERNAL_SEARCH_ENABLED ?? 'false';
  return flag.toLowerCase() === 'true';
}

const searchingWantedIds = new Set<string>();

export function isWantedCarSearching(id: string): boolean {
  return searchingWantedIds.has(id);
}

const DEFAULT_SEARCH_CRON = '0 */12 * * *';
const TEST_SEARCH_CRON = '*/8 * * * *'; // every 8 minutes
const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

function getCarSearchCronExpression(): string {
  const mode = (process.env.CAR_SEARCH_MODE ?? 'OFFICIAL').toUpperCase();

  if (mode === 'TEST') return TEST_SEARCH_CRON;
  return DEFAULT_SEARCH_CRON;
}

function getCarSearchTimezone(): string {
  return process.env.CAR_SEARCH_TIMEZONE ?? DEFAULT_TIMEZONE;
}

export type CarSearchSchedule = {
  enabled: boolean;
  cron: string;
  timezone: string;
  nextRunAt: string | null;
};

export function getCarSearchSchedule(): CarSearchSchedule {
  const cronExpression = getCarSearchCronExpression();
  const timezone = getCarSearchTimezone();
  const enabled = isExternalSearchEnabled();

  let nextRunAt: string | null = null;
  if (cron.validate(cronExpression)) {
    try {
      const interval = parser.parseExpression(cronExpression, { tz: timezone });
      const next = interval.next();
      // cron-parser returns an object with toDate()
      const nextDate = next.toDate();
      nextRunAt = nextDate.toISOString();
    } catch (err) {
      nextRunAt = null;
    }
  }

  return {
    enabled,
    cron: cronExpression,
    timezone,
    nextRunAt
  };
}

function dedupeResults(results: ExternalCar[]): ExternalCar[] {
  const seen = new Set<string>();
  const output: ExternalCar[] = [];
  for (const item of results) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    output.push(item);
  }
  return output;
}

export function startCarSearchJob() {
  if (!isExternalSearchEnabled()) {
    console.log('[car-search.job] external search disabled');
    return;
  }

  const expression = getCarSearchCronExpression();
  if (!cron.validate(expression)) {
    throw new Error(`Invalid CAR_SEARCH_CRON: ${expression}`);
  }

  const service = new SearchCarService();
  const mercadoLivreService = new SearchMercadoLivreService();
  const olxService = new SearchOlxService();

  async function searchAndSave(
    wanted: Parameters<typeof mapExternalCarToCreateInput>[1],
    portalName: string,
    searchFn: () => Promise<ExternalCar[]>
  ): Promise<void> {
    try {
      const raw = await searchFn();
      const unique = dedupeResults(raw);
      if (unique.length === 0) {
        console.info(`[car-search.job] ${portalName} no results`, { wantedCarId: wanted.id });
        return;
      }
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.car.createMany({
          data: unique.map((car) => mapExternalCarToCreateInput(car, wanted, portalName)),
          skipDuplicates: true
        });
        await tx.wantedCar.update({ where: { id: wanted.id }, data: { status: 'FOUND' } });
      });
      console.info(`[car-search.job] ${portalName} saved`, { wantedCarId: wanted.id, count: unique.length });
    } catch (err) {
      console.error(`[car-search.job] ${portalName} failed`, err);
    }
  }

  cron.schedule(
    expression,
    async () => {
      try {
        const pending = await prisma.wantedCar.findMany({
          where: { status: 'PENDING' }
        });

        for (const wanted of pending) {
          const params = {
            brand: wanted.brand,
            model: wanted.model,
            version: wanted.version ?? null,
            condition: (wanted as { condition: 'NEW' | 'USED' | null }).condition,
            sellerType: (wanted as { sellerType?: 'PRIVATE' | 'PROFESSIONAL' | null }).sellerType ?? null,
            yearFrom: wanted.yearFrom,
            yearTo: wanted.yearTo,
            mileageFrom: wanted.mileageFrom,
            mileageTo: wanted.mileageTo,
            maxPrice: wanted.maxPrice,
            city: null,
            state: null
          };

          searchingWantedIds.add(wanted.id);
          try {
            await Promise.all([
              searchAndSave(wanted, 'webmotors', () => service.execute(params)),
              searchAndSave(wanted, 'mercadolivre', () => mercadoLivreService.execute(params)),
              searchAndSave(wanted, 'olx', () => olxService.execute(params))
            ]);
          } finally {
            searchingWantedIds.delete(wanted.id);
          }
        }
      } catch (err) {
        console.error('[car-search.job] failed', err);
      }
    },
    {
      timezone: getCarSearchTimezone()
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

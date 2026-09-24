import cron from 'node-cron';
import parser from 'cron-parser';
import type { Prisma, WantedCar } from '@prisma/client';
import { prisma } from '../database/prisma/client';
import { mapExternalCarToCreateInput } from '../../core/cars/mappers/external-car.mapper';
import type { ExternalCar } from '../../core/cars/interfaces/car';
import { SearchCarService } from '../../core/cars/services/search-car.service';
import { canonicalBrandName } from '../../core/cars/utils/brand-name';
import { SearchMercadoLivreService } from '../../core/cars/services/search-mercadolivre.service';
import { SearchOlxService } from '../../core/cars/services/search-olx.service';
import { isScraperActorConfigured, runScraperActor, type ScraperResult } from '../providers/caca-scraper/caca-scraper.provider';

function isExternalSearchEnabled(): boolean {
  const flag = process.env.EXTERNAL_SEARCH_ENABLED ?? 'false';
  return flag.toLowerCase() === 'true';
}

const searchingWantedIds = new Set<string>();

export function isWantedCarSearching(id: string): boolean {
  return searchingWantedIds.has(id);
}

const DEFAULT_SEARCH_CRON = '0 */12 * * *';
const TEST_SEARCH_CRON = '*/11 * * * *'; // every 11 minutes
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

let services: {
  webmotors: SearchCarService;
  mercadoLivre: SearchMercadoLivreService;
  olx: SearchOlxService;
} | null = null;

function getServices() {
  services ??= {
    webmotors: new SearchCarService(),
    mercadoLivre: new SearchMercadoLivreService(),
    olx: new SearchOlxService()
  };
  return services;
}

type PortalStatus = { status: 'ok' | 'vazio' | 'erro' | 'bloqueado' | 'nao_configurado'; count?: number; mensagem?: string };
export type LastSearch = { finishedAt: string; portais: Record<string, PortalStatus> };

// Resultado da ultima busca de cada carro, para o site mostrar por que nada apareceu (fica so em memoria).
const lastSearchByWanted = new Map<string, LastSearch>();

export function getLastSearch(wantedId: string): LastSearch | null {
  return lastSearchByWanted.get(wantedId) ?? null;
}

// Erros de configuracao conhecidos dos provedores (sem chave/proxy): viram uma mensagem clara no site.
function describeError(err: unknown): PortalStatus {
  const message = err instanceof Error ? err.message : String(err);
  if (/APIFY_TOKEN is required|sao obrigatorios|PROXY_(HOST|USER|PASS|PORT)/.test(message)) {
    const falta = message.includes('APIFY') ? 'a Apify (APIFY_TOKEN e APIFY_SCRAPER_ACTOR_ID)' : 'proxy (PROXY_HOST/USER/PASS/PORT)';
    return { status: 'nao_configurado', mensagem: `Falta configurar ${falta} no servidor.` };
  }
  // Nunca expoe usuario/senha do proxy que alguns erros trazem na URL.
  return { status: 'erro', mensagem: message.replace(/\/\/[^@\s]+@/g, '//***@').slice(0, 160) };
}

async function searchAndSave(
  wanted: WantedCar,
  portalName: string,
  searchFn: () => Promise<ExternalCar[]>
): Promise<PortalStatus> {
  try {
    const raw = await searchFn();
    const unique = dedupeResults(raw);
    if (unique.length === 0) {
      console.info(`[car-search.job] ${portalName} no results`, { wantedCarId: wanted.id });
      return { status: 'vazio', count: 0 };
    }
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.car.createMany({
        data: unique.map((car) => mapExternalCarToCreateInput(car, wanted, portalName)),
        skipDuplicates: true
      });
      await tx.wantedCar.update({ where: { id: wanted.id }, data: { status: 'FOUND' } });
    });
    console.info(`[car-search.job] ${portalName} saved`, { wantedCarId: wanted.id, count: unique.length });
    return { status: 'ok', count: unique.length };
  } catch (err) {
    console.error(`[car-search.job] ${portalName} failed`, err);
    return describeError(err);
  }
}

/**
 * Busca um carro desejado em todos os portais e salva os resultados.
 * Ignora a chamada se esse carro ja estiver sendo buscado.
 */
export async function searchWantedCar(wanted: WantedCar): Promise<void> {
  if (searchingWantedIds.has(wanted.id)) return;

  const { webmotors, mercadoLivre, olx } = getServices();
  const params = {
    brand: canonicalBrandName(wanted.brand),
    model: wanted.model,
    version: wanted.version ?? null,
    condition: wanted.condition,
    sellerType: wanted.sellerType ?? null,
    yearFrom: wanted.yearFrom,
    yearTo: wanted.yearTo,
    mileageFrom: wanted.mileageFrom,
    mileageTo: wanted.mileageTo,
    maxPrice: wanted.maxPrice,
    city: wanted.city ?? null,
    state: wanted.state ?? null
  };

  searchingWantedIds.add(wanted.id);
  try {
    if (isScraperActorConfigured()) {
      await searchWithActor(wanted, params);
      return;
    }
    const [webmotorsStatus, mercadoLivreStatus, olxStatus] = await Promise.all([
      searchAndSave(wanted, 'webmotors', () => webmotors.execute(params)),
      searchAndSave(wanted, 'mercadolivre', () => mercadoLivre.execute(params)),
      searchAndSave(wanted, 'olx', () => olx.execute(params))
    ]);
    lastSearchByWanted.set(wanted.id, {
      finishedAt: new Date().toISOString(),
      portais: { Webmotors: webmotorsStatus, 'Mercado Livre': mercadoLivreStatus, OLX: olxStatus }
    });
  } finally {
    searchingWantedIds.delete(wanted.id);
  }
}

const PORTAL_NAMES = { webmotors: 'Webmotors', mercadolivre: 'Mercado Livre', olx: 'OLX' } as const;

/** Uma execucao do Actor proprio da Apify busca os tres portais; cada portal e salvo e reportado separadamente. */
async function searchWithActor(wanted: WantedCar, params: Parameters<typeof runScraperActor>[0]): Promise<void> {
  let result: ScraperResult;
  try {
    result = await runScraperActor(params);
  } catch (err) {
    const status = describeError(err);
    lastSearchByWanted.set(wanted.id, {
      finishedAt: new Date().toISOString(),
      portais: { Webmotors: status, 'Mercado Livre': status, OLX: status }
    });
    console.error('[car-search.job] apify actor failed', { wantedCarId: wanted.id, err });
    return;
  }

  const portais: Record<string, PortalStatus> = {};
  for (const portal of ['webmotors', 'mercadolivre', 'olx'] as const) {
    const report = result.reports[portal];
    if (result.cars[portal].length === 0 && report.status === 'bloqueado') {
      portais[PORTAL_NAMES[portal]] = { status: 'bloqueado', mensagem: 'O portal bloqueou a busca nesta rodada; será tentado de novo na próxima.' };
      continue;
    }
    if (result.cars[portal].length === 0 && report.status === 'erro') {
      portais[PORTAL_NAMES[portal]] = { status: 'erro', mensagem: (report.error ?? 'falha na leitura').slice(0, 160) };
      continue;
    }
    portais[PORTAL_NAMES[portal]] = await searchAndSave(wanted, portal, async () => result.cars[portal]);
  }
  lastSearchByWanted.set(wanted.id, { finishedAt: new Date().toISOString(), portais });
}

/**
 * Dispara a primeira busca de um carro recem-cadastrado em segundo plano,
 * sem esperar a proxima rodada do cron. Nao faz nada se a busca externa estiver desativada.
 */
export function startImmediateSearch(wanted: WantedCar): void {
  if (!isExternalSearchEnabled()) return;
  searchWantedCar(wanted).catch((err) => {
    console.error('[car-search.job] immediate search failed', { wantedCarId: wanted.id, err });
  });
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

  cron.schedule(
    expression,
    async () => {
      try {
        const pending = await prisma.wantedCar.findMany({
          where: { status: 'PENDING' }
        });

        for (const wanted of pending) {
          await searchWantedCar(wanted);
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

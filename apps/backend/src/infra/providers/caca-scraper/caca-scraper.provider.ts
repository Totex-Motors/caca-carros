import type { ExternalCar } from '../../../core/cars/interfaces/car';
import type { SearchCarParams } from '../../../core/cars/interfaces/search-car';
import { normalizeSearchText, parseOlxVehicleParts } from '../olx/olx-model-parser';

// Actor proprio da Apify (repositorio Totex-Motors/caca-carros-scraper): busca Webmotors, OLX e Mercado Livre numa
// unica execucao, com proxy residencial BR, e devolve tudo no formato ExternalCar. Substitui o ribtools e o proxy Decodo.

export type ScraperPortal = 'webmotors' | 'olx' | 'mercadolivre';
export const SCRAPER_PORTALS: ScraperPortal[] = ['webmotors', 'olx', 'mercadolivre'];

export type ScraperPortalReport = {
  status: 'ok' | 'vazio' | 'bloqueado' | 'erro';
  count: number;
  error: string | null;
};

export type ScraperResult = {
  reports: Record<ScraperPortal, ScraperPortalReport>;
  cars: Record<ScraperPortal, ExternalCar[]>;
};

type ActorItem = ExternalCar & { portal?: string };
type ActorOutput = {
  portals?: Record<string, { status?: string; count?: number; error?: string | null }>;
  items?: ActorItem[];
};
type RunInfo = { id: string; status: string; defaultKeyValueStoreId: string; statusMessage?: string };

// APIFY_API_BASE so existe para testes com servidor local.
const apiBase = () => process.env.APIFY_API_BASE ?? 'https://api.apify.com/v2';
const FINAL_STATUSES = new Set(['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT']);
const MAX_WAIT_MS = 7 * 60 * 1000;
// Palavras de versao que nao ajudam a achar o carro no titulo do anuncio.
const VERSION_NOISE = new Set(['FLEX', 'GASOLINA', 'DIESEL', 'ETANOL', 'AUT', 'AUTOMATICO', 'AUTOMATICA', 'MANUAL', 'TURBO', 'CVT', 'MEC']);

export function isScraperActorConfigured(): boolean {
  return Boolean(process.env.APIFY_TOKEN?.trim() && process.env.APIFY_SCRAPER_ACTOR_ID?.trim());
}

function actorPath(): string {
  // A API aceita "usuario~nome"; o Console mostra "usuario/nome".
  return encodeURIComponent((process.env.APIFY_SCRAPER_ACTOR_ID ?? '').trim().replace('/', '~'));
}

async function apify<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.APIFY_TOKEN?.trim()}`, 'Content-Type': 'application/json', ...init.headers },
    signal: AbortSignal.timeout(90_000)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 401) throw new Error('APIFY_TOKEN invalido (a Apify recusou o token).');
    if (res.status === 404) throw new Error(`Actor "${process.env.APIFY_SCRAPER_ACTOR_ID}" nao encontrado na Apify (APIFY_SCRAPER_ACTOR_ID).`);
    throw new Error(`Apify respondeu HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Palavras distintivas da versao (ex.: "2.0 16V FLEX LONGITUDE AUT." -> "LONGITUDE"), para filtrar pelo titulo. */
function distinctiveVersion(version: string | null): string | null {
  if (!version) return null;
  const tokens = normalizeSearchText(version)
    .split(' ')
    .filter((t) => t.length >= 3 && /^[A-Z]+$/.test(t) && !VERSION_NOISE.has(t));
  return tokens.length > 0 ? tokens.join(' ') : null;
}

export function buildScraperInput(params: SearchCarParams, portals: ScraperPortal[] = SCRAPER_PORTALS) {
  // Nome curto sem numeros ("Dolphin Mini", "T-Cross", "Compass") vai inteiro: o separador de versao trataria
  // "Mini" como versao. So nomes longos da FIPE ("COMPASS LONGITUDE 2.0 4x2 Flex") passam pela separacao.
  const rawModel = params.model.trim();
  const isSimpleModel = !/\d/.test(rawModel) && rawModel.split(/\s+/).length <= 3;
  const parts = isSimpleModel
    ? { model: rawModel, version: params.version }
    : parseOlxVehicleParts({ brand: params.brand, model: params.model, version: params.version });
  const maxPrice = Number.isFinite(params.maxPrice) && params.maxPrice > 0 && params.maxPrice < 2147483647 ? Math.trunc(params.maxPrice) : undefined;
  return {
    brand: params.brand,
    model: parts.model || params.model,
    version: distinctiveVersion(parts.version) ?? undefined,
    yearFrom: params.yearFrom > 1900 ? params.yearFrom : undefined,
    yearTo: params.yearTo && params.yearTo > 1900 ? params.yearTo : undefined,
    state: params.state ?? 'SP',
    city: params.city ?? undefined,
    sellerType: params.sellerType ?? 'ANY',
    condition: params.condition ?? 'ANY',
    maxPrice,
    mileageTo: params.mileageTo && params.mileageTo > 0 ? params.mileageTo : undefined,
    portals,
    maxResultsPerPortal: Math.max(1, Math.min(200, Number(process.env.APIFY_SCRAPER_MAX_RESULTS ?? 30) || 30)),
    maxPagesPerPortal: Math.max(1, Math.min(10, Number(process.env.APIFY_SCRAPER_MAX_PAGES ?? 2) || 2))
  };
}

function toExternalCar(item: ActorItem, fallbackYear: number): ExternalCar {
  return {
    title: item.title,
    price: Math.trunc(item.price),
    year: Math.trunc(item.year ?? fallbackYear),
    km: item.km ?? null,
    fuel_type: item.fuel_type ?? null,
    transmission: item.transmission ?? null,
    city: item.city ?? null,
    state: item.state ?? null,
    photos: Array.isArray(item.photos) ? item.photos : [],
    url: item.url
  };
}

export async function runScraperActor(params: SearchCarParams, portals: ScraperPortal[] = SCRAPER_PORTALS): Promise<ScraperResult> {
  if (!isScraperActorConfigured()) throw new Error('APIFY_TOKEN e APIFY_SCRAPER_ACTOR_ID sao obrigatorios');

  const input = buildScraperInput(params, portals);
  console.info('[caca-scraper] iniciando', { model: input.model, version: input.version, anos: [input.yearFrom, input.yearTo], uf: input.state });

  const memory = Number(process.env.APIFY_SCRAPER_MEMORY_MB ?? 2048) || 2048;
  let run = (await apify<{ data: RunInfo }>(`/acts/${actorPath()}/runs?memory=${memory}&timeout=360&waitForFinish=60`, {
    method: 'POST',
    body: JSON.stringify(input)
  })).data;

  const deadline = Date.now() + MAX_WAIT_MS;
  while (!FINAL_STATUSES.has(run.status) && Date.now() < deadline) {
    run = (await apify<{ data: RunInfo }>(`/actor-runs/${run.id}?waitForFinish=60`)).data;
  }
  if (!FINAL_STATUSES.has(run.status)) throw new Error(`A busca na Apify passou de ${MAX_WAIT_MS / 60000} minutos (run ${run.id}).`);
  if (run.status !== 'SUCCEEDED') throw new Error(`A busca na Apify terminou com ${run.status}${run.statusMessage ? `: ${run.statusMessage}` : ''} (run ${run.id}).`);

  const output = await apify<ActorOutput>(`/key-value-stores/${run.defaultKeyValueStoreId}/records/OUTPUT`);
  const cars: Record<ScraperPortal, ExternalCar[]> = { webmotors: [], olx: [], mercadolivre: [] };
  for (const item of output.items ?? []) {
    const portal = item.portal as ScraperPortal;
    if (!SCRAPER_PORTALS.includes(portal) || !item.url || !item.title || !(item.price > 0)) continue;
    cars[portal].push(toExternalCar(item, params.yearFrom));
  }

  const reports = {} as Record<ScraperPortal, ScraperPortalReport>;
  for (const portal of SCRAPER_PORTALS) {
    const r = output.portals?.[portal];
    const status = r?.status === 'ok' || r?.status === 'bloqueado' || r?.status === 'erro' ? r.status : 'vazio';
    reports[portal] = { status: cars[portal].length > 0 ? 'ok' : status, count: cars[portal].length, error: r?.error ?? null };
  }
  console.info('[caca-scraper] concluido', Object.fromEntries(SCRAPER_PORTALS.map((p) => [p, `${reports[p].status}:${reports[p].count}`])));
  return { reports, cars };
}

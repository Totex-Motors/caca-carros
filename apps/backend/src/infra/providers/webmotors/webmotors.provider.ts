import type { ExternalCar } from '../../../core/cars/interfaces/car';
import type { SearchCarParams } from '../../../core/cars/interfaces/search-car';
import { normalizeVehicleVersion } from '../../../core/cars/utils/vehicle-model-parser';
import { buildWebmotorsSearchUrl } from './webmotors-url-builder';

type WebmotorsItem = Record<string, unknown> & {
  url?: unknown;
  from_url?: unknown;
  link?: unknown;
  title?: unknown;
  price?: unknown;
  model_year?: unknown;
  fabrication_year?: unknown;
  year?: unknown;
  km?: unknown;
  mileage?: unknown;
  odometer?: unknown;
  fuel_type?: unknown;
  fuel?: unknown;
  transmission?: unknown;
  city?: unknown;
  state?: unknown;
  location?: unknown;
  seller?: unknown;
  photos?: unknown;
  media?: unknown;
  prices?: unknown;
  specification?: unknown;
};

const APIFY_ACTOR_ID = 'ribtools/webmotors-scraper';
const MAX_REQUESTS = 10;
const VERSION_FILTER_WORDS = new Set([
  '(elétrico)',
  '(hibrido)',
  'turbo',
  'flex',
  'gasolina',
  'diesel',
  'etanol',
  'hibrido',
  'hibrida',
  'hybrid',
  'eletrico',
  'eletrica',
  'electric',
  'phev',
  'hev',
  'ev',
  'plugin',
  'plug',
  'aut',
  'automatico',
  'automatica'
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (isRecord(value) && 'value' in value) {
    return readString(value.value);
  }

  return null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9,-]/g, '').replace(',', '.');
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (isRecord(value) && 'value' in value) {
    return readNumber(value.value);
  }

  return null;
}

function extractYear(value: unknown): number | null {
  const normalized = readNumber(value);
  if (normalized === null) return null;
  return Math.trunc(normalized);
}

function normalizeUrl(value: unknown): string | null {
  const normalized = readString(value);
  if (!normalized) return null;
  return normalized.startsWith('http') ? normalized : normalized;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normalizeComparableVersion(value: string | null): string {
  if (!value) return '';

  const normalized = normalizeVehicleVersion(value) ?? value;
  return normalizeSearchText(normalized)
    .split(' ')
    .filter((token) => token.length > 0 && !VERSION_FILTER_WORDS.has(token.toLowerCase()))
    .join(' ')
    .trim();
}

function extractVersionTokens(version: string | null): string[] {
  const normalized = normalizeComparableVersion(version);
  if (!normalized) return [];

  return normalized.split(' ').filter(Boolean);
}

function matchesVersion(title: string, versionTokens: string[]): boolean {
  if (versionTokens.length === 0) return true;
  const normalizedTitle = ` ${normalizeComparableVersion(title)} `;
  return versionTokens.every((token) => normalizedTitle.includes(` ${token} `));
}

function normalizePhotos(item: WebmotorsItem): string[] {
  const photos: string[] = [];

  const rawPhotos = item.photos;
  if (Array.isArray(rawPhotos)) {
    for (const entry of rawPhotos) {
      const candidate = readString(entry) ?? (isRecord(entry) ? readString(entry.url) ?? readString(entry.photo_path) : null);
      if (candidate && candidate.startsWith('http')) {
        photos.push(candidate);
      }
    }
  }

  if (photos.length === 0 && isRecord(item.media) && Array.isArray(item.media.photos)) {
    for (const entry of item.media.photos) {
      if (!isRecord(entry)) continue;
      const candidate = readString(entry.photo_path) ?? readString(entry.url);
      if (candidate && candidate.startsWith('http')) {
        photos.push(candidate);
      }
    }
  }

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const photo of photos) {
    if (seen.has(photo)) continue;
    seen.add(photo);
    deduped.push(photo);
  }

  return deduped;
}

function normalizeLocation(item: WebmotorsItem): { city: string | null; state: string | null } {
  const location = isRecord(item.location) ? item.location : null;
  const seller = isRecord(item.seller) ? item.seller : null;

  const city = readString(item.city) ?? readString(location?.city) ?? readString(seller?.city);
  const state = readString(item.state) ?? readString(location?.state) ?? readString(seller?.state);

  return { city, state };
}

function buildActorInput(params: SearchCarParams) {
  return {
    maxRequests: MAX_REQUESTS,
    proxyConfig: {
      useApifyProxy: true,
      apifyProxyGroups: [],
      apifyProxyCountry: 'US'
    },
    sellerDataAddon: false,
    startUrls: [
      {
        url: buildWebmotorsSearchUrl(params)
      }
    ]
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeItem(item: WebmotorsItem, params: SearchCarParams): ExternalCar | null {
  const url = normalizeUrl(item.url) ?? normalizeUrl(item.link) ?? normalizeUrl(item.from_url);
  if (!url) return null;

  const prices = isRecord(item.prices) ? item.prices : null;
  const specification = isRecord(item.specification) ? item.specification : null;

  const price = readNumber(prices?.price ?? prices?.search_price ?? item.price);
  if (price === null) return null;

  const title =
    readString(specification?.title ?? item.title) ??
    `${params.brand} ${params.model}`.trim();

  const year =
    extractYear(item.model_year ?? specification?.year_model) ??
    extractYear(item.fabrication_year ?? specification?.year_fabrication) ??
    extractYear(item.year) ??
    params.yearFrom;

  const km = readNumber(item.km ?? item.mileage ?? item.odometer ?? specification?.odometer);

  const fuelType = readString(item.fuel_type ?? item.fuel ?? specification?.fuel_type);
  const transmission = readString(item.transmission ?? specification?.transmission);

  const { city, state } = normalizeLocation(item);
  const photos = normalizePhotos(item);

  return {
    title,
    price: Math.trunc(price),
    year: Math.trunc(year),
    km: km === null ? null : Math.trunc(km),
    fuel_type: fuelType,
    transmission,
    city,
    state,
    photos,
    url
  };
}

function ensureActorId(): string {
  const configured = process.env.APIFY_ACTOR_ID;
  if (configured && configured !== APIFY_ACTOR_ID) {
    throw new Error(`APIFY_ACTOR_ID must be ${APIFY_ACTOR_ID}`);
  }
  return APIFY_ACTOR_ID;
}

export class WebmotorsProvider {
  async search(params: SearchCarParams): Promise<ExternalCar[]> {
    const token = process.env.APIFY_TOKEN;
    if (!token) throw new Error('APIFY_TOKEN is required');

    const actorId = ensureActorId();
    const timeoutMs = Number(process.env.APIFY_TIMEOUT_MS ?? 40000);
    const url = `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;

    console.info('[webmotors.provider] requesting webmotors search', {
      brand: params.brand,
      model: params.model,
      yearFrom: params.yearFrom,
      yearTo: params.yearTo
    });

    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(buildActorInput(params))
      },
      Number.isFinite(timeoutMs) ? timeoutMs : 40000
    );

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Apify request failed (${response.status}): ${text}`);
    }

    const items = (await response.json()) as unknown;
    if (!Array.isArray(items)) return [];

    const output: ExternalCar[] = [];
    const seen = new Set<string>();
    const versionTokens = extractVersionTokens(params.version ?? null);

    for (const item of items as WebmotorsItem[]) {
      const normalized = normalizeItem(item, params);
      if (!normalized) continue;
      if (!matchesVersion(normalized.title, versionTokens)) continue;
      if (seen.has(normalized.url)) continue;
      seen.add(normalized.url);
      output.push(normalized);
      if (output.length >= MAX_REQUESTS) break;
    }

    console.info('[webmotors.provider] normalized results', {
      count: output.length
    });

    return output;
  }
}

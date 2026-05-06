import type { ExternalCar } from '../../../core/cars/interfaces/car';

type SearchParams = {
  brand: string;
  model: string;
  yearFrom: number;
  yearTo: number | null;
  maxPrice: number;
  mileageFrom: number | null;
  mileageTo: number | null;
};

type WebmotorsItem = Record<string, unknown> & {
  from_url?: unknown;
  url?: unknown;
  link?: unknown;
  title?: unknown;
  price?: unknown;
  mileage?: unknown;
  fuel?: unknown;
  photo_path?: unknown;
  specification?: unknown;
  media?: unknown;
  prices?: unknown;
};

type OlxItem = {
  url?: unknown;
  title?: unknown;
  price?: unknown;
  brand?: unknown;
  model?: unknown;
  year?: unknown;
  mileage?: unknown;
  fuel?: unknown;
  photos?: unknown;
};

function clampAdsLimit(value: number): number {
  if (Number.isNaN(value)) return 10;
  return Math.min(50, Math.max(5, value));
}

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

function extractUrl(value: unknown): string | null {
  const normalized = readString(value);
  if (!normalized) return null;
  return normalized.startsWith('http') ? normalized : normalized;
}

function extractPhotoUrl(item: WebmotorsItem): string | null {
  const direct = extractUrl(item.photo_path);
  if (direct && direct.startsWith('http')) return direct;

  const media = item.media;
  if (isRecord(media) && Array.isArray(media.photos)) {
    for (const photo of media.photos) {
      if (isRecord(photo)) {
        const candidate = extractUrl(photo.photo_path) ?? extractUrl(photo.url);
        if (candidate && candidate.startsWith('http')) return candidate;
      }
    }
  }

  return null;
}

function parseTitleParts(title: string): { brand: string; model: string } {
  const cleaned = title.replace(/\s+/g, ' ').trim();
  const [brand, ...rest] = cleaned.split(' ');
  return {
    brand: brand ?? cleaned,
    model: rest.join(' ') || cleaned
  };
}

function buildWebmotorsSearchUrl(params: SearchParams): string {
  const url = new URL('https://www.webmotors.com.br/carros-usados/estoque');
  url.searchParams.set('lkid', '1001');
  url.searchParams.set('tipoveiculo', 'carros-usados');

  const brand = params.brand.trim();
  const model = params.model.trim();
  const yearTo = params.yearTo ?? params.yearFrom;

  if (brand) url.searchParams.set('marca', brand);
  if (model) url.searchParams.set('modelo', model);
  url.searchParams.set('anode', String(params.yearFrom));
  url.searchParams.set('anoate', String(yearTo));
  url.searchParams.set('precoate', String(params.maxPrice));

  return url.toString();
}

function buildWebmotorsSearchUrls(params: SearchParams): string[] {
  const baseUrl = new URL(buildWebmotorsSearchUrl(params));
  const maxPages = Number(process.env.WEBMOTORS_MAX_PAGES ?? 5);
  const safeMaxPages = Number.isFinite(maxPages) ? Math.min(10, Math.max(1, Math.trunc(maxPages))) : 5;

  const urls: string[] = [];
  for (let page = 1; page <= safeMaxPages; page += 1) {
    const url = new URL(baseUrl.toString());
    url.searchParams.set('page', String(page));
    urls.push(url.toString());
  }

  return urls;
}

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timeout);
  });
}

function buildWebmotorsActorInput(params: SearchParams) {
  const crawlLimit = Number(process.env.WEBMOTORS_MAX_ITEMS_PER_URL ?? 20);
  const safeCrawlLimit = Number.isFinite(crawlLimit) ? Math.min(50, Math.max(20, Math.trunc(crawlLimit))) : 20;

  return {
    proxy: {
      useApifyProxy: true,
      apifyProxyCountry: 'BR'
    },
    max_items_per_url: safeCrawlLimit,
    ignore_url_failures: true,
    urls: buildWebmotorsSearchUrls(params)
  };
}

function buildOlxActorInput(params: SearchParams) {
  const state = process.env.OLX_STATE ?? 'sp';
  const adsLimit = clampAdsLimit(Number(process.env.OLX_ADS_LIMIT ?? 10));
  const yearTo = params.yearTo ?? params.yearFrom;

  const body: Record<string, unknown> = {
    state,
    brand: params.brand,
    year_from: params.yearFrom,
    year_to: yearTo,
    pe: params.maxPrice,
    search: `${params.brand} ${params.model}`.trim(),
    ads_limit: adsLimit
  };

  if (params.mileageFrom !== null && params.mileageTo !== null) {
    body.mileage_from = params.mileageFrom;
    body.mileage_to = params.mileageTo;
  }

  return body;
}

function isWebmotorsActor(actorId: string): boolean {
  const normalized = actorId.toLowerCase();
  return normalized.includes('webmotors');
}

export class OlxProvider {
  async search(params: SearchParams): Promise<ExternalCar[]> {
    const token = process.env.APIFY_TOKEN;
    if (!token) throw new Error('APIFY_TOKEN is required');

    const actorId = process.env.APIFY_ACTOR_ID ?? 'stealth_mode/webmotors-auto-search-scraper';
    const timeoutMs = Number(process.env.APIFY_TIMEOUT_MS ?? 40000);
    const url = `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;

    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(isWebmotorsActor(actorId) ? buildWebmotorsActorInput(params) : buildOlxActorInput(params))
      },
      Number.isFinite(timeoutMs) ? timeoutMs : 40000
    );

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Apify request failed (${response.status}): ${text}`);
    }

    const items = (await response.json()) as unknown;
    if (!Array.isArray(items)) return [];

    if (isWebmotorsActor(actorId)) {
      return this.normalizeWebmotorsItems(items as WebmotorsItem[], params);
    }

    return this.normalizeOlxItems(items as OlxItem[], params);
  }

  private normalizeWebmotorsItems(items: WebmotorsItem[], params: SearchParams): ExternalCar[] {
    const desiredBrand = params.brand.trim().toLowerCase();
    const desiredModel = params.model.trim().toLowerCase();
    const yearTo = params.yearTo ?? params.yearFrom;
    const output: ExternalCar[] = [];

    for (const item of items) {
      const rawUrl = extractUrl(item.url) ?? extractUrl(item.link) ?? extractUrl(item.from_url);
      if (!rawUrl) continue;

      const specification = isRecord(item.specification) ? item.specification : null;
      const prices = isRecord(item.prices) ? item.prices : null;

      const title = readString(specification?.title ?? item.title) ?? '';
      const fromTitle = title ? parseTitleParts(title) : null;

      const brand = readString(specification?.make ?? item.make) ?? fromTitle?.brand ?? '';
      const model = readString(specification?.model ?? item.model) ?? fromTitle?.model ?? '';
      const year =
        extractYear(specification?.year_model) ??
        extractYear(specification?.year_fabrication) ??
        extractYear(item.year) ??
        params.yearFrom;
      const price = readNumber(prices?.price ?? prices?.search_price ?? item.price);
      if (!brand || !model || price === null) continue;

      if (desiredBrand && !brand.toLowerCase().includes(desiredBrand)) continue;
      if (desiredModel && !model.toLowerCase().includes(desiredModel)) continue;
      if (year < params.yearFrom || year > yearTo) continue;
      if (price > params.maxPrice) continue;

      const mileage =
        readNumber(specification?.odometer ?? item.odometer) ??
        readNumber(item.mileage);

      if (params.mileageFrom !== null && params.mileageTo !== null) {
        if (mileage === null) continue;
        if (mileage < params.mileageFrom || mileage > params.mileageTo) continue;
      }

      const fuel = readString(specification?.fuel_type ?? item.fuel) ?? readString(item.fuel);
      const image = extractPhotoUrl(item);

      output.push({
        url: rawUrl,
        brand,
        model,
        year,
        price: Math.trunc(price),
        mileage,
        fuel,
        image
      });
    }

    return output.slice(0, clampAdsLimit(Number(process.env.OLX_ADS_LIMIT ?? 10)));
  }

  private normalizeOlxItems(items: OlxItem[], params: SearchParams): ExternalCar[] {
    const yearTo = params.yearTo ?? params.yearFrom;
    const desiredBrand = params.brand.trim().toLowerCase();
    const desiredModel = params.model.trim().toLowerCase();
    const output: ExternalCar[] = [];

    for (const item of items) {
      const urlValue = readString(item.url);
      const brandValue = readString(item.brand);
      const modelValue = readString(item.model);

      if (!urlValue || !brandValue || !modelValue) continue;

      const year = extractYear(item.year) ?? params.yearFrom;
      const price = readNumber(item.price);
      if (price === null) continue;

      const mileage = readNumber(item.mileage);
      const fuel = readString(item.fuel);

      if (desiredBrand && !brandValue.toLowerCase().includes(desiredBrand)) continue;
      if (desiredModel && !modelValue.toLowerCase().includes(desiredModel)) continue;
      if (year < params.yearFrom || year > yearTo) continue;
      if (price > params.maxPrice) continue;

      if (params.mileageFrom !== null && params.mileageTo !== null) {
        if (mileage === null) continue;
        if (mileage < params.mileageFrom || mileage > params.mileageTo) continue;
      }

      let image: string | null = null;
      const photos = item.photos;
      if (Array.isArray(photos) && photos.length > 0) {
        const first = photos[0];
        if (typeof first === 'string' && first.startsWith('http')) {
          image = first;
        }
      }

      output.push({
        url: urlValue,
        brand: brandValue,
        model: modelValue,
        year,
        price: Math.trunc(price),
        mileage,
        fuel,
        image
      });
    }

    return output.slice(0, clampAdsLimit(Number(process.env.OLX_ADS_LIMIT ?? 10)));
  }
}
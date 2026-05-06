import type { ExternalCar } from '../../../core/cars/interfaces/car';

type ApifyOlxItem = {
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
  return Math.min(10, Math.max(5, value));
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const digits = value.replace(/[^0-9]/g, '');
    if (!digits) return null;
    const parsed = Number(digits);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  return null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
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

export class OlxProvider {
  async search(params: {
    brand: string;
    model: string;
    yearFrom: number;
    yearTo: number | null;
    maxPrice: number;
    mileageFrom: number | null;
    mileageTo: number | null;
  }): Promise<ExternalCar[]> {
    const token = process.env.APIFY_TOKEN;
    if (!token) throw new Error('APIFY_TOKEN is required');

    const actorId = process.env.APIFY_ACTOR_ID ?? 'israeloriente~olx-cars-scraper';
    const state = process.env.OLX_STATE ?? 'sp';
    const adsLimit = clampAdsLimit(Number(process.env.OLX_ADS_LIMIT ?? 10));
    const timeoutMs = Number(process.env.APIFY_TIMEOUT_MS ?? 40000);

    const url = `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;

    const yearTo = params.yearTo ?? params.yearFrom;

    const hasMileageFilter = params.mileageFrom !== null && params.mileageTo !== null;

    const body: Record<string, unknown> = {
      state,
      brand: params.brand,
      year_from: params.yearFrom,
      year_to: yearTo,
      pe: params.maxPrice,
      search: `${params.brand} ${params.model}`.trim(),
      ads_limit: adsLimit
    };

    if (hasMileageFilter) {
      body.mileage_from = params.mileageFrom;
      body.mileage_to = params.mileageTo;
    }

    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      },
      Number.isFinite(timeoutMs) ? timeoutMs : 40000
    );

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Apify request failed (${response.status}): ${text}`);
    }

    const items = (await response.json()) as unknown;
    if (!Array.isArray(items)) return [];

    const desiredBrand = params.brand.trim().toLowerCase();
    const desiredModel = params.model.trim().toLowerCase();

    const normalized: ExternalCar[] = [];
    for (const item of items as ApifyOlxItem[]) {
      const urlValue = (item as ApifyOlxItem).url;
      const brandValue = (item as ApifyOlxItem).brand;
      const modelValue = (item as ApifyOlxItem).model;

      if (!isNonEmptyString(urlValue) || !isNonEmptyString(brandValue) || !isNonEmptyString(modelValue)) {
        continue;
      }

      const year = toNumberOrNull((item as ApifyOlxItem).year) ?? params.yearFrom;
      const price = toNumberOrNull((item as ApifyOlxItem).price);
      if (price === null) continue;

      const mileage = toNumberOrNull((item as ApifyOlxItem).mileage);
      const fuel = toStringOrNull((item as ApifyOlxItem).fuel);

      if (desiredBrand && !brandValue.toLowerCase().includes(desiredBrand)) continue;
      if (desiredModel && !modelValue.toLowerCase().includes(desiredModel)) continue;

      if (year < params.yearFrom || year > yearTo) continue;
      if (price > params.maxPrice) continue;

      if (hasMileageFilter) {
        if (mileage === null) continue;
        if (mileage < (params.mileageFrom as number) || mileage > (params.mileageTo as number)) continue;
      }

      let image: string | null = null;
      const photos = (item as ApifyOlxItem).photos;
      if (Array.isArray(photos) && photos.length > 0) {
        const first = photos[0];
        if (typeof first === 'string') image = first;
      }

      normalized.push({
        url: urlValue,
        brand: brandValue,
        model: modelValue,
        year,
        price,
        mileage,
        fuel,
        image
      });
    }

    return normalized.slice(0, adsLimit);
  }
}

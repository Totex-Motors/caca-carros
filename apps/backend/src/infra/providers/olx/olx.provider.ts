import type { ExternalCar } from '../../../core/cars/interfaces/car';
import type { SearchCarParams } from '../../../core/cars/interfaces/search-car';
import { buildVersionTokens, matchesVersion, parseOlxVehicleParts, slugify } from './olx-model-parser';
import { OlxScraper } from './olx-scraper';
import type { OlxListing, OlxScrapeDebug, OlxSearchFilters } from './olx-types';

const MAX_PRICE_FALLBACK = 2147483647;

function clampAdsLimit(value: number): number {
  if (Number.isNaN(value)) return 10;
  return Math.min(10, Math.max(5, value));
}

function isStickySessionEnabled(): boolean {
  const flag = process.env.OLX_STICKY_SESSION ?? 'false';
  return flag.toLowerCase() === 'true';
}

function buildSessionId(filters: OlxSearchFilters): string {
  const base = `olx-${slugify(filters.brand)}-${slugify(filters.model)}`;
  if (isStickySessionEnabled()) return base;
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}

function toPositiveInteger(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.trunc(value);
}

function normalizeMaxPrice(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  if (value >= MAX_PRICE_FALLBACK) return null;
  return Math.trunc(value);
}

function normalizeFilters(params: SearchCarParams): OlxSearchFilters {
  const parsed = parseOlxVehicleParts({
    brand: params.brand,
    model: params.model,
    version: params.version
  });

  const yearMin = toPositiveInteger(params.yearFrom) ?? null;
  const yearMax = toPositiveInteger(params.yearTo ?? params.yearFrom) ?? yearMin;

  return {
    state: params.state ?? 'sp',
    brand: parsed.brand,
    model: parsed.model,
    version: parsed.version,
    priceMin: null,
    priceMax: normalizeMaxPrice(params.maxPrice),
    kmMin: toPositiveInteger(params.mileageFrom ?? null),
    kmMax: toPositiveInteger(params.mileageTo ?? null),
    yearMin: yearMin !== null && yearMin > 1900 ? yearMin : null,
    yearMax: yearMax !== null && yearMax > 1900 ? yearMax : null,
    condition: params.condition,
    sellerType: params.sellerType ?? null
  };
}

function shouldSkipByRange(listing: OlxListing, filters: OlxSearchFilters): boolean {
  if (listing.price === null) {
    if (filters.priceMin !== null || filters.priceMax !== null) return true;
  } else {
    if (filters.priceMin !== null && listing.price < filters.priceMin) return true;
    if (filters.priceMax !== null && listing.price > filters.priceMax) return true;
  }

  const year = listing.year;
  if (year === null) {
    if (filters.yearMin !== null || filters.yearMax !== null) return true;
  } else {
    if (filters.yearMin !== null && year < filters.yearMin) return true;
    if (filters.yearMax !== null && year > filters.yearMax) return true;
  }

  const km = listing.km;
  if (km === null) {
    if (filters.kmMin !== null || filters.kmMax !== null) return true;
  } else if (filters.kmMin !== null || filters.kmMax !== null) {
    if (filters.kmMin !== null && km < filters.kmMin) return true;
    if (filters.kmMax !== null && km > filters.kmMax) return true;
  }

  return false;
}

function mapListingToExternal(listing: OlxListing, fallbackYear: number | null): ExternalCar {
  const year = listing.year ?? fallbackYear ?? new Date().getFullYear();

  return {
    title: listing.title,
    price: listing.price ?? 0,
    year: Math.trunc(year),
    km: listing.km ?? null,
    fuel_type: listing.fuel ?? null,
    transmission: listing.transmission ?? null,
    city: listing.city ?? null,
    state: listing.state ?? null,
    photos: listing.photos ?? [],
    url: listing.url
  };
}

export class OlxProvider {
  constructor(private readonly scraper = new OlxScraper()) {}

  async search(params: SearchCarParams): Promise<ExternalCar[]> {
    const { cars } = await this.searchWithDebug(params);
    return cars;
  }

  async searchWithDebug(params: SearchCarParams): Promise<{ cars: ExternalCar[]; debug?: OlxScrapeDebug }> {
    const filters = normalizeFilters(params);
    const adsLimit = clampAdsLimit(Number(process.env.OLX_ADS_LIMIT ?? 10));
    const maxPagesEnv = Number(process.env.OLX_MAX_PAGES ?? 0);
    const maxPages = Number.isFinite(maxPagesEnv) ? Math.trunc(maxPagesEnv) : 0;
    const retryAttempts = Math.max(1, Math.trunc(Number(process.env.OLX_RETRY_ATTEMPTS ?? 2)));

    console.info('[olx.provider] starting search', {
      brand: filters.brand,
      model: filters.model,
      version: filters.version,
      yearFrom: filters.yearMin,
      yearTo: filters.yearMax
    });

    const { listings, debug } = await this.scraper.search(filters, {
      maxAds: adsLimit,
      maxPages,
      retryAttempts,
      sessionId: buildSessionId(filters)
    });

    const versionTokens = buildVersionTokens(filters.version);
    const output: ExternalCar[] = [];

    for (const listing of listings) {
      if (shouldSkipByRange(listing, filters)) continue;
      if (!matchesVersion(listing.title, versionTokens)) continue;
      output.push(mapListingToExternal(listing, filters.yearMin));
      if (output.length >= adsLimit) break;
    }

    console.info('[olx.provider] normalized results', { count: output.length });

    return { cars: output, debug };
  }
}

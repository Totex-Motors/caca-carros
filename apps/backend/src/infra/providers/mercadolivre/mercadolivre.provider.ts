import type { ExternalCar } from '../../../core/cars/interfaces/car';
import type { SearchCarParams } from '../../../core/cars/interfaces/search-car';
import { buildVersionTokens, matchesVersion } from '../olx/olx-model-parser';
import { MercadoLivreScraper } from './mercadolivre-scraper';
import { normalizeMercadoLivreFilters } from './mercadolivre-url-builder';
import type { MercadoLivreListing, MercadoLivreScrapeDebug, MercadoLivreSearchFilters } from './mercadolivre-types';

function clampAdsLimit(value: number): number {
  if (Number.isNaN(value)) return 10;
  return Math.min(10, Math.max(5, value));
}

function isStickySessionEnabled(): boolean {
  const flag = process.env.MERCADOLIVRE_STICKY_SESSION ?? 'false';
  return flag.toLowerCase() === 'true';
}

function buildSessionId(filters: MercadoLivreSearchFilters): string {
  const base = `mercadolivre-${filters.brand.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${filters.model.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  if (isStickySessionEnabled()) return base;
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeMaxPrice(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  if (value >= 2147483647) return null;
  return Math.trunc(value);
}

function normalizeKm(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.trunc(value);
}

function normalizeFilters(params: SearchCarParams): MercadoLivreSearchFilters {
  const yearMin = Number.isFinite(params.yearFrom) && params.yearFrom > 0 ? Math.trunc(params.yearFrom) : null;
  const yearToRaw = params.yearTo ?? params.yearFrom;
  const yearMax = yearToRaw !== null && yearToRaw !== undefined && Number.isFinite(yearToRaw) && yearToRaw > 0 ? Math.trunc(yearToRaw) : yearMin;

  return {
    state: params.state ?? 'sp',
    brand: params.brand,
    model: params.model,
    version: params.version,
    priceMin: null,
    priceMax: normalizeMaxPrice(params.maxPrice),
    kmMin: normalizeKm(params.mileageFrom),
    kmMax: normalizeKm(params.mileageTo),
    yearMin,
    yearMax,
    condition: params.condition,
    sellerType: params.sellerType
  };
}

function shouldSkipByRange(listing: MercadoLivreListing, filters: MercadoLivreSearchFilters): boolean {
  if (listing.year !== null) {
    if (filters.yearMin !== null && listing.year < filters.yearMin) return true;
    if (filters.yearMax !== null && listing.year > filters.yearMax) return true;
  }

  const km = normalizeKm(listing.km);
  if (km === null) {
    if (filters.kmMin !== null || filters.kmMax !== null) return true;
  } else {
    if (filters.kmMin !== null && km < filters.kmMin) return true;
    if (filters.kmMax !== null && km > filters.kmMax) return true;
  }

  return false;
}

function mapListingToExternal(listing: MercadoLivreListing, fallbackYear: number | null): ExternalCar {
  return {
    title: listing.title,
    price: listing.price ?? 0,
    year: Math.trunc(listing.year ?? fallbackYear ?? new Date().getFullYear()),
    km: listing.km ?? null,
    fuel_type: listing.fuel ?? null,
    transmission: listing.transmission ?? null,
    city: listing.city ?? null,
    state: listing.state ?? 'SP',
    photos: listing.photos ?? [],
    url: listing.url
  };
}

export class MercadoLivreProvider {
  constructor(private readonly scraper = new MercadoLivreScraper()) {}

  async search(params: SearchCarParams): Promise<ExternalCar[]> {
    const { cars } = await this.searchWithDebug(params);
    return cars;
  }

  async searchWithDebug(params: SearchCarParams): Promise<{ cars: ExternalCar[]; debug?: MercadoLivreScrapeDebug }> {
    const filters = normalizeFilters(params);
    const adsLimit = clampAdsLimit(Number(process.env.MERCADOLIVRE_ADS_LIMIT ?? 10));
    const maxPages = Math.max(1, Math.trunc(Number(process.env.MERCADOLIVRE_MAX_PAGES ?? 3)) || 3);
    const retryAttempts = Math.max(1, Math.trunc(Number(process.env.MERCADOLIVRE_RETRY_ATTEMPTS ?? 1)));

    console.info('[mercadolivre.provider] starting search', {
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
    const seen = new Set<string>();

    for (const listing of listings) {
      if (listing.price === null) continue;
      if (seen.has(listing.url)) continue;
      if (!matchesVersion(listing.title, versionTokens)) continue;
      if (shouldSkipByRange(listing, filters)) continue;

      seen.add(listing.url);
      output.push(mapListingToExternal(listing, filters.yearMin));
      if (output.length >= adsLimit) break;
    }

    console.info('[mercadolivre.provider] normalized results', { count: output.length });
    return { cars: output, debug };
  }
}
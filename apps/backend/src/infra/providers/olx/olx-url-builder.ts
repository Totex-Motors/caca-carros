import type { OlxSearchFilters } from './olx-types';
import { buildOlxSearchQuery, normalizeSearchText, parseOlxVehicleParts } from './olx-model-parser';

const BASE_URL = 'https://www.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios';
const DEFAULT_STATE = 'sp';

// OLX query params can change; keep these centralized for quick updates.
const PARAM_KEYS = {
  search: 'q',
  priceMin: 'ps',
  priceMax: 'pe',
  yearMin: 'rs',
  yearMax: 're',
  kmMin: 'kmf',
  kmMax: 'kmt',
  condition: 'sf',
  page: 'o'
};

function normalizeState(value: string | null): string {
  if (!value) return DEFAULT_STATE;
  const trimmed = value.trim().toLowerCase();
  if (/^[a-z]{2}$/.test(trimmed)) return trimmed;
  return DEFAULT_STATE;
}

function toPositiveInteger(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.trunc(value);
}

function resolveConditionParam(condition: OlxSearchFilters['condition']): string | null {
  if (condition === 'NEW') return 'novo';
  if (condition === 'USED') return 'usado';
  return null;
}

export function buildOlxSearchUrl(filters: OlxSearchFilters, page: number): string {
  const state = normalizeState(filters.state);
  const url = new URL(`${BASE_URL}/estado-${state}`);
  const parsed = parseOlxVehicleParts({
    brand: filters.brand,
    model: filters.model,
    version: filters.version
  });

  const query = normalizeSearchText(buildOlxSearchQuery(parsed));
  if (query) url.searchParams.set(PARAM_KEYS.search, query);

  const priceMin = toPositiveInteger(filters.priceMin);
  const priceMax = toPositiveInteger(filters.priceMax);
  const yearMin = toPositiveInteger(filters.yearMin);
  const yearMax = toPositiveInteger(filters.yearMax);
  const kmMin = toPositiveInteger(filters.kmMin);
  const kmMax = toPositiveInteger(filters.kmMax);

  if (priceMin !== null) url.searchParams.set(PARAM_KEYS.priceMin, String(priceMin));
  if (priceMax !== null) url.searchParams.set(PARAM_KEYS.priceMax, String(priceMax));
  if (yearMin !== null) url.searchParams.set(PARAM_KEYS.yearMin, String(yearMin));
  if (yearMax !== null) url.searchParams.set(PARAM_KEYS.yearMax, String(yearMax));
  if (kmMin !== null) url.searchParams.set(PARAM_KEYS.kmMin, String(kmMin));
  if (kmMax !== null) url.searchParams.set(PARAM_KEYS.kmMax, String(kmMax));

  const condition = resolveConditionParam(filters.condition);
  if (condition) url.searchParams.set(PARAM_KEYS.condition, condition);

  const safePage = Math.max(1, Math.trunc(page));
  if (safePage > 1) url.searchParams.set(PARAM_KEYS.page, String(safePage));

  return url.toString();
}

export function buildOlxSearchUrls(filters: OlxSearchFilters, maxPages: number): string[] {
  const safePages = Math.max(1, Math.min(Math.trunc(maxPages), 10));
  const urls: string[] = [];

  for (let page = 1; page <= safePages; page += 1) {
    urls.push(buildOlxSearchUrl(filters, page));
  }

  return urls;
}
